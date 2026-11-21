import { eq, sql } from "drizzle-orm";

import { schema } from "../db.js";
import { type Exec } from "./common.js";
import { financeReport } from "./finance.js";
import { lowStock } from "./inventory.js";
import { supplierPerformance } from "./procurement.js";

const S = schema;

/** Ringkasan operasional (angka dari tabel transaksi). Tiap peran hanya menerima bagian yang menjadi kewenangannya. */
export async function operationalSummary(db: Exec, role: string, period = new Date().toISOString().slice(0, 7)) {
  const out: Record<string, unknown> = { role };
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  if (["admin", "purchasing", "owner"].includes(role)) {
    const low = await lowStock(db);
    out.lowStock = low.slice(0, 10); out.lowStockCount = low.length;
  }
  if (["purchasing", "owner", "admin"].includes(role)) {
    out.prPending = await count(db.select({ n: sql<number>`count(*)::int` }).from(S.purchaseRequests).where(eq(S.purchaseRequests.status, "submitted")));
    out.prAwaitingQuotation = await count(db.select({ n: sql<number>`count(*)::int` }).from(S.purchaseRequests).where(eq(S.purchaseRequests.status, "approved")));
    out.poOpen = await count(db.select({ n: sql<number>`count(*)::int` }).from(S.purchaseOrders).where(sql`${S.purchaseOrders.status} in ('sent','partial')`));
  }
  if (["finance", "owner"].includes(role)) {
    out.paymentsPendingApproval = await count(db.select({ n: sql<number>`count(*)::int` }).from(S.payments).where(eq(S.payments.status, "pending_approval")));
    out.invoicesToVerify = await count(db.select({ n: sql<number>`count(*)::int` }).from(S.supplierInvoices).where(sql`${S.supplierInvoices.status} in ('recorded','held')`));
    out.finance = await financeReport(db, period);
  }
  if (role === "owner" || role === "purchasing") out.supplierPerformance = (await supplierPerformance(db)).sort((a, b) => b.performance - a.performance);
  if (role === "owner") {
    const [bad] = await db.select({ n: sql<number>`count(*)::int` }).from(S.supplierInvoices).where(eq(S.supplierInvoices.status, "held"));
    out.invoicesHeld = bad?.n ?? 0;
  }
  return out;
}
