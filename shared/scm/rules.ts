export const ROLE_CODES = ["admin", "purchasing", "finance", "owner"] as const;
export type RoleCode = (typeof ROLE_CODES)[number];
export const ROLE_LABELS: Record<RoleCode, string> = { admin: "Admin", purchasing: "Purchasing", finance: "Keuangan", owner: "Owner" };

export const PR_STATUSES = ["submitted", "approved", "rejected", "ordered", "cancelled"] as const;
export type PrStatus = (typeof PR_STATUSES)[number];
export const PO_STATUSES = ["sent", "partial", "received", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const PAYMENT_STATUSES = ["pending_approval", "approved", "paid", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_METHODS = ["transfer", "cash", "giro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const INVOICE_STATUSES = ["recorded", "matched", "held"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const MOVEMENT_TYPES = ["opening_balance", "receipt", "usage", "damaged", "expired", "adjustment", "opname_adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const OUTFLOW_TYPES = ["usage", "damaged", "expired"] as const;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** Titik pemesanan ulang: ROP = (d × L) + SS (BAB II). */
export function reorderPoint(avgDailyUsage: number, leadTimeDays: number, safetyStock: number) {
  return round3(avgDailyUsage * leadTimeDays + safetyStock);
}
export function isBelowMinimum(balance: number, minStock: number) {
  return balance <= minStock;
}
export function stockStatus(balance: number, minStock: number): "ok" | "low" | "out" {
  if (balance <= 0) return "out";
  return isBelowMinimum(balance, minStock) ? "low" : "ok";
}

/** Status PO dari total dipesan vs total diterima (akseptasi), mendukung penerimaan parsial. */
export function poStatusFrom(ordered: number, accepted: number): PoStatus {
  return accepted >= ordered ? "received" : accepted > 0 ? "partial" : "sent";
}

/** Apakah pembayaran perlu persetujuan Owner (ambang kewenangan, FR-O3). */
export function paymentNeedsOwnerApproval(amount: number, threshold: number) {
  return amount > threshold;
}

/** Sisa tagihan = total invoice − pembayaran aktif (approved/paid/pending). */
export function remainingPayable(invoiceTotal: number, committedPayments: number) {
  return round2(invoiceTotal - committedPayments);
}

/** Pertumbuhan penjualan (%) periode ini vs sebelumnya. null bila periode sebelumnya 0. */
export function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}
