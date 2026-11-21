import { fail } from "@agent-native/core/action";
import { eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { poStatusFrom } from "../../shared/scm/rules.js";
import { schema } from "../db.js";
import { audit, nextNumber, num, type Actor, type Exec, type Tx } from "./common.js";
import { recordMovement } from "./inventory.js";

const S = schema;

export type ReceiptInput = { idPurchaseOrders: string; note?: string; items: { idPoItems: string; qtyAccepted: number; qtyRejected?: number }[] };

/**
 * Penerimaan barang (mendukung parsial). Hanya jumlah DITERIMA yang masuk stok, melalui stock_movements
 * (receipt) yang terhubung ke gr_items — penerimaan tidak mengubah saldo tanpa mutasi.
 */
export async function receiveGoods(tx: Tx, actor: Actor, input: ReceiptInput) {
  const [po] = await tx.select().from(S.purchaseOrders).where(eq(S.purchaseOrders.idPurchaseOrders, input.idPurchaseOrders)).for("update");
  if (!po) fail("PO tidak ditemukan", { statusCode: 404 });
  if (po.status !== "sent" && po.status !== "partial") fail("PO ini tidak menerima barang lagi", { statusCode: 409 });
  const items = input.items.filter((i) => i.qtyAccepted > 0 || (i.qtyRejected ?? 0) > 0);
  if (items.length === 0) fail("Isi minimal satu jumlah diterima atau ditolak", { statusCode: 400 });
  const poLines = await tx
    .select({ idPoItems: S.poItems.idPoItems, qtyOrdered: S.poItems.qtyOrdered, idMaterials: S.quotationItems.idMaterials })
    .from(S.poItems).innerJoin(S.quotationItems, eq(S.quotationItems.idQuotationItems, S.poItems.idQuotationItems))
    .where(eq(S.poItems.idPurchaseOrders, po.idPurchaseOrders));
  const accepted = await tx
    .select({ id: S.grItems.idPoItems, s: sql<string>`sum(${S.grItems.qtyAccepted})` }).from(S.grItems)
    .where(inArray(S.grItems.idPoItems, poLines.map((l) => l.idPoItems))).groupBy(S.grItems.idPoItems);
  const got = new Map(accepted.map((a) => [a.id, num(a.s)]));
  for (const it of items) {
    const line = poLines.find((l) => l.idPoItems === it.idPoItems);
    if (!line) fail("Ada item yang bukan bagian dari PO ini", { statusCode: 400 });
    const remaining = line.qtyOrdered - (got.get(it.idPoItems) ?? 0);
    if (it.qtyAccepted > remaining + 1e-9) fail(`Jumlah diterima melebihi sisa PO (${remaining})`, { statusCode: 400 });
  }
  const grNumber = await nextNumber(tx, S.goodsReceipts.grNumber, "GR");
  const [gr] = await tx.insert(S.goodsReceipts).values({ grNumber, idPurchaseOrders: po.idPurchaseOrders, idUsers: actor.idUsers, note: input.note ?? "" }).returning();
  for (const it of items) {
    const [row] = await tx.insert(S.grItems).values({ idGoodsReceipts: gr.idGoodsReceipts, idPoItems: it.idPoItems, qtyAccepted: it.qtyAccepted, qtyRejected: it.qtyRejected ?? 0 }).returning();
    if (it.qtyAccepted > 0) {
      const line = poLines.find((l) => l.idPoItems === it.idPoItems)!;
      await recordMovement(tx, actor, { idMaterials: line.idMaterials, movementType: "receipt", qty: it.qtyAccepted, idGrItems: row.idGrItems, note: `Penerimaan ${grNumber}` });
    }
    got.set(it.idPoItems, (got.get(it.idPoItems) ?? 0) + it.qtyAccepted);
  }
  const ordered = poLines.reduce((s, l) => s + l.qtyOrdered, 0);
  const totalAccepted = poLines.reduce((s, l) => s + (got.get(l.idPoItems) ?? 0), 0);
  // PO selesai bila SEMUA baris terpenuhi (bukan sekadar jumlah total)
  const allDone = poLines.every((l) => (got.get(l.idPoItems) ?? 0) >= l.qtyOrdered - 1e-9);
  const status = allDone ? "received" : poStatusFrom(ordered, Math.min(totalAccepted, ordered - 1e-6));
  await tx.update(S.purchaseOrders).set({ status }).where(eq(S.purchaseOrders.idPurchaseOrders, po.idPurchaseOrders));
  await audit(tx, actor, "goods_received", "goods_receipts", gr.idGoodsReceipts, { grNumber, po: po.poNumber, status, items: items.length });
  return { ...gr, poStatus: status };
}

export async function listGoodsReceipts(db: Exec) {
  return db
    .select({ ...getTableColumns(S.goodsReceipts), poNumber: S.purchaseOrders.poNumber, receiverName: S.users.fullName })
    .from(S.goodsReceipts).innerJoin(S.purchaseOrders, eq(S.purchaseOrders.idPurchaseOrders, S.goodsReceipts.idPurchaseOrders))
    .innerJoin(S.users, eq(S.users.idUsers, S.goodsReceipts.idUsers)).orderBy(sql`${S.goodsReceipts.receivedAt} desc`).limit(200);
}
