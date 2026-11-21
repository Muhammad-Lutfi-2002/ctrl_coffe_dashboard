import { beforeAll, describe, expect, it } from "vitest";

import addQuotation from "../actions/add-quotation";
import cancelPurchaseOrder from "../actions/cancel-purchase-order";
import compareQuotations from "../actions/compare-quotations";
import createCategory from "../actions/create-category";
import createMaterial from "../actions/create-material";
import createPayment from "../actions/create-payment";
import createProduct from "../actions/create-product";
import createPurchaseOrder from "../actions/create-purchase-order";
import createPurchaseRequest from "../actions/create-purchase-request";
import createSale from "../actions/create-sale";
import createStockOpname from "../actions/create-stock-opname";
import createSupplier from "../actions/create-supplier";
import createUnit from "../actions/create-unit";
import decidePayment from "../actions/decide-payment";
import decidePurchaseRequest from "../actions/decide-purchase-request";
import finalizeStockOpname from "../actions/finalize-stock-opname";
import getFinanceReport from "../actions/get-finance-report";
import getSalesDashboard from "../actions/get-sales-dashboard";
import importSalesCsv from "../actions/import-sales-csv";
import listAuditLogs from "../actions/list-audit-logs";
import listMaterials from "../actions/list-materials";
import listPurchaseOrders from "../actions/list-purchase-orders";
import listSuppliers from "../actions/list-suppliers";
import markPaymentPaid from "../actions/mark-payment-paid";
import receiveGoods from "../actions/receive-goods";
import recordExpense from "../actions/record-expense";
import recordInvoice from "../actions/record-invoice";
import recordMovement from "../actions/record-stock-movement";
import recordOpeningBalance from "../actions/record-opening-balance";
import selectSupplier from "../actions/select-supplier";
import setBudget from "../actions/set-budget";
import updateScoringWeights from "../actions/update-scoring-weights";
import updateSetting from "../actions/update-setting";
import verifyInvoice from "../actions/verify-invoice";
import getOperationalSummary from "../actions/get-operational-summary";
import { getDb } from "../server/db.js";
import { sql } from "drizzle-orm";
import { applyMigrations, as, seedUsers } from "./helpers";

const run = <A, R>(a: { run: (args: A, ...rest: any[]) => R }, args: A) => (a.run as any)(args) as Promise<any>;
const future = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const todayStr = future(0);

let ids: Record<string, string> = {};

beforeAll(async () => {
  await applyMigrations();
  await seedUsers();
  const cat = await as("admin", () => run(createCategory, { name: "Bahan Kopi" }));
  const pcat = await as("admin", () => run(createCategory, { name: "Minuman" }));
  const kg = await as("admin", () => run(createUnit, { name: "kg" }));
  const ltr = await as("admin", () => run(createUnit, { name: "liter" }));
  const beans = await as("admin", () => run(createMaterial, { idCategories: cat.idCategories, idUnits: kg.idUnits, sku: "BJ-001", materialName: "Biji Kopi Arabika", minStock: 5, safetyStock: 2 }));
  const milk = await as("admin", () => run(createMaterial, { idCategories: cat.idCategories, idUnits: ltr.idUnits, sku: "SU-001", materialName: "Susu UHT", minStock: 10, safetyStock: 3 }));
  const latte = await as("admin", () => run(createProduct, { idCategories: pcat.idCategories, sku: "LATTE", productName: "Caffe Latte", price: 30000 }));
  const americano = await as("admin", () => run(createProduct, { idCategories: pcat.idCategories, sku: "AMERI", productName: "Americano", price: 20000 }));
  const sA = await as("purchasing", () => run(createSupplier, { supplierName: "Supplier A" }));
  const sB = await as("purchasing", () => run(createSupplier, { supplierName: "Supplier B" }));
  const sC = await as("purchasing", () => run(createSupplier, { supplierName: "Supplier C" }));
  ids = { beans: beans.idMaterials, milk: milk.idMaterials, latte: latte.idProducts, americano: americano.idProducts, sA: sA.idSuppliers, sB: sB.idSuppliers, sC: sC.idSuppliers };
});

describe("migrasi, seed, dan keamanan", () => {
  it("peran, bobot SAW, dan pengaturan awal ter-seed", async () => {
    const db = getDb();
    const roles = (await db.execute(sql`select count(*)::int as n from roles`)) as any;
    expect((roles.rows ?? roles)[0].n).toBe(4);
  });
  it("RBAC di server: peran lain ditolak (403) dan tanpa sesi ditolak (401)", async () => {
    await expect(as("purchasing", () => run(createMaterial, { idCategories: ids.latte, idUnits: ids.latte, sku: "X", materialName: "X", minStock: 0, safetyStock: 0 }))).rejects.toThrow(/tidak berwenang/);
    await expect(as(null, () => run(listMaterials, {}))).rejects.toThrow(/Sesi tidak valid/);
    await expect(as("admin", () => run(decidePurchaseRequest, { idPurchaseRequests: ids.latte, decision: "approved", note: "" }))).rejects.toThrow(/tidak berwenang/);
  });
  it("audit_logs append-only", async () => {
    const db = getDb();
    await expect(db.execute(sql`update audit_logs set action = 'x'`)).rejects.toThrow();
  });
});

describe("persediaan: saldo dari mutasi", () => {
  it("saldo awal, pemakaian, dan penolakan stok tidak cukup", async () => {
    await as("admin", () => run(recordOpeningBalance, { idMaterials: ids.beans, qty: 10 }));
    await as("admin", () => run(recordMovement, { idMaterials: ids.beans, movementType: "usage", qty: 4 }));
    await expect(as("admin", () => run(recordMovement, { idMaterials: ids.beans, movementType: "usage", qty: 100 }))).rejects.toThrow(/Stok tidak cukup/);
    const mats = await as("admin", () => run(listMaterials, {}));
    expect(mats.find((m: any) => m.idMaterials === ids.beans).balance).toBe(6);
  });
  it("stock opname memposting selisih sebagai mutasi", async () => {
    await as("admin", () => run(recordOpeningBalance, { idMaterials: ids.milk, qty: 20 }));
    const op = await as("admin", () => run(createStockOpname, { items: [{ idMaterials: ids.milk, countedQty: 18 }] }));
    const fin = await as("admin", () => run(finalizeStockOpname, { idStockOpnames: op.idStockOpnames }));
    expect(fin.variances[0].variance).toBe(-2);
    await expect(as("admin", () => run(finalizeStockOpname, { idStockOpnames: op.idStockOpnames }))).rejects.toThrow(/sudah difinalisasi/);
    const mats = await as("admin", () => run(listMaterials, {}));
    expect(mats.find((m: any) => m.idMaterials === ids.milk).balance).toBe(18);
  });
  it("mutasi stok tidak dapat diubah (append-only)", async () => {
    await expect(getDb().execute(sql`delete from stock_movements`)).rejects.toThrow();
  });
});

describe("alur pengadaan end-to-end", () => {
  let pr: any, qA: any, qB: any, qC: any, po: any;
  it("PR multi-item; penolakan wajib catatan; Owner menyetujui", async () => {
    pr = await as("purchasing", () => run(createPurchaseRequest, { neededBy: future(7), items: [{ idMaterials: ids.beans, qty: 10 }, { idMaterials: ids.milk, qty: 20 }] }));
    await expect(as("owner", () => run(decidePurchaseRequest, { idPurchaseRequests: pr.idPurchaseRequests, decision: "rejected", note: "" }))).rejects.toThrow(/Catatan wajib/);
    await expect(as("purchasing", () => run(addQuotation, { idPurchaseRequests: pr.idPurchaseRequests, idSuppliers: ids.sA, quotationDate: todayStr, validUntil: future(5), leadTimeDays: 2, paymentTermDays: 7, items: [{ idMaterials: ids.beans, unitPrice: 100000 }] }))).rejects.toThrow(/sudah disetujui/);
    await as("owner", () => run(decidePurchaseRequest, { idPurchaseRequests: pr.idPurchaseRequests, decision: "approved", note: "ok" }));
  });
  it("tiga penawaran, perbandingan SAW, dan syarat minimal dua penawaran", async () => {
    const mk = (idSuppliers: string, lead: number, term: number, beansPrice: number, milkPrice: number) => ({ idPurchaseRequests: pr.idPurchaseRequests, idSuppliers, quotationDate: todayStr, validUntil: future(10), leadTimeDays: lead, paymentTermDays: term, items: [{ idMaterials: ids.beans, unitPrice: beansPrice }, { idMaterials: ids.milk, unitPrice: milkPrice }] });
    qA = await as("purchasing", () => run(addQuotation, mk(ids.sA, 2, 7, 120000, 18000)));
    await expect(as("purchasing", () => run(selectSupplier, { idSupplierQuotations: qA.idSupplierQuotations, reason: "" }))).rejects.toThrow(/Minimal dua penawaran/);
    qB = await as("purchasing", () => run(addQuotation, mk(ids.sB, 4, 14, 115000, 17000)));
    qC = await as("purchasing", () => run(addQuotation, mk(ids.sC, 1, 0, 125000, 19000)));
    await expect(as("purchasing", () => run(addQuotation, mk(ids.sA, 2, 7, 1, 1)))).rejects.toThrow(/sudah memiliki penawaran/);
    const cmp = await as("owner", () => run(compareQuotations, { idPurchaseRequests: pr.idPurchaseRequests }));
    expect(cmp.quotations).toHaveLength(3);
    expect(cmp.quotations.filter((q: any) => q.recommended)).toHaveLength(1);
    const total = cmp.quotations.find((q: any) => q.supplierName === "Supplier A").total;
    expect(total).toBe(10 * 120000 + 20 * 18000);
    expect(cmp.quotations.every((q: any) => q.isNewSupplier)).toBe(true);
  });
  it("memilih non-rekomendasi wajib alasan; PO dari penawaran terpilih", async () => {
    const cmp = await as("owner", () => run(compareQuotations, { idPurchaseRequests: pr.idPurchaseRequests }));
    const other = cmp.quotations.find((q: any) => !q.recommended);
    await expect(as("purchasing", () => run(selectSupplier, { idSupplierQuotations: other.idSupplierQuotations, reason: "" }))).rejects.toThrow(/Alasan pemilihan wajib/);
    await as("purchasing", () => run(selectSupplier, { idSupplierQuotations: other.idSupplierQuotations, reason: "Pengiriman rutin dan sudah dikenal" }));
    po = await as("purchasing", () => run(createPurchaseOrder, { idPurchaseRequests: pr.idPurchaseRequests }));
    await expect(as("purchasing", () => run(createPurchaseOrder, { idPurchaseRequests: pr.idPurchaseRequests }))).rejects.toThrow(/PO hanya dapat dibuat/);
    const pos = await as("admin", () => run(listPurchaseOrders, {}));
    const row = pos.find((p: any) => p.idPurchaseOrders === po.idPurchaseOrders);
    expect(row.items).toHaveLength(2);
    expect(row.total).toBe(row.items.reduce((s: number, l: any) => s + l.qtyOrdered * l.unitPrice, 0));
  });
  it("PO tanpa penerimaan dapat dibatalkan dan PR kembali ke Disetujui", async () => {
    const pr2 = await as("purchasing", () => run(createPurchaseRequest, { neededBy: future(3), items: [{ idMaterials: ids.beans, qty: 1 }] }));
    await as("owner", () => run(decidePurchaseRequest, { idPurchaseRequests: pr2.idPurchaseRequests, decision: "approved", note: "" }));
    for (const s of [ids.sA, ids.sB]) await as("purchasing", () => run(addQuotation, { idPurchaseRequests: pr2.idPurchaseRequests, idSuppliers: s, quotationDate: todayStr, validUntil: future(5), leadTimeDays: 1, paymentTermDays: 0, items: [{ idMaterials: ids.beans, unitPrice: 1000 }] }));
    const cmp = await as("purchasing", () => run(compareQuotations, { idPurchaseRequests: pr2.idPurchaseRequests }));
    await as("purchasing", () => run(selectSupplier, { idSupplierQuotations: cmp.quotations.find((q: any) => q.recommended).idSupplierQuotations, reason: "" }));
    const po2 = await as("purchasing", () => run(createPurchaseOrder, { idPurchaseRequests: pr2.idPurchaseRequests }));
    const c = await as("purchasing", () => run(cancelPurchaseOrder, { idPurchaseOrders: po2.idPurchaseOrders }));
    expect(c.status).toBe("cancelled");
  });

  it("penerimaan parsial memperbarui stok, status PO, dan menolak kelebihan", async () => {
    const pos = await as("admin", () => run(listPurchaseOrders, {}));
    const row = pos.find((p: any) => p.idPurchaseOrders === po.idPurchaseOrders);
    const beansLine = row.items.find((l: any) => l.idMaterials === ids.beans);
    const milkLine = row.items.find((l: any) => l.idMaterials === ids.milk);
    await expect(as("admin", () => run(receiveGoods, { idPurchaseOrders: po.idPurchaseOrders, items: [{ idPoItems: beansLine.idPoItems, qtyAccepted: 11 }] }))).rejects.toThrow(/melebihi sisa/);
    const r1 = await as("admin", () => run(receiveGoods, { idPurchaseOrders: po.idPurchaseOrders, items: [{ idPoItems: beansLine.idPoItems, qtyAccepted: 6, qtyRejected: 1 }, { idPoItems: milkLine.idPoItems, qtyAccepted: 20 }] }));
    expect(r1.poStatus).toBe("partial");
    let mats = await as("admin", () => run(listMaterials, {}));
    expect(mats.find((m: any) => m.idMaterials === ids.beans).balance).toBe(12); // 6 + 6 diterima
    expect(mats.find((m: any) => m.idMaterials === ids.milk).balance).toBe(38);
    const r2 = await as("admin", () => run(receiveGoods, { idPurchaseOrders: po.idPurchaseOrders, items: [{ idPoItems: beansLine.idPoItems, qtyAccepted: 4 }] }));
    expect(r2.poStatus).toBe("received");
    await expect(as("admin", () => run(receiveGoods, { idPurchaseOrders: po.idPurchaseOrders, items: [{ idPoItems: beansLine.idPoItems, qtyAccepted: 1 }] }))).rejects.toThrow(/tidak menerima barang/);
    mats = await as("admin", () => run(listMaterials, {}));
    expect(mats.find((m: any) => m.idMaterials === ids.beans).balance).toBe(16);
  });

  it("kinerja historis supplier kini berasal dari catatan penerimaan", async () => {
    const sups = await as("purchasing", () => run(listSuppliers, {}));
    const chosen = sups.find((s: any) => s.performance && !s.performance.isNew);
    expect(chosen).toBeTruthy();
    expect(chosen.performance.performance).toBeGreaterThan(0);
  });

  describe("keuangan: three-way matching dan pembayaran", () => {
    let poLines: any[], inv: any, paidTotal = 0;
    it("invoice dengan harga berbeda ditahan; invoice benar lolos", async () => {
      const pos = await as("finance", () => run(listPurchaseOrders, {}));
      const row = pos.find((p: any) => p.idPurchaseOrders === po.idPurchaseOrders);
      poLines = row.items;
      const bad = await as("finance", () => run(recordInvoice, { idPurchaseOrders: po.idPurchaseOrders, invoiceNumber: "INV-BAD", invoiceDate: todayStr, dueDate: future(14), items: poLines.map((l: any) => ({ idPoItems: l.idPoItems, qtyInvoiced: l.qtyOrdered, unitPrice: l.unitPrice + 500 })) }));
      const v = await as("finance", () => run(verifyInvoice, { idSupplierInvoices: bad.idSupplierInvoices }));
      expect(v.status).toBe("held");
      await expect(as("finance", () => run(createPayment, { idSupplierInvoices: bad.idSupplierInvoices, amount: 1000, method: "transfer" }))).rejects.toThrow(/three-way matching/);
      inv = await as("finance", () => run(recordInvoice, { idPurchaseOrders: po.idPurchaseOrders, invoiceNumber: "INV-OK", invoiceDate: todayStr, dueDate: future(14), items: poLines.map((l: any) => ({ idPoItems: l.idPoItems, qtyInvoiced: l.qtyOrdered, unitPrice: l.unitPrice })) }));
      const ok = await as("finance", () => run(verifyInvoice, { idSupplierInvoices: inv.idSupplierInvoices }));
      expect(ok.status).toBe("matched");
    });
    it("di atas ambang butuh Owner; Keuangan tidak dapat menyetujui sendiri; pembayaran bertahap", async () => {
      const invTotal = poLines.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0);
      const threshold = Math.round(invTotal * 0.5);
      const bigAmt = Math.round(invTotal * 0.6);
      const smallAmt = invTotal - bigAmt;
      await as("owner", () => run(updateSetting, { key: "payment_approval_threshold", value: threshold }));
      const big = await as("finance", () => run(createPayment, { idSupplierInvoices: inv.idSupplierInvoices, amount: bigAmt, method: "transfer" }));
      expect(big.status).toBe("pending_approval");
      await expect(as("finance", () => run(markPaymentPaid, { idPayments: big.idPayments }))).rejects.toThrow(/Disetujui/);
      await expect(as("finance", () => run(decidePayment, { idPayments: big.idPayments, decision: "approved", note: "" }))).rejects.toThrow(/tidak berwenang/);
      await as("owner", () => run(decidePayment, { idPayments: big.idPayments, decision: "approved", note: "ok" }));
      await as("finance", () => run(markPaymentPaid, { idPayments: big.idPayments }));
      await expect(as("finance", () => run(createPayment, { idSupplierInvoices: inv.idSupplierInvoices, amount: smallAmt + 1, method: "transfer" }))).rejects.toThrow(/melebihi sisa/);
      const small = await as("finance", () => run(createPayment, { idSupplierInvoices: inv.idSupplierInvoices, amount: smallAmt, method: "cash" }));
      expect(small.status).toBe("approved"); // di bawah ambang: dalam kewenangan Keuangan
      await as("finance", () => run(markPaymentPaid, { idPayments: small.idPayments }));
      paidTotal = bigAmt + smallAmt;
    });
    it("anggaran dan laporan keuangan membedakan pembelian supplier dan pengeluaran operasional", async () => {
      const period = todayStr.slice(0, 7);
      await as("finance", () => run(setBudget, { period, amount: 10_000_000 }));
      await as("finance", () => run(recordExpense, { expenseDate: todayStr, description: "Listrik", amount: 300_000 }));
      const rep = await as("owner", () => run(getFinanceReport, { period }));
      expect(rep.operationalExpenses).toBe(300_000);
      expect(rep.supplierPayments).toBe(paidTotal);
      expect(rep.totalOutflow).toBe(paidTotal + 300_000);
      expect(rep.budgetRemaining).toBe(10_000_000 - paidTotal - 300_000);
    });
  });
});

describe("bobot SAW dan pengaturan (Owner)", () => {
  it("total bobot harus 100, perubahan tercatat pada histori dan audit", async () => {
    await expect(as("owner", () => run(updateScoringWeights, { price: 50, performance: 25, lead_time: 20, payment_term: 15 }))).rejects.toThrow(/Total bobot/);
    await expect(as("purchasing", () => run(updateScoringWeights, { price: 40, performance: 30, lead_time: 15, payment_term: 15 }))).rejects.toThrow(/tidak berwenang/);
    await as("owner", () => run(updateScoringWeights, { price: 40, performance: 30, lead_time: 15, payment_term: 15 }));
    const h = (await getDb().execute(sql`select count(*)::int as n from scoring_parameter_history`)) as any;
    expect((h.rows ?? h)[0].n).toBe(2);
    await as("owner", () => run(updateScoringWeights, { price: 40, performance: 25, lead_time: 20, payment_term: 15 }));
  });
});

describe("penjualan: input manual, impor CSV, dan dashboard", () => {
  const csv = `external_ref,trx_date,sku,qty,unit_price\nINV-1,${todayStr},LATTE,2,30000\nINV-1,${todayStr},AMERI,1,\nINV-2,${todayStr},AMERI,3,20000\n`;
  it("input manual dan impor CSV valid", async () => {
    await as("admin", () => run(createSale, { items: [{ idProducts: ids.latte, qty: 1 }] }));
    const dry = await as("admin", () => run(importSalesCsv, { fileName: "a.csv", content: csv, dryRun: true }));
    expect(dry.willImport).toBe(2);
    const res = await as("admin", () => run(importSalesCsv, { fileName: "a.csv", content: csv }));
    expect(res.imported).toBe(2);
  });
  it("mencegah impor ganda (berkas sama) dan memuat transaksi hanya sekali", async () => {
    await expect(as("admin", () => run(importSalesCsv, { fileName: "a.csv", content: csv }))).rejects.toThrow(/sudah pernah diimpor/);
    const again = csv + `INV-1,${todayStr},LATTE,1,30000\nINV-9,${todayStr},LATTE,1,30000\n`;
    const r = await as("admin", () => run(importSalesCsv, { fileName: "b.csv", content: again }));
    expect(r.duplicates).toBe(2); // INV-1 dan INV-2 sudah ada
    expect(r.imported).toBe(1);
  });
  it("berkas dengan baris tidak valid ditolak seluruhnya", async () => {
    const bad = `external_ref,trx_date,sku,qty\nZ1,${todayStr},TIDAKADA,1\nZ2,${todayStr},LATTE,1\n`;
    const r = await as("admin", () => run(importSalesCsv, { fileName: "c.csv", content: bad }));
    expect(r.errors).toHaveLength(1);
    expect(r.imported).toBe(0);
  });
  it("dashboard dihitung dari transaksi tersimpan", async () => {
    const d = await as("owner", () => run(getSalesDashboard, { from: future(-1), to: future(1), granularity: "day" }));
    // manual 30.000 + INV-1 (2×30.000 + 1×20.000) + INV-2 (3×20.000) + INV-9 30.000
    expect(d.totalRevenue).toBe(30000 + 80000 + 60000 + 30000);
    expect(d.transactionCount).toBe(4);
    expect(d.averageTransactionValue).toBe(50000);
    expect(d.topProducts[0].productName).toBe("Caffe Latte");
    expect(d.growthPercent).toBeNull(); // periode sebelumnya kosong
    expect(d.trend.reduce((s: number, t: any) => s + t.revenue, 0)).toBe(d.totalRevenue);
  });
  it("hanya Owner/Keuangan yang dapat melihat analitik penjualan", async () => {
    await expect(as("purchasing", () => run(getSalesDashboard, { from: future(-1), to: future(1), granularity: "day" }))).rejects.toThrow(/tidak berwenang/);
  });
});

describe("dashboard operasional per peran dan audit trail", () => {
  it("setiap peran hanya menerima bagian kewenangannya", async () => {
    const adm = await as("admin", () => run(getOperationalSummary, {}));
    expect(adm.finance).toBeUndefined();
    const fin = await as("finance", () => run(getOperationalSummary, {}));
    expect(fin.lowStock).toBeUndefined();
    expect(fin.finance).toBeDefined();
    const own = await as("owner", () => run(getOperationalSummary, {}));
    expect(own.supplierPerformance).toBeDefined();
  });
  it("audit trail mencatat persetujuan, pemilihan supplier, bobot, penerimaan, verifikasi, dan pembayaran", async () => {
    const logs = await as("owner", () => run(listAuditLogs, {}));
    const actions = new Set(logs.map((l: any) => l.action));
    for (const a of ["pr_approved", "supplier_selected", "scoring_weights_changed", "goods_received", "invoice_verified", "payment_approved", "payment_paid", "sales_imported"]) expect(actions.has(a), a).toBe(true);
  });
});
