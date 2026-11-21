import { round2 } from "./rules";

export type SawCriterion = "price" | "performance" | "lead_time" | "payment_term";
export type SawWeights = Record<SawCriterion, number>;
export const DEFAULT_WEIGHTS: SawWeights = { price: 40, performance: 25, lead_time: 20, payment_term: 15 };

export type SawQuotation = {
  id: string;
  total: number; // total harga penawaran = Σ qty PR × harga satuan
  leadTimeDays: number;
  paymentTermDays: number; // 0 = tunai
  performance: number; // 0..100 (riwayat) atau nilai awal supplier baru
  complete: boolean; // seluruh item PR tercakup
};
export type SawScore = {
  id: string;
  scores: Record<SawCriterion, number>;
  total: number;
  rank: number;
  recommended: boolean;
  eligible: boolean;
};

export function validateWeights(w: SawWeights) {
  const sum = round2(Object.values(w).reduce((a, b) => a + b, 0));
  const negative = Object.values(w).some((v) => v < 0 || v > 100);
  return { ok: sum === 100 && !negative, sum };
}

/**
 * SAW sesuai BAB III: harga = (total terendah ÷ total) × 100; kinerja = nilai riwayat (0–100);
 * lead time = (terendah ÷ lead time) × 100 dengan lead time minimal 1 hari;
 * syarat bayar = (tempo ÷ tempo terpanjang) × 100, semua tunai = 100.
 * Hanya penawaran lengkap yang dinormalisasi dan layak direkomendasikan.
 */
export function computeSaw(quotes: SawQuotation[], weights: SawWeights = DEFAULT_WEIGHTS): SawScore[] {
  const eligible = quotes.filter((q) => q.complete);
  const minTotal = Math.min(...eligible.map((q) => q.total));
  const lt = (q: SawQuotation) => Math.max(1, q.leadTimeDays);
  const minLt = Math.min(...eligible.map(lt));
  const maxTerm = Math.max(...eligible.map((q) => q.paymentTermDays));

  const rows: SawScore[] = quotes.map((q) => {
    const scores: Record<SawCriterion, number> = {
      price: q.total <= 0 ? 100 : round2((minTotal / q.total) * 100),
      performance: round2(Math.min(100, Math.max(0, q.performance))),
      lead_time: round2((minLt / lt(q)) * 100),
      payment_term: maxTerm === 0 ? 100 : round2((q.paymentTermDays / maxTerm) * 100),
    };
    const total = round2(
      (weights.price * scores.price + weights.performance * scores.performance + weights.lead_time * scores.lead_time + weights.payment_term * scores.payment_term) / 100,
    );
    return { id: q.id, scores, total, rank: 0, recommended: false, eligible: q.complete };
  });

  const byId = new Map(quotes.map((q) => [q.id, q]));
  const ranked = rows
    .filter((r) => r.eligible)
    .sort((a, b) => b.total - a.total || lt(byId.get(a.id)!) - lt(byId.get(b.id)!) || byId.get(a.id)!.total - byId.get(b.id)!.total);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
    r.recommended = i === 0;
  });
  return rows;
}
