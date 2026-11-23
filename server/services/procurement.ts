import { fail } from "@agent-native/core/action";
import { and, asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { poStatusFrom, round2, round3 } from "../../shared/scm/rules.js";
import { computeSaw, type SawQuotation } from "../../shared/scm/saw.js";
import { schema } from "../db.js";
import { addDays, audit, nextNumber, num, today, type Actor, type Exec, type Tx } from "./common.js";
import { getSetting, getWeights } from "./settings.js";

const S = schema;

// ───────── Purchase Request ─────────
export async function createPurchaseRequest(tx: Tx, actor: Actor, input: { neededBy: string; notes?: string; items: { idMaterials: string; qty: number }[] }) {
  const ids = input.items.map((i) => i.idMaterials);
  if (ids.length === 0) fail("PR minimal memiliki satu item", { statusCode: 400 });
  if (new Set(ids).size !== ids.length) fail("Bahan baku duplikat pada PR", { statusCode: 400 });
  const mats = await tx.select().from(S.materials).where(inArray(S.materials.idMaterials, ids));
  if (mats.length !== ids.length) fail("Ada bahan baku yang tidak ditemukan", { statusCode: 404 });
  if (mats.some((m) => !m.isActive)) fail("Ada bahan baku yang tidak aktif", { statusCode: 400 });
  if (input.neededBy < today()) fail("Tanggal dibutuhkan tidak boleh di masa lalu", { statusCode: 400 });
  const prNumber = await nextNumber(tx, S.purchaseRequests.prNumber, "PR");
  const [pr] = await tx.insert(S.purchaseRequests).values({ prNumber, idUsers: actor.idUsers, neededBy: input.neededBy, notes: input.notes ?? "" }).returning();
  await tx.insert(S.prItems).values(input.items.map((i) => ({ idPurchaseRequests: pr.idPurchaseRequests, idMaterials: i.idMaterials, qty: i.qty })));
  await audit(tx, actor, "pr_created", "purchase_requests", pr.idPurchaseRequests, { prNumber, items: input.items.length });
  return pr;
}

/** Keputusan Owner. Penolakan wajib disertai catatan (FR-O2). */
export async function decidePurchaseRequest(tx: Tx, owner: Actor, idPurchaseRequests: string, decision: "approved" | "rejected", note: string) {
  if (decision === "rejected" && !note.trim()) fail("Catatan wajib diisi saat menolak PR", { statusCode: 400 });
  const [pr] = await tx.select().from(S.purchaseRequests).where(eq(S.purchaseRequests.idPurchaseRequests, idPurchaseRequests)).for("update");
  if (!pr) fail("PR tidak ditemukan", { statusCode: 404 });
  if (pr.status !== "submitted") fail("Hanya PR berstatus Menunggu yang dapat diputuskan", { statusCode: 409 });
  await tx.insert(S.approvals).values({ idPurchaseRequests, idUsers: owner.idUsers, decision, note });
  await tx.update(S.purchaseRequests).set({ status: decision, updatedAt: new Date() }).where(eq(S.purchaseRequests.idPurchaseRequests, idPurchaseRequests));
  await audit(tx, owner, decision === "approved" ? "pr_approved" : "pr_rejected", "purchase_requests", idPurchaseRequests, { note });
  return { idPurchaseRequests, status: decision };
}

export async function listPurchaseRequests(db: Exec) {
  const prs = await db
    .select({ ...getTableColumns(S.purchaseRequests), requesterName: S.users.fullName })
    .from(S.purchaseRequests).innerJoin(S.users, eq(S.users.idUsers, S.purchaseRequests.idUsers))
    .orderBy(sql`${S.purchaseRequests.createdAt} desc`).limit(200);
  if (prs.length === 0) return [];
  const items = await db
    .select({ idPurchaseRequests: S.prItems.idPurchaseRequests, idMaterials: S.prItems.idMaterials, qty: S.prItems.qty, materialName: S.materials.materialName, unitName: S.units.unitName })
    .from(S.prItems).innerJoin(S.materials, eq(S.materials.idMaterials, S.prItems.idMaterials)).innerJoin(S.units, eq(S.units.idUnits, S.materials.idUnits))
    .where(inArray(S.prItems.idPurchaseRequests, prs.map((p) => p.idPurchaseRequests)));
  const quotes = await db.select({ id: S.supplierQuotations.idPurchaseRequests, n: sql<number>`count(*)::int` }).from(S.supplierQuotations).groupBy(S.supplierQuotations.idPurchaseRequests);
  return prs.map((p) => ({ ...p, items: items.filter((i) => i.idPurchaseRequests === p.idPurchaseRequests), quotationCount: quotes.find((q) => q.id === p.idPurchaseRequests)?.n ?? 0 }));
}

// ───────── Penawaran, SAW, pemilihan supplier ─────────
export type QuotationInput = {
  idPurchaseRequests: string; idSuppliers: string; quotationDate: string; validUntil: string; leadTimeDays: number; paymentTermDays: number;
  items: { idMaterials: string; unitPrice: number; minOrderQty?: number }[];
};

export async function addQuotation(tx: Tx, actor: Actor, input: QuotationInput) {
  const [pr] = await tx.select().from(S.purchaseRequests).where(eq(S.purchaseRequests.idPurchaseRequests, input.idPurchaseRequests)).for("update");
  if (!pr) fail("PR tidak ditemukan", { statusCode: 404 });
  if (pr.status !== "approved") fail("Penawaran hanya dapat dicatat untuk PR yang sudah disetujui Owner", { statusCode: 400 });
  const [sup] = await tx.select().from(S.suppliers).where(eq(S.suppliers.idSuppliers, input.idSuppliers));
  if (!sup) fail("Supplier tidak ditemukan", { statusCode: 404 });
  if (!sup.isActive) fail("Supplier tidak aktif", { statusCode: 400 });
  if (input.validUntil < input.quotationDate) fail("Masa berlaku tidak boleh sebelum tanggal penawaran", { statusCode: 400 });
  const prItems = await tx.select().from(S.prItems).where(eq(S.prItems.idPurchaseRequests, input.idPurchaseRequests));
  const allowed = new Set(prItems.map((i) => i.idMaterials));
  if (input.items.length === 0) fail("Penawaran minimal memiliki satu item", { statusCode: 400 });
  if (input.items.some((i) => !allowed.has(i.idMaterials))) fail("Ada item penawaran yang tidak terdapat pada PR", { statusCode: 400 });
  const [already] = await tx.select().from(S.supplierQuotations).where(and(eq(S.supplierQuotations.idPurchaseRequests, input.idPurchaseRequests), eq(S.supplierQuotations.idSuppliers, input.idSuppliers)));
  if (already) fail("Supplier ini sudah memiliki penawaran untuk PR tersebut", { statusCode: 409 });
  const [selected] = await tx.select().from(S.supplierQuotations).where(and(eq(S.supplierQuotations.idPurchaseRequests, input.idPurchaseRequests), eq(S.supplierQuotations.isSelected, true)));
  if (selected) fail("Supplier sudah dipilih untuk PR ini; penawaran tidak dapat ditambah", { statusCode: 409 });
  const [q] = await tx.insert(S.supplierQuotations).values({
    idPurchaseRequests: input.idPurchaseRequests, idSuppliers: input.idSuppliers, idUsers: actor.idUsers, quotationDate: input.quotationDate,
    validUntil: input.validUntil, leadTimeDays: input.leadTimeDays, paymentTermDays: input.paymentTermDays,
  }).returning();
  await tx.insert(S.quotationItems).values(input.items.map((i) => ({ idSupplierQuotations: q.idSupplierQuotations, idMaterials: i.idMaterials, unitPrice: i.unitPrice, minOrderQty: i.minOrderQty ?? 0 })));
  await audit(tx, actor, "quotation_recorded", "supplier_quotations", q.idSupplierQuotations, { supplier: sup.supplierName });
  return q;
}

/**
 * Kinerja historis supplier (0–100) = rata-rata (ketepatan waktu, kesesuaian jumlah) dari penerimaan terdahulu.
 * Ketepatan waktu: share penerimaan dengan tanggal terima ≤ tanggal janji (expected_date PO).
 * Kesesuaian jumlah: Σ diterima ÷ Σ dipesan pada PO yang sudah selesai atau melewati tanggal janji (maks 100%).
 * Supplier tanpa riwayat memakai nilai awal dari pengaturan.
 */
export async function supplierPerformance(db: Exec, supplierIds?: string[]) {
  const initialP = getSetting(db, "new_supplier_performance_score", "70");
  const suppliersP = db.select({ id: S.suppliers.idSuppliers, name: S.suppliers.supplierName }).from(S.suppliers)
    .where(supplierIds ? inArray(S.suppliers.idSuppliers, supplierIds) : undefined);
  const receiptsP = db
    .select({ supplierId: S.supplierQuotations.idSuppliers, poId: S.purchaseOrders.idPurchaseOrders, expected: S.purchaseOrders.expectedDate, status: S.purchaseOrders.status, receivedAt: S.goodsReceipts.receivedAt })
    .from(S.goodsReceipts).innerJoin(S.purchaseOrders, eq(S.purchaseOrders.idPurchaseOrders, S.goodsReceipts.idPurchaseOrders))
    .innerJoin(S.supplierQuotations, eq(S.supplierQuotations.idSupplierQuotations, S.purchaseOrders.idSupplierQuotations));
  const linesP = db
    .select({ supplierId: S.supplierQuotations.idSuppliers, poId: S.poItems.idPurchaseOrders, poItem: S.poItems.idPoItems, ordered: S.poItems.qtyOrdered, accepted: sql<string>`coalesce(sum(${S.grItems.qtyAccepted}), 0)` })
    .from(S.poItems).innerJoin(S.purchaseOrders, eq(S.purchaseOrders.idPurchaseOrders, S.poItems.idPurchaseOrders))
    .innerJoin(S.supplierQuotations, eq(S.supplierQuotations.idSupplierQuotations, S.purchaseOrders.idSupplierQuotations))
    .leftJoin(S.grItems, eq(S.grItems.idPoItems, S.poItems.idPoItems))
    .groupBy(S.poItems.idPoItems, S.supplierQuotations.idSuppliers);
  const [initialRaw, suppliers, receipts, lines] = await Promise.all([initialP, suppliersP, receiptsP, linesP]);
  const initial = Number(initialRaw);
  const poMeta = new Map(receipts.map((r) => [r.poId, r]));
  const t = today();
  return suppliers.map((s) => {
    const mine = receipts.filter((r) => r.supplierId === s.id);
    if (mine.length === 0) return { idSuppliers: s.id, supplierName: s.name, performance: initial, onTimePct: null as number | null, accuracyPct: null as number | null, receiptCount: 0, isNew: true };
    const onTime = mine.filter((r) => r.receivedAt.toISOString().slice(0, 10) <= r.expected).length / mine.length;
    const considered = lines.filter((l) => l.supplierId === s.id && poMeta.has(l.poId) && (poMeta.get(l.poId)!.status === "received" || poMeta.get(l.poId)!.expected < t));
    const ordered = considered.reduce((a, l) => a + num(l.ordered), 0);
    const accepted = considered.reduce((a, l) => a + Math.min(num(l.accepted), num(l.ordered)), 0);
    const accuracy = ordered > 0 ? accepted / ordered : 1;
    return { idSuppliers: s.id, supplierName: s.name, performance: round2(((onTime + accuracy) / 2) * 100), onTimePct: round2(onTime * 100), accuracyPct: round2(accuracy * 100), receiptCount: mine.length, isNew: false };
  });
}

/** Tabel perbandingan penawaran + skor SAW untuk satu PR (FR-P4). */
export async function compareQuotations(db: Exec, idPurchaseRequests: string) {
  const prItems = await db.select({ idMaterials: S.prItems.idMaterials, qty: S.prItems.qty, materialName: S.materials.materialName, unitName: S.units.unitName })
    .from(S.prItems).innerJoin(S.materials, eq(S.materials.idMaterials, S.prItems.idMaterials)).innerJoin(S.units, eq(S.units.idUnits, S.materials.idUnits))
    .where(eq(S.prItems.idPurchaseRequests, idPurchaseRequests));
  const quotes = await db.select({ ...getTableColumns(S.supplierQuotations), supplierName: S.suppliers.supplierName })
    .from(S.supplierQuotations).innerJoin(S.suppliers, eq(S.suppliers.idSuppliers, S.supplierQuotations.idSuppliers))
    .where(eq(S.supplierQuotations.idPurchaseRequests, idPurchaseRequests)).orderBy(asc(S.suppliers.supplierName));
  if (quotes.length === 0) return { items: prItems, quotations: [], weights: await getWeights(db), canSelect: false };
  const qItems = await db.select().from(S.quotationItems).where(inArray(S.quotationItems.idSupplierQuotations, quotes.map((q) => q.idSupplierQuotations)));
  const perf = await supplierPerformance(db, quotes.map((q) => q.idSuppliers));
  const weights = await getWeights(db);
  const t = today();

  const sawInput: SawQuotation[] = quotes.map((q) => {
    const mine = qItems.filter((i) => i.idSupplierQuotations === q.idSupplierQuotations);
    const covered = prItems.every((p) => mine.some((i) => i.idMaterials === p.idMaterials));
    const meetsMin = prItems.every((p) => { const it = mine.find((i) => i.idMaterials === p.idMaterials); return !it || p.qty >= it.minOrderQty; });
    const total = round2(prItems.reduce((s, p) => s + p.qty * (mine.find((i) => i.idMaterials === p.idMaterials)?.unitPrice ?? 0), 0));
    return { id: q.idSupplierQuotations, total, leadTimeDays: q.leadTimeDays, paymentTermDays: q.paymentTermDays, performance: perf.find((x) => x.idSuppliers === q.idSuppliers)?.performance ?? 70, complete: covered && meetsMin && q.validUntil >= t };
  });
  const scores = computeSaw(sawInput, weights);
  const rows = quotes.map((q) => {
    const s = scores.find((x) => x.id === q.idSupplierQuotations)!;
    const inp = sawInput.find((x) => x.id === q.idSupplierQuotations)!;
    const p = perf.find((x) => x.idSuppliers === q.idSuppliers);
    const issues: string[] = [];
    const mine = qItems.filter((i) => i.idSupplierQuotations === q.idSupplierQuotations);
    if (!prItems.every((pi) => mine.some((i) => i.idMaterials === pi.idMaterials))) issues.push("Tidak mencakup seluruh item PR");
    if (prItems.some((pi) => { const it = mine.find((i) => i.idMaterials === pi.idMaterials); return it && pi.qty < it.minOrderQty; })) issues.push("Kuantitas PR di bawah minimal order");
    if (q.validUntil < t) issues.push("Masa berlaku penawaran sudah lewat");
    return {
      idSupplierQuotations: q.idSupplierQuotations, idSuppliers: q.idSuppliers, supplierName: q.supplierName, leadTimeDays: q.leadTimeDays, paymentTermDays: q.paymentTermDays,
      validUntil: q.validUntil, isSelected: q.isSelected, selectionReason: q.selectionReason, total: inp.total, performance: inp.performance, isNewSupplier: p?.isNew ?? true,
      scores: s.scores, totalScore: s.total, rank: s.rank, recommended: s.recommended, eligible: s.eligible, issues,
      items: prItems.map((pi) => ({ idMaterials: pi.idMaterials, unitPrice: mine.find((i) => i.idMaterials === pi.idMaterials)?.unitPrice ?? null })),
    };
  });
  return { items: prItems, quotations: rows, weights, canSelect: quotes.length >= 2 };
}

/** Pemilihan supplier: minimal 2 penawaran; alasan wajib bila bukan rekomendasi skor tertinggi (FR-P5). */
export async function selectSupplier(tx: Tx, actor: Actor, idSupplierQuotations: string, reason: string) {
  const [q] = await tx.select().from(S.supplierQuotations).where(eq(S.supplierQuotations.idSupplierQuotations, idSupplierQuotations));
  if (!q) fail("Penawaran tidak ditemukan", { statusCode: 404 });
  const [pr] = await tx.select().from(S.purchaseRequests).where(eq(S.purchaseRequests.idPurchaseRequests, q.idPurchaseRequests)).for("update");
  if (pr.status !== "approved") fail("PR tidak dalam status Disetujui (mungkin sudah dibuatkan PO)", { statusCode: 409 });
  const cmp = await compareQuotations(tx, q.idPurchaseRequests);
  if (!cmp.canSelect) fail("Minimal dua penawaran supplier diperlukan sebelum memilih", { statusCode: 400 });
  const chosen = cmp.quotations.find((x) => x.idSupplierQuotations === idSupplierQuotations)!;
  if (!chosen.eligible) fail(`Penawaran tidak dapat dipilih: ${chosen.issues.join("; ") || "tidak lengkap"}`, { statusCode: 400 });
  const rec = cmp.quotations.find((x) => x.recommended);
  if (rec && rec.idSupplierQuotations !== idSupplierQuotations && !reason.trim()) fail("Alasan pemilihan wajib diisi karena supplier yang dipilih bukan rekomendasi skor tertinggi", { statusCode: 400 });
  await tx.update(S.supplierQuotations).set({ isSelected: false, selectionReason: "" }).where(eq(S.supplierQuotations.idPurchaseRequests, q.idPurchaseRequests));
  await tx.update(S.supplierQuotations).set({ isSelected: true, selectionReason: reason.trim() }).where(eq(S.supplierQuotations.idSupplierQuotations, idSupplierQuotations));
  await audit(tx, actor, "supplier_selected", "supplier_quotations", idSupplierQuotations, {
    chosen: chosen.supplierName, score: chosen.totalScore, recommended: rec?.supplierName, followedRecommendation: rec?.idSupplierQuotations === idSupplierQuotations, reason: reason.trim(),
    weights: cmp.weights, scores: cmp.quotations.map((x) => ({ supplier: x.supplierName, total: x.totalScore })),
  });
  return { idSupplierQuotations, followedRecommendation: rec?.idSupplierQuotations === idSupplierQuotations };
}

// ───────── Purchase Order ─────────
export async function createPurchaseOrder(tx: Tx, actor: Actor, idPurchaseRequests: string, orderDate = today()) {
  const [pr] = await tx.select().from(S.purchaseRequests).where(eq(S.purchaseRequests.idPurchaseRequests, idPurchaseRequests)).for("update");
  if (!pr) fail("PR tidak ditemukan", { statusCode: 404 });
  if (pr.status !== "approved") fail("PO hanya dapat dibuat dari PR yang disetujui dan belum dipesan", { statusCode: 409 });
  const [q] = await tx.select().from(S.supplierQuotations).where(and(eq(S.supplierQuotations.idPurchaseRequests, idPurchaseRequests), eq(S.supplierQuotations.isSelected, true)));
  if (!q) fail("Pilih supplier dari perbandingan penawaran terlebih dahulu", { statusCode: 400 });
  const prItems = await tx.select().from(S.prItems).where(eq(S.prItems.idPurchaseRequests, idPurchaseRequests));
  const qItems = await tx.select().from(S.quotationItems).where(eq(S.quotationItems.idSupplierQuotations, q.idSupplierQuotations));
  const lines = prItems.map((p) => ({ p, qi: qItems.find((i) => i.idMaterials === p.idMaterials) }));
  if (lines.some((l) => !l.qi)) fail("Penawaran terpilih tidak mencakup seluruh item PR", { statusCode: 400 });
  const poNumber = await nextNumber(tx, S.purchaseOrders.poNumber, "PO");
  const [po] = await tx.insert(S.purchaseOrders).values({ poNumber, idSupplierQuotations: q.idSupplierQuotations, idUsers: actor.idUsers, orderDate, expectedDate: addDays(orderDate, q.leadTimeDays) }).returning();
  await tx.insert(S.poItems).values(lines.map((l) => ({ idPurchaseOrders: po.idPurchaseOrders, idQuotationItems: l.qi!.idQuotationItems, qtyOrdered: l.p.qty })));
  await tx.update(S.purchaseRequests).set({ status: "ordered", updatedAt: new Date() }).where(eq(S.purchaseRequests.idPurchaseRequests, idPurchaseRequests));
  await audit(tx, actor, "po_created", "purchase_orders", po.idPurchaseOrders, { poNumber, quotation: q.idSupplierQuotations });
  return po;
}

export async function cancelPurchaseOrder(tx: Tx, actor: Actor, idPurchaseOrders: string) {
  const [po] = await tx.select().from(S.purchaseOrders).where(eq(S.purchaseOrders.idPurchaseOrders, idPurchaseOrders)).for("update");
  if (!po) fail("PO tidak ditemukan", { statusCode: 404 });
  if (po.status !== "sent") fail("Hanya PO tanpa penerimaan yang dapat dibatalkan", { statusCode: 409 });
  const [inv] = await tx.select({ n: sql<number>`count(*)::int` }).from(S.supplierInvoices).where(eq(S.supplierInvoices.idPurchaseOrders, idPurchaseOrders));
  if ((inv?.n ?? 0) > 0) fail("PO sudah memiliki invoice", { statusCode: 409 });
  await tx.update(S.purchaseOrders).set({ status: "cancelled" }).where(eq(S.purchaseOrders.idPurchaseOrders, idPurchaseOrders));
  const [q] = await tx.select().from(S.supplierQuotations).where(eq(S.supplierQuotations.idSupplierQuotations, po.idSupplierQuotations));
  await tx.update(S.purchaseRequests).set({ status: "approved", updatedAt: new Date() }).where(eq(S.purchaseRequests.idPurchaseRequests, q.idPurchaseRequests));
  await tx.update(S.supplierQuotations).set({ isSelected: false, selectionReason: "" }).where(eq(S.supplierQuotations.idSupplierQuotations, q.idSupplierQuotations));
  await audit(tx, actor, "po_cancelled", "purchase_orders", idPurchaseOrders);
  return { idPurchaseOrders, status: "cancelled" as const };
}

/** PO dengan baris, total (turunan), jumlah diterima dan sisa. */
export async function listPurchaseOrders(db: Exec, onlyId?: string) {
  const pos = await db
    .select({ ...getTableColumns(S.purchaseOrders), supplierName: S.suppliers.supplierName, idSuppliers: S.suppliers.idSuppliers, idPurchaseRequests: S.supplierQuotations.idPurchaseRequests, prNumber: S.purchaseRequests.prNumber, paymentTermDays: S.supplierQuotations.paymentTermDays })
    .from(S.purchaseOrders)
    .innerJoin(S.supplierQuotations, eq(S.supplierQuotations.idSupplierQuotations, S.purchaseOrders.idSupplierQuotations))
    .innerJoin(S.suppliers, eq(S.suppliers.idSuppliers, S.supplierQuotations.idSuppliers))
    .innerJoin(S.purchaseRequests, eq(S.purchaseRequests.idPurchaseRequests, S.supplierQuotations.idPurchaseRequests))
    .where(onlyId ? eq(S.purchaseOrders.idPurchaseOrders, onlyId) : undefined)
    .orderBy(sql`${S.purchaseOrders.createdAt} desc`).limit(200);
  if (pos.length === 0) return [];
  const lines = await db
    .select({ idPurchaseOrders: S.poItems.idPurchaseOrders, idPoItems: S.poItems.idPoItems, qtyOrdered: S.poItems.qtyOrdered, unitPrice: S.quotationItems.unitPrice, idMaterials: S.quotationItems.idMaterials, materialName: S.materials.materialName, unitName: S.units.unitName,
      qtyAccepted: sql<string>`coalesce((select sum(g.qty_accepted) from gr_items g where g.id_po_items = ${S.poItems.idPoItems}), 0)`,
      qtyRejected: sql<string>`coalesce((select sum(g.qty_rejected) from gr_items g where g.id_po_items = ${S.poItems.idPoItems}), 0)` })
    .from(S.poItems).innerJoin(S.quotationItems, eq(S.quotationItems.idQuotationItems, S.poItems.idQuotationItems))
    .innerJoin(S.materials, eq(S.materials.idMaterials, S.quotationItems.idMaterials)).innerJoin(S.units, eq(S.units.idUnits, S.materials.idUnits))
    .where(inArray(S.poItems.idPurchaseOrders, pos.map((p) => p.idPurchaseOrders)));
  return pos.map((p) => {
    const mine = lines.filter((l) => l.idPurchaseOrders === p.idPurchaseOrders).map((l) => ({ ...l, qtyAccepted: num(l.qtyAccepted), qtyRejected: num(l.qtyRejected), remaining: round3(l.qtyOrdered - num(l.qtyAccepted)) }));
    return { ...p, items: mine, total: round2(mine.reduce((s, l) => s + l.qtyOrdered * l.unitPrice, 0)) };
  });
}

export { poStatusFrom };
