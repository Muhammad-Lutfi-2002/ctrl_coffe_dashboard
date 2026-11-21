import { fail } from "@agent-native/core/action";
import { and, asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { isBelowMinimum, OUTFLOW_TYPES, round3, stockStatus, type MovementType } from "../../shared/scm/rules.js";
import { schema } from "../db.js";
import { audit, nextNumber, num, today, type Actor, type Exec, type Tx } from "./common.js";

const { materials: M, stockMovements: SM } = schema;

/** Saldo stok = Σ qty_delta mutasi (tidak disimpan di tabel materials). */
export async function stockBalances(db: Exec, materialIds?: string[]) {
  const rows = await db
    .select({
      idMaterials: M.idMaterials, sku: M.sku, materialName: M.materialName, minStock: M.minStock, safetyStock: M.safetyStock, isActive: M.isActive,
      idCategories: M.idCategories, idUnits: M.idUnits,
      balance: sql<string>`coalesce(sum(${SM.qtyDelta}), 0)`,
    })
    .from(M)
    .leftJoin(SM, eq(SM.idMaterials, M.idMaterials))
    .where(materialIds ? inArray(M.idMaterials, materialIds) : undefined)
    .groupBy(M.idMaterials)
    .orderBy(asc(M.materialName));
  return rows.map((r) => ({ ...r, balance: round3(num(r.balance)), status: stockStatus(num(r.balance), r.minStock) }));
}

export async function lowStock(db: Exec) {
  return (await stockBalances(db)).filter((r) => r.isActive && isBelowMinimum(r.balance, r.minStock));
}

async function lockedBalance(tx: Tx, idMaterials: string) {
  const [mat] = await tx.select().from(M).where(eq(M.idMaterials, idMaterials)).for("update");
  if (!mat) fail("Bahan baku tidak ditemukan", { statusCode: 404 });
  const [b] = await tx.select({ s: sql<string>`coalesce(sum(${SM.qtyDelta}), 0)` }).from(SM).where(eq(SM.idMaterials, idMaterials));
  return { mat, balance: round3(num(b?.s)) };
}

export type MovementInput = { idMaterials: string; movementType: MovementType; qty: number; note?: string; movedAt?: Date; idGrItems?: string | null; idStockOpnames?: string | null };

/**
 * Satu-satunya pintu penulisan mutasi stok. `qty` bertanda hanya untuk adjustment/opname;
 * jenis keluar (usage/damaged/expired) diberi tanda negatif otomatis dan tidak boleh melebihi saldo.
 */
export async function recordMovement(tx: Tx, actor: Actor | null, input: MovementInput) {
  const outflow = (OUTFLOW_TYPES as readonly string[]).includes(input.movementType);
  const signed = outflow ? -Math.abs(input.qty) : input.movementType === "adjustment" || input.movementType === "opname_adjustment" ? input.qty : Math.abs(input.qty);
  if (!Number.isFinite(signed) || signed === 0) fail("Kuantitas tidak boleh nol", { statusCode: 400 });
  const { mat, balance } = await lockedBalance(tx, input.idMaterials);
  if (!mat.isActive && input.movementType !== "opname_adjustment") fail("Bahan baku tidak aktif", { statusCode: 400 });
  if (balance + signed < 0) fail(`Stok tidak cukup. Saldo ${balance}, diminta ${Math.abs(signed)}`, { statusCode: 400 });
  const [row] = await tx.insert(SM).values({
    idMaterials: input.idMaterials, movementType: input.movementType, qtyDelta: round3(signed), idUsers: actor?.idUsers ?? null,
    movedAt: input.movedAt ?? new Date(), idGrItems: input.idGrItems ?? null, idStockOpnames: input.idStockOpnames ?? null, note: input.note ?? "",
  }).returning();
  await audit(tx, actor, "stock_movement", "stock_movements", row.idStockMovements, { type: input.movementType, qtyDelta: signed, material: input.idMaterials });
  return { ...row, balanceAfter: round3(balance + signed) };
}

export async function listMovements(db: Exec, idMaterials?: string, limit = 200) {
  return db
    .select({ ...getTableColumns(SM), materialName: M.materialName, sku: M.sku })
    .from(SM).innerJoin(M, eq(M.idMaterials, SM.idMaterials))
    .where(idMaterials ? eq(SM.idMaterials, idMaterials) : undefined)
    .orderBy(sql`${SM.movedAt} desc`).limit(limit);
}

export async function createOpname(tx: Tx, actor: Actor, input: { opnameDate?: string; note?: string; items: { idMaterials: string; countedQty: number }[] }) {
  if (input.items.length === 0) fail("Minimal satu bahan harus dihitung", { statusCode: 400 });
  const ids = input.items.map((i) => i.idMaterials);
  if (new Set(ids).size !== ids.length) fail("Bahan baku duplikat pada daftar opname", { statusCode: 400 });
  const opnameNumber = await nextNumber(tx, schema.stockOpnames.opnameNumber, "SO");
  const [op] = await tx.insert(schema.stockOpnames).values({ opnameNumber, opnameDate: input.opnameDate ?? today(), idUsers: actor.idUsers, note: input.note ?? "" }).returning();
  await tx.insert(schema.stockOpnameItems).values(input.items.map((i) => ({ idStockOpnames: op.idStockOpnames, idMaterials: i.idMaterials, countedQty: i.countedQty })));
  await audit(tx, actor, "opname_created", "stock_opnames", op.idStockOpnames, { items: input.items.length });
  return op;
}

/** Finalisasi: selisih (hitung − saldo) dicatat sebagai mutasi opname_adjustment, sehingga saldo tetap dari riwayat. */
export async function finalizeOpname(tx: Tx, actor: Actor, idStockOpnames: string) {
  const [op] = await tx.select().from(schema.stockOpnames).where(eq(schema.stockOpnames.idStockOpnames, idStockOpnames)).for("update");
  if (!op) fail("Stock opname tidak ditemukan", { statusCode: 404 });
  if (op.status !== "draft") fail("Stock opname sudah difinalisasi", { statusCode: 409 });
  const items = await tx.select().from(schema.stockOpnameItems).where(eq(schema.stockOpnameItems.idStockOpnames, idStockOpnames));
  const variances: { idMaterials: string; variance: number }[] = [];
  for (const it of items) {
    const { balance } = await lockedBalance(tx, it.idMaterials);
    const variance = round3(it.countedQty - balance);
    if (variance !== 0) {
      await recordMovement(tx, actor, { idMaterials: it.idMaterials, movementType: "opname_adjustment", qty: variance, idStockOpnames, note: `Selisih ${op.opnameNumber}` });
      variances.push({ idMaterials: it.idMaterials, variance });
    }
  }
  await tx.update(schema.stockOpnames).set({ status: "finalized", finalizedAt: new Date() }).where(eq(schema.stockOpnames.idStockOpnames, idStockOpnames));
  await audit(tx, actor, "opname_finalized", "stock_opnames", idStockOpnames, { variances });
  return { idStockOpnames, variances };
}

export async function listOpnames(db: Exec) {
  return db.select().from(schema.stockOpnames).orderBy(sql`${schema.stockOpnames.createdAt} desc`).limit(100);
}

/** Pemakaian rata-rata harian 30 hari terakhir (untuk ROP = d × L + SS). */
export async function avgDailyUsage(db: Exec, idMaterials: string, days = 30) {
  const [r] = await db.select({ s: sql<string>`coalesce(sum(-${SM.qtyDelta}), 0)` }).from(SM)
    .where(and(eq(SM.idMaterials, idMaterials), inArray(SM.movementType, [...OUTFLOW_TYPES]), sql`${SM.movedAt} >= now() - (${days} || ' days')::interval`));
  return round3(num(r?.s) / days);
}
