import { createHash } from "node:crypto";

import { fail } from "@agent-native/core/action";
import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { parseSalesCsv } from "../../shared/scm/csv.js";
import { growthPercent, round2, round3 } from "../../shared/scm/rules.js";
import { schema } from "../db.js";
import { audit, num, type Actor, type Exec, type Tx } from "./common.js";

const S = schema;

export async function createSale(tx: Tx, actor: Actor, input: { trxDate?: string; items: { idProducts: string; qty: number; unitPrice?: number }[] }) {
  if (input.items.length === 0) fail("Transaksi minimal memiliki satu item", { statusCode: 400 });
  const prods = await tx.select().from(S.products).where(inArray(S.products.idProducts, input.items.map((i) => i.idProducts)));
  const map = new Map(prods.map((p) => [p.idProducts, p]));
  if (input.items.some((i) => !map.has(i.idProducts))) fail("Produk tidak ditemukan", { statusCode: 404 });
  const [trx] = await tx.insert(S.salesTransactions).values({ trxDate: input.trxDate ? new Date(input.trxDate) : new Date(), source: "manual", idUsers: actor.idUsers }).returning();
  await tx.insert(S.salesItems).values(input.items.map((i) => ({ idSalesTransactions: trx.idSalesTransactions, idProducts: i.idProducts, qty: i.qty, unitPrice: i.unitPrice ?? map.get(i.idProducts)!.price })));
  await audit(tx, actor, "sale_recorded", "sales_transactions", trx.idSalesTransactions, { items: input.items.length });
  return trx;
}

/** Impor CSV: validasi penuh dulu (semua-atau-tidak sama sekali), cegah impor ganda (hash berkas + external_ref), catat batch/sumber. */
export async function importSalesCsv(tx: Tx, actor: Actor, input: { fileName: string; content: string; dryRun?: boolean }) {
  const fileHash = createHash("sha256").update(input.content).digest("hex");
  const [dupFile] = await tx.select().from(S.salesImportBatches).where(eq(S.salesImportBatches.fileHash, fileHash));
  if (dupFile) fail(`Berkas yang sama sudah pernah diimpor (${dupFile.fileName}, ${dupFile.importedAt.toISOString().slice(0, 10)})`, { statusCode: 409 });
  const prods = await tx.select().from(S.products);
  const bySku = new Map(prods.map((p) => [p.sku, p]));
  const parsed = parseSalesCsv(input.content, new Set(bySku.keys()));
  const refs = parsed.transactions.map((t) => t.externalRef);
  const existing = refs.length ? await tx.select({ r: S.salesTransactions.externalRef }).from(S.salesTransactions).where(and(eq(S.salesTransactions.source, "csv_import"), inArray(S.salesTransactions.externalRef, refs))) : [];
  const existingRefs = new Set(existing.map((e) => e.r));
  const toImport = parsed.transactions.filter((t) => !existingRefs.has(t.externalRef));
  const summary = { rowCount: parsed.rowCount, errors: parsed.errors, transactionCount: parsed.transactions.length, willImport: toImport.length, duplicates: existingRefs.size, imported: 0 };
  if (parsed.errors.length > 0 || input.dryRun) return summary;
  const [batch] = await tx.insert(S.salesImportBatches).values({ fileName: input.fileName, fileHash, rowCount: parsed.rowCount, importedCount: toImport.length, skippedCount: existingRefs.size, idUsers: actor.idUsers }).returning();
  for (const t of toImport) {
    const [trx] = await tx.insert(S.salesTransactions).values({ trxDate: new Date(t.trxDate), source: "csv_import", externalRef: t.externalRef, idSalesImportBatches: batch.idSalesImportBatches, idUsers: actor.idUsers }).returning();
    await tx.insert(S.salesItems).values(t.lines.map((l) => ({ idSalesTransactions: trx.idSalesTransactions, idProducts: bySku.get(l.sku)!.idProducts, qty: l.qty, unitPrice: l.unitPrice ?? bySku.get(l.sku)!.price })));
  }
  await audit(tx, actor, "sales_imported", "sales_import_batches", batch.idSalesImportBatches, { file: input.fileName, imported: toImport.length, skipped: existingRefs.size });
  return { ...summary, imported: toImport.length };
}

export async function listSales(db: Exec, limit = 100) {
  const trx = await db.select({ ...getTableColumns(S.salesTransactions), total: sql<string>`coalesce((select sum(i.qty * i.unit_price) from sales_items i where i.id_sales_transactions = ${S.salesTransactions.idSalesTransactions}), 0)` })
    .from(S.salesTransactions).orderBy(desc(S.salesTransactions.trxDate)).limit(limit);
  return trx.map((t) => ({ ...t, total: num(t.total) }));
}

export type Granularity = "day" | "week" | "month";
export type SalesFilter = { from: string; to: string; granularity: Granularity; idCategories?: string };

const TZ = sql.raw("'Asia/Jakarta'");  // literal (bukan parameter) agar GROUP BY identik dengan SELECT

async function periodAggregate(db: Exec, from: string, to: string, idCategories?: string) {
  const cond = and(sql`(${S.salesTransactions.trxDate} at time zone ${TZ})::date >= ${from}::date`, sql`(${S.salesTransactions.trxDate} at time zone ${TZ})::date <= ${to}::date`, idCategories ? eq(S.products.idCategories, idCategories) : undefined);
  const [r] = await db.select({ revenue: sql<string>`coalesce(sum(${S.salesItems.qty} * ${S.salesItems.unitPrice}), 0)`, trx: sql<number>`count(distinct ${S.salesTransactions.idSalesTransactions})::int`, qty: sql<string>`coalesce(sum(${S.salesItems.qty}), 0)` })
    .from(S.salesItems).innerJoin(S.salesTransactions, eq(S.salesTransactions.idSalesTransactions, S.salesItems.idSalesTransactions)).innerJoin(S.products, eq(S.products.idProducts, S.salesItems.idProducts)).where(cond);
  return { revenue: round2(num(r?.revenue)), transactionCount: r?.trx ?? 0, itemsSold: round3(num(r?.qty)) };
}

/** Semua metrik dihitung langsung dari sales_transactions + sales_items (tanpa data dummy). */
export async function salesDashboard(db: Exec, f: SalesFilter) {
  const days = Math.max(1, Math.round((Date.parse(f.to) - Date.parse(f.from)) / 86400000) + 1);
  const prevTo = new Date(Date.parse(f.from) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(f.from) - days * 86400000).toISOString().slice(0, 10);
  const cur = await periodAggregate(db, f.from, f.to, f.idCategories);
  const prev = await periodAggregate(db, prevFrom, prevTo, f.idCategories);
  const range = and(sql`(${S.salesTransactions.trxDate} at time zone ${TZ})::date >= ${f.from}::date`, sql`(${S.salesTransactions.trxDate} at time zone ${TZ})::date <= ${f.to}::date`, f.idCategories ? eq(S.products.idCategories, f.idCategories) : undefined);
  const bucket = sql<string>`to_char(date_trunc(${sql.raw(`'${f.granularity}'`)}, ${S.salesTransactions.trxDate} at time zone ${TZ}), 'YYYY-MM-DD')`;
  const trend = await db.select({ bucket, revenue: sql<string>`sum(${S.salesItems.qty} * ${S.salesItems.unitPrice})`, trx: sql<number>`count(distinct ${S.salesTransactions.idSalesTransactions})::int` })
    .from(S.salesItems).innerJoin(S.salesTransactions, eq(S.salesTransactions.idSalesTransactions, S.salesItems.idSalesTransactions)).innerJoin(S.products, eq(S.products.idProducts, S.salesItems.idProducts)).where(range).groupBy(bucket).orderBy(bucket);
  const top = await db.select({ idProducts: S.products.idProducts, productName: S.products.productName, qty: sql<string>`sum(${S.salesItems.qty})`, revenue: sql<string>`sum(${S.salesItems.qty} * ${S.salesItems.unitPrice})` })
    .from(S.salesItems).innerJoin(S.salesTransactions, eq(S.salesTransactions.idSalesTransactions, S.salesItems.idSalesTransactions)).innerJoin(S.products, eq(S.products.idProducts, S.salesItems.idProducts)).where(range)
    .groupBy(S.products.idProducts).orderBy(sql`sum(${S.salesItems.qty} * ${S.salesItems.unitPrice}) desc`).limit(10);
  const byCategory = await db.select({ category: S.categories.categoryName, revenue: sql<string>`sum(${S.salesItems.qty} * ${S.salesItems.unitPrice})` })
    .from(S.salesItems).innerJoin(S.salesTransactions, eq(S.salesTransactions.idSalesTransactions, S.salesItems.idSalesTransactions)).innerJoin(S.products, eq(S.products.idProducts, S.salesItems.idProducts)).innerJoin(S.categories, eq(S.categories.idCategories, S.products.idCategories))
    .where(range).groupBy(S.categories.categoryName).orderBy(sql`sum(${S.salesItems.qty} * ${S.salesItems.unitPrice}) desc`);
  return {
    filter: f, previous: { from: prevFrom, to: prevTo, ...prev },
    totalRevenue: cur.revenue, transactionCount: cur.transactionCount, itemsSold: cur.itemsSold,
    averageTransactionValue: cur.transactionCount ? round2(cur.revenue / cur.transactionCount) : 0,
    growthPercent: growthPercent(cur.revenue, prev.revenue),
    trend: trend.map((t) => ({ bucket: t.bucket, revenue: round2(num(t.revenue)), transactions: t.trx })),
    topProducts: top.map((t) => ({ idProducts: t.idProducts, productName: t.productName, qty: round3(num(t.qty)), revenue: round2(num(t.revenue)) })),
    byCategory: byCategory.map((c) => ({ category: c.category, revenue: round2(num(c.revenue)) })),
  };
}
