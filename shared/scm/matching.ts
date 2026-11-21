import { round2, round3 } from "./rules";

export type PoLine = { idPoItems: string; qtyOrdered: number; unitPrice: number };
export type InvoiceLine = { idPoItems: string; qtyInvoiced: number; unitPrice: number };
export type MatchIssue = { type: "unknown_item" | "qty_over_received" | "price_mismatch" | "no_receipt"; idPoItems: string; detail: string };
export type MatchResult = { matched: boolean; issues: MatchIssue[]; invoiceTotal: number };

/**
 * Three-way matching PO–Goods Receipt–Invoice:
 * (1) item invoice harus ada di PO, (2) kuantitas ditagih ≤ kuantitas diterima (accepted) − sudah ditagih sebelumnya,
 * (3) harga satuan invoice = harga PO.
 */
export function threeWayMatch(
  po: PoLine[],
  acceptedByItem: Record<string, number>,
  alreadyInvoicedByItem: Record<string, number>,
  invoice: InvoiceLine[],
): MatchResult {
  const issues: MatchIssue[] = [];
  const poMap = new Map(po.map((p) => [p.idPoItems, p]));
  for (const line of invoice) {
    const p = poMap.get(line.idPoItems);
    if (!p) {
      issues.push({ type: "unknown_item", idPoItems: line.idPoItems, detail: "Item tidak ada pada PO" });
      continue;
    }
    const accepted = acceptedByItem[line.idPoItems] ?? 0;
    if (accepted <= 0) issues.push({ type: "no_receipt", idPoItems: line.idPoItems, detail: "Belum ada penerimaan barang untuk item ini" });
    const billable = round3(accepted - (alreadyInvoicedByItem[line.idPoItems] ?? 0));
    if (line.qtyInvoiced > billable) issues.push({ type: "qty_over_received", idPoItems: line.idPoItems, detail: `Ditagih ${line.qtyInvoiced}, dapat ditagih ${Math.max(0, billable)}` });
    if (round2(line.unitPrice) !== round2(p.unitPrice)) issues.push({ type: "price_mismatch", idPoItems: line.idPoItems, detail: `Harga invoice ${line.unitPrice} ≠ harga PO ${p.unitPrice}` });
  }
  const invoiceTotal = round2(invoice.reduce((s, l) => s + l.qtyInvoiced * l.unitPrice, 0));
  return { matched: issues.length === 0 && invoice.length > 0, issues, invoiceTotal };
}
