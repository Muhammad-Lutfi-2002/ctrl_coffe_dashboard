import { eq, sql } from "drizzle-orm";

import { schema } from "../db.js";
import { type Exec } from "./common.js";
import { financeReport } from "./finance.js";
import { lowStock } from "./inventory.js";
import { supplierPerformance } from "./procurement.js";

const S = schema;

/** Ringkasan operasional (angka dari tabel transaksi). Tiap peran hanya menerima bagian yang menjadi kewenangannya. */
export async function operationalSummary(db: Exec, role: string, period = new Date().toISOString().slice(0, 7)) {
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const is = (...r: string[]) => r.includes(role);
  // Semua query dijalankan paralel: latensi total = query terlama, bukan jumlah seluruh query.
  const [low, prPending, prAwaitingQuotation, poOpen, paymentsPendingApproval, invoicesToVerify, finance, performance, invoicesHeld] = await Promise.all([
    is("admin", "purchasing", "owner") ? lowStock(db) : undefined,
    is("purchasing", "owner", "admin") ? count(db.select({ n: sql<number>`count(*)::int` }).from(S.purchaseRequests).where(eq(S.purchaseRequests.status, "submitted"))) : undefined,
    is("purchasing", "owner", "admin") ? count(db.select({ n: sql<number>`count(*)::int` }).from(S.purchaseRequests).where(eq(S.purchaseRequests.status, "approved"))) : undefined,
    is("purchasing", "owner", "admin") ? count(db.select({ n: sql<number>`count(*)::int` }).from(S.purchaseOrders).where(sql`${S.purchaseOrders.status} in ('sent','partial')`)) : undefined,
    is("finance", "owner") ? count(db.select({ n: sql<number>`count(*)::int` }).from(S.payments).where(eq(S.payments.status, "pending_approval"))) : undefined,
    is("finance", "owner") ? count(db.select({ n: sql<number>`count(*)::int` }).from(S.supplierInvoices).where(sql`${S.supplierInvoices.status} in ('recorded','held')`)) : undefined,
    is("finance", "owner") ? financeReport(db, period) : undefined,
    is("owner", "purchasing") ? supplierPerformance(db) : undefined,
    role === "owner" ? count(db.select({ n: sql<number>`count(*)::int` }).from(S.supplierInvoices).where(eq(S.supplierInvoices.status, "held"))) : undefined,
  ]);
  const out: Record<string, unknown> = { role };
  if (low) { out.lowStock = low.slice(0, 10); out.lowStockCount = low.length; }
  if (prPending !== undefined) { out.prPending = prPending; out.prAwaitingQuotation = prAwaitingQuotation; out.poOpen = poOpen; }
  if (paymentsPendingApproval !== undefined) { out.paymentsPendingApproval = paymentsPendingApproval; out.invoicesToVerify = invoicesToVerify; out.finance = finance; }
  if (performance) out.supplierPerformance = [...performance].sort((a, b) => b.performance - a.performance);
  if (invoicesHeld !== undefined) out.invoicesHeld = invoicesHeld;
  return out;
}
