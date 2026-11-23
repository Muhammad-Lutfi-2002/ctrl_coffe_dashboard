import { fail } from "@agent-native/core/action";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { threeWayMatch, type InvoiceLine } from "../../shared/scm/matching.js";
import { paymentNeedsOwnerApproval, remainingPayable, round2 } from "../../shared/scm/rules.js";
import { schema } from "../db.js";
import { audit, nextNumber, num, today, type Actor, type Exec, type Tx } from "./common.js";
import { getSetting } from "./settings.js";

const S = schema;

async function acceptedByPoItem(db: Exec, poItemIds: string[]) {
  if (poItemIds.length === 0) return {};
  const rows = await db.select({ id: S.grItems.idPoItems, s: sql<string>`sum(${S.grItems.qtyAccepted})` }).from(S.grItems).where(inArray(S.grItems.idPoItems, poItemIds)).groupBy(S.grItems.idPoItems);
  return Object.fromEntries(rows.map((r) => [r.id, num(r.s)]));
}

export type InvoiceInput = { idPurchaseOrders: string; invoiceNumber: string; invoiceDate: string; dueDate: string; items: InvoiceLine[] };

export async function recordInvoice(tx: Tx, actor: Actor, input: InvoiceInput) {
  const [po] = await tx.select().from(S.purchaseOrders).where(eq(S.purchaseOrders.idPurchaseOrders, input.idPurchaseOrders));
  if (!po) fail("PO tidak ditemukan", { statusCode: 404 });
  if (po.status === "cancelled") fail("PO dibatalkan", { statusCode: 409 });
  if (input.items.length === 0) fail("Invoice minimal memiliki satu item", { statusCode: 400 });
  if (new Set(input.items.map((i) => i.idPoItems)).size !== input.items.length) fail("Item invoice duplikat", { statusCode: 400 });
  if (input.dueDate < input.invoiceDate) fail("Jatuh tempo tidak boleh sebelum tanggal invoice", { statusCode: 400 });
  const lines = await tx.select({ id: S.poItems.idPoItems }).from(S.poItems).where(eq(S.poItems.idPurchaseOrders, po.idPurchaseOrders));
  const valid = new Set(lines.map((l) => l.id));
  if (input.items.some((i) => !valid.has(i.idPoItems))) fail("Ada item invoice yang bukan bagian dari PO", { statusCode: 400 });
  const [dup] = await tx.select().from(S.supplierInvoices).where(and(eq(S.supplierInvoices.idPurchaseOrders, po.idPurchaseOrders), eq(S.supplierInvoices.invoiceNumber, input.invoiceNumber)));
  if (dup) fail("Nomor invoice ini sudah tercatat untuk PO tersebut", { statusCode: 409 });
  const [inv] = await tx.insert(S.supplierInvoices).values({ idPurchaseOrders: po.idPurchaseOrders, invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate, dueDate: input.dueDate, idUsers: actor.idUsers }).returning();
  await tx.insert(S.invoiceItems).values(input.items.map((i) => ({ idSupplierInvoices: inv.idSupplierInvoices, idPoItems: i.idPoItems, qtyInvoiced: i.qtyInvoiced, unitPrice: i.unitPrice })));
  await audit(tx, actor, "invoice_recorded", "supplier_invoices", inv.idSupplierInvoices, { invoiceNumber: input.invoiceNumber });
  return inv;
}

/** Three-way matching PO–GR–Invoice. Hasil: matched (dapat dibayar) atau held (ditahan + alasan). */
export async function verifyInvoice(tx: Tx, actor: Actor, idSupplierInvoices: string) {
  const [inv] = await tx.select().from(S.supplierInvoices).where(eq(S.supplierInvoices.idSupplierInvoices, idSupplierInvoices)).for("update");
  if (!inv) fail("Invoice tidak ditemukan", { statusCode: 404 });
  const invLines = await tx.select().from(S.invoiceItems).where(eq(S.invoiceItems.idSupplierInvoices, idSupplierInvoices));
  const poLines = await tx.select({ idPoItems: S.poItems.idPoItems, qtyOrdered: S.poItems.qtyOrdered, unitPrice: S.quotationItems.unitPrice })
    .from(S.poItems).innerJoin(S.quotationItems, eq(S.quotationItems.idQuotationItems, S.poItems.idQuotationItems)).where(eq(S.poItems.idPurchaseOrders, inv.idPurchaseOrders));
  const accepted = await acceptedByPoItem(tx, poLines.map((l) => l.idPoItems));
  const prior = await tx.select({ id: S.invoiceItems.idPoItems, s: sql<string>`sum(${S.invoiceItems.qtyInvoiced})` }).from(S.invoiceItems)
    .innerJoin(S.supplierInvoices, eq(S.supplierInvoices.idSupplierInvoices, S.invoiceItems.idSupplierInvoices))
    .where(and(eq(S.supplierInvoices.idPurchaseOrders, inv.idPurchaseOrders), eq(S.supplierInvoices.status, "matched"), sql`${S.supplierInvoices.idSupplierInvoices} <> ${idSupplierInvoices}`)).groupBy(S.invoiceItems.idPoItems);
  const result = threeWayMatch(poLines, accepted, Object.fromEntries(prior.map((p) => [p.id, num(p.s)])), invLines.map((l) => ({ idPoItems: l.idPoItems, qtyInvoiced: l.qtyInvoiced, unitPrice: l.unitPrice })));
  const status = result.matched ? "matched" : "held";
  const note = result.matched ? "Sesuai: PO – penerimaan – invoice" : result.issues.map((i) => i.detail).join("; ");
  await tx.update(S.supplierInvoices).set({ status, verifiedBy: actor.idUsers, verifiedAt: new Date(), verificationNote: note }).where(eq(S.supplierInvoices.idSupplierInvoices, idSupplierInvoices));
  await audit(tx, actor, "invoice_verified", "supplier_invoices", idSupplierInvoices, { status, issues: result.issues });
  return { status, issues: result.issues, invoiceTotal: result.invoiceTotal, note };
}

export async function listInvoices(db: Exec) {
  const invs = await db.select({ ...getTableColumns(S.supplierInvoices), poNumber: S.purchaseOrders.poNumber, supplierName: S.suppliers.supplierName })
    .from(S.supplierInvoices).innerJoin(S.purchaseOrders, eq(S.purchaseOrders.idPurchaseOrders, S.supplierInvoices.idPurchaseOrders))
    .innerJoin(S.supplierQuotations, eq(S.supplierQuotations.idSupplierQuotations, S.purchaseOrders.idSupplierQuotations))
    .innerJoin(S.suppliers, eq(S.suppliers.idSuppliers, S.supplierQuotations.idSuppliers)).orderBy(sql`${S.supplierInvoices.createdAt} desc`).limit(200);
  if (invs.length === 0) return [];
  const ids = invs.map((i) => i.idSupplierInvoices);
  const [lines, pays] = await Promise.all([db.select({ idSupplierInvoices: S.invoiceItems.idSupplierInvoices, idPoItems: S.invoiceItems.idPoItems, qty: S.invoiceItems.qtyInvoiced, price: S.invoiceItems.unitPrice, materialName: S.materials.materialName })
    .from(S.invoiceItems).innerJoin(S.poItems, eq(S.poItems.idPoItems, S.invoiceItems.idPoItems)).innerJoin(S.quotationItems, eq(S.quotationItems.idQuotationItems, S.poItems.idQuotationItems))
    .innerJoin(S.materials, eq(S.materials.idMaterials, S.quotationItems.idMaterials)).where(inArray(S.invoiceItems.idSupplierInvoices, ids)),
    db.select({ id: S.payments.idSupplierInvoices, s: sql<string>`coalesce(sum(${S.payments.amount}) filter (where ${S.payments.status} in ('pending_approval','approved','paid')), 0)`, paid: sql<string>`coalesce(sum(${S.payments.amount}) filter (where ${S.payments.status} = 'paid'), 0)` })
    .from(S.payments).where(inArray(S.payments.idSupplierInvoices, ids)).groupBy(S.payments.idSupplierInvoices)]);
  return invs.map((i) => {
    const mine = lines.filter((l) => l.idSupplierInvoices === i.idSupplierInvoices);
    const total = round2(mine.reduce((s, l) => s + l.qty * l.price, 0));
    const p = pays.find((x) => x.id === i.idSupplierInvoices);
    const committed = num(p?.s), paid = num(p?.paid);
    return { ...i, items: mine, total, committed, paid, remaining: remainingPayable(total, committed), paymentState: paid >= total && total > 0 ? "paid" : committed > 0 ? "partial" : "unpaid" };
  });
}

// ───────── Pembayaran ─────────
export type PaymentInput = { idSupplierInvoices: string; amount: number; method: "transfer" | "cash" | "giro"; dueDate?: string };

/** Pembayaran bertahap. Di atas ambang → menunggu persetujuan Owner (FR-O3); selain itu langsung approved. */
export async function createPayment(tx: Tx, actor: Actor, input: PaymentInput) {
  const [inv] = await tx.select().from(S.supplierInvoices).where(eq(S.supplierInvoices.idSupplierInvoices, input.idSupplierInvoices)).for("update");
  if (!inv) fail("Invoice tidak ditemukan", { statusCode: 404 });
  if (inv.status !== "matched") fail("Invoice harus lolos verifikasi three-way matching sebelum dibayar", { statusCode: 409 });
  const [li] = (await listInvoices(tx)).filter((i) => i.idSupplierInvoices === input.idSupplierInvoices);
  if (input.amount > li.remaining + 0.005) fail(`Nominal melebihi sisa tagihan (${li.remaining})`, { statusCode: 400 });
  const threshold = Number(await getSetting(tx, "payment_approval_threshold", "5000000"));
  const needsOwner = paymentNeedsOwnerApproval(input.amount, threshold);
  const paymentNumber = await nextNumber(tx, S.payments.paymentNumber, "PAY");
  const [pay] = await tx.insert(S.payments).values({ paymentNumber, idSupplierInvoices: input.idSupplierInvoices, idUsers: actor.idUsers, amount: input.amount, method: input.method, dueDate: input.dueDate ?? inv.dueDate, status: needsOwner ? "pending_approval" : "approved" }).returning();
  await audit(tx, actor, "payment_created", "payments", pay.idPayments, { paymentNumber, amount: input.amount, needsOwner, threshold });
  return { ...pay, needsOwnerApproval: needsOwner };
}

export async function decidePayment(tx: Tx, owner: Actor, idPayments: string, decision: "approved" | "rejected", note: string) {
  if (decision === "rejected" && !note.trim()) fail("Catatan wajib diisi saat menolak pembayaran", { statusCode: 400 });
  const [pay] = await tx.select().from(S.payments).where(eq(S.payments.idPayments, idPayments)).for("update");
  if (!pay) fail("Pembayaran tidak ditemukan", { statusCode: 404 });
  if (pay.status !== "pending_approval") fail("Pembayaran tidak menunggu persetujuan", { statusCode: 409 });
  await tx.insert(S.approvals).values({ idPayments, idUsers: owner.idUsers, decision, note });
  await tx.update(S.payments).set({ status: decision }).where(eq(S.payments.idPayments, idPayments));
  await audit(tx, owner, decision === "approved" ? "payment_approved" : "payment_rejected", "payments", idPayments, { note });
  return { idPayments, status: decision };
}

export async function markPaymentPaid(tx: Tx, actor: Actor, idPayments: string, paidAt = new Date()) {
  const [pay] = await tx.select().from(S.payments).where(eq(S.payments.idPayments, idPayments)).for("update");
  if (!pay) fail("Pembayaran tidak ditemukan", { statusCode: 404 });
  if (pay.status !== "approved") fail("Pembayaran harus berstatus Disetujui sebelum dicatat lunas", { statusCode: 409 });
  await tx.update(S.payments).set({ status: "paid", paidAt }).where(eq(S.payments.idPayments, idPayments));
  await audit(tx, actor, "payment_paid", "payments", idPayments, { amount: pay.amount });
  return { idPayments, status: "paid" as const };
}

export async function listPayments(db: Exec) {
  return db.select({ ...getTableColumns(S.payments), invoiceNumber: S.supplierInvoices.invoiceNumber, supplierName: S.suppliers.supplierName, poNumber: S.purchaseOrders.poNumber })
    .from(S.payments).innerJoin(S.supplierInvoices, eq(S.supplierInvoices.idSupplierInvoices, S.payments.idSupplierInvoices))
    .innerJoin(S.purchaseOrders, eq(S.purchaseOrders.idPurchaseOrders, S.supplierInvoices.idPurchaseOrders))
    .innerJoin(S.supplierQuotations, eq(S.supplierQuotations.idSupplierQuotations, S.purchaseOrders.idSupplierQuotations))
    .innerJoin(S.suppliers, eq(S.suppliers.idSuppliers, S.supplierQuotations.idSuppliers)).orderBy(sql`${S.payments.createdAt} desc`).limit(200);
}

// ───────── Anggaran dan pengeluaran ─────────
export async function setBudget(tx: Tx, actor: Actor, period: string, amount: number) {
  const [row] = await tx.insert(S.budgets).values({ period, budgetAmount: amount }).onConflictDoUpdate({ target: S.budgets.period, set: { budgetAmount: amount } }).returning();
  await audit(tx, actor, "budget_set", "budgets", row.idBudgets, { period, amount });
  return row;
}

export async function recordExpense(tx: Tx, actor: Actor, input: { expenseDate: string; description: string; amount: number }) {
  const period = input.expenseDate.slice(0, 7);
  const [b] = await tx.select().from(S.budgets).where(eq(S.budgets.period, period));
  const [row] = await tx.insert(S.expenses).values({ idBudgets: b?.idBudgets ?? null, idUsers: actor.idUsers, expenseDate: input.expenseDate, description: input.description, amount: input.amount }).returning();
  await audit(tx, actor, "expense_recorded", "expenses", row.idExpenses, { amount: input.amount });
  return row;
}

export async function listExpenses(db: Exec) {
  return db.select().from(S.expenses).orderBy(sql`${S.expenses.expenseDate} desc`).limit(200);
}

/** Laporan keuangan periodik (YYYY-MM): anggaran vs realisasi; pembelian supplier dibedakan dari pengeluaran operasional. */
export async function financeReport(db: Exec, period: string) {
  const from = `${period}-01`;
  const [y, m] = period.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const TZ = sql.raw("'Asia/Jakarta'");  // konsisten dengan dashboard analitik (hari WIB)
  const [[budget], [ops], [sup], invoices, [rev]] = await Promise.all([
    db.select().from(S.budgets).where(eq(S.budgets.period, period)),
    db.select({ s: sql<string>`coalesce(sum(${S.expenses.amount}), 0)` }).from(S.expenses).where(and(sql`${S.expenses.expenseDate} >= ${from}`, sql`${S.expenses.expenseDate} < ${to}`)),
    db.select({ s: sql<string>`coalesce(sum(${S.payments.amount}), 0)` }).from(S.payments).where(and(eq(S.payments.status, "paid"), sql`${S.payments.paidAt} >= ${from}::date`, sql`${S.payments.paidAt} < ${to}::date`)),
    listInvoices(db),
    db.select({ s: sql<string>`coalesce(sum(${S.salesItems.qty} * ${S.salesItems.unitPrice}), 0)` }).from(S.salesItems)
      .innerJoin(S.salesTransactions, eq(S.salesTransactions.idSalesTransactions, S.salesItems.idSalesTransactions))
      .where(and(sql`(${S.salesTransactions.trxDate} at time zone ${TZ})::date >= ${from}::date`, sql`(${S.salesTransactions.trxDate} at time zone ${TZ})::date < ${to}::date`)),
  ]);
  const outstanding = round2(invoices.filter((i) => i.status === "matched").reduce((s, i) => s + (i.total - i.paid), 0));
  const operational = round2(num(ops?.s)), supplierPaid = round2(num(sup?.s)), budgetAmount = budget ? budget.budgetAmount : null;
  return { period, budgetAmount, operationalExpenses: operational, supplierPayments: supplierPaid, totalOutflow: round2(operational + supplierPaid), budgetRemaining: budgetAmount === null ? null : round2(budgetAmount - operational - supplierPaid), outstandingPayables: outstanding, salesRevenue: round2(num(rev?.s)) };
}

export { today };
