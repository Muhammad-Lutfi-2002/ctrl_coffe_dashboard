import { describe, expect, it } from "vitest";

import { parseCsv, parseSalesCsv } from "./csv";
import { threeWayMatch } from "./matching";
import { growthPercent, paymentNeedsOwnerApproval, poStatusFrom, reorderPoint, stockStatus } from "./rules";
import { computeSaw, DEFAULT_WEIGHTS, validateWeights } from "./saw";

describe("SAW (contoh BAB III skripsi)", () => {
  // Harga Rp/kg: A 120.000, B 115.000, C 125.000 (kuantitas sama) — kinerja 90/80/95 — lead time 2/4/1 — tempo 7/14/0
  const quotes = [
    { id: "A", total: 120000, leadTimeDays: 2, paymentTermDays: 7, performance: 90, complete: true },
    { id: "B", total: 115000, leadTimeDays: 4, paymentTermDays: 14, performance: 80, complete: true },
    { id: "C", total: 125000, leadTimeDays: 1, paymentTermDays: 0, performance: 95, complete: true },
  ];
  it("menghasilkan skor akhir 78,33 / 80,00 / 80,55 dan merekomendasikan C", () => {
    const r = computeSaw(quotes, DEFAULT_WEIGHTS);
    const by = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(by.A.total).toBe(78.33);
    expect(by.B.total).toBe(80);
    expect(by.C.total).toBe(80.55);
    expect(by.C.recommended).toBe(true);
    expect(by.A.scores.price).toBe(95.83);
    expect(by.C.scores.payment_term).toBe(0);
  });
  it("penawaran tidak lengkap tidak direkomendasikan", () => {
    const r = computeSaw([...quotes.slice(0, 2), { ...quotes[2], complete: false }]);
    expect(r.find((x) => x.id === "C")!.recommended).toBe(false);
    expect(r.find((x) => x.id === "A")!.recommended).toBe(true);
  });
  it("bobot harus berjumlah 100", () => {
    expect(validateWeights(DEFAULT_WEIGHTS).ok).toBe(true);
    expect(validateWeights({ ...DEFAULT_WEIGHTS, price: 50 }).ok).toBe(false);
  });
  it("seri: lead time lebih pendek diutamakan", () => {
    const r = computeSaw([
      { id: "X", total: 100, leadTimeDays: 3, paymentTermDays: 0, performance: 80, complete: true },
      { id: "Y", total: 100, leadTimeDays: 3, paymentTermDays: 0, performance: 80, complete: true },
    ]);
    expect(r.filter((x) => x.recommended)).toHaveLength(1);
  });
});

describe("three-way matching", () => {
  const po = [{ idPoItems: "i1", qtyOrdered: 10, unitPrice: 1000 }];
  it("cocok bila qty ≤ diterima dan harga sama", () => {
    const r = threeWayMatch(po, { i1: 6 }, {}, [{ idPoItems: "i1", qtyInvoiced: 6, unitPrice: 1000 }]);
    expect(r.matched).toBe(true);
    expect(r.invoiceTotal).toBe(6000);
  });
  it("menolak bila qty melebihi penerimaan, harga beda, atau belum diterima", () => {
    const over = threeWayMatch(po, { i1: 6 }, {}, [{ idPoItems: "i1", qtyInvoiced: 8, unitPrice: 1000 }]);
    expect(over.issues.map((i) => i.type)).toContain("qty_over_received");
    const price = threeWayMatch(po, { i1: 6 }, {}, [{ idPoItems: "i1", qtyInvoiced: 6, unitPrice: 1100 }]);
    expect(price.issues.map((i) => i.type)).toContain("price_mismatch");
    const none = threeWayMatch(po, {}, {}, [{ idPoItems: "i1", qtyInvoiced: 1, unitPrice: 1000 }]);
    expect(none.issues.map((i) => i.type)).toContain("no_receipt");
  });
  it("memperhitungkan tagihan sebelumnya (pembayaran bertahap)", () => {
    const r = threeWayMatch(po, { i1: 6 }, { i1: 4 }, [{ idPoItems: "i1", qtyInvoiced: 3, unitPrice: 1000 }]);
    expect(r.matched).toBe(false);
  });
});

describe("aturan stok, PO, pembayaran, pertumbuhan", () => {
  it("ROP dan status stok", () => {
    expect(reorderPoint(2, 3, 4)).toBe(10);
    expect(stockStatus(0, 5)).toBe("out");
    expect(stockStatus(5, 5)).toBe("low");
    expect(stockStatus(6, 5)).toBe("ok");
  });
  it("status PO untuk penerimaan parsial", () => {
    expect(poStatusFrom(10, 0)).toBe("sent");
    expect(poStatusFrom(10, 4)).toBe("partial");
    expect(poStatusFrom(10, 10)).toBe("received");
  });
  it("ambang persetujuan pembayaran dan pertumbuhan", () => {
    expect(paymentNeedsOwnerApproval(5_000_001, 5_000_000)).toBe(true);
    expect(paymentNeedsOwnerApproval(5_000_000, 5_000_000)).toBe(false);
    expect(growthPercent(120, 100)).toBe(20);
    expect(growthPercent(5, 0)).toBeNull();
  });
});

describe("CSV penjualan", () => {
  it("parser menangani kutip dan baris kosong", () => {
    expect(parseCsv('a,b\n"x,1",2\n\n')).toEqual([["a", "b"], ["x,1", "2"]]);
  });
  it("memvalidasi dan mengelompokkan per external_ref", () => {
    const csv = "external_ref,trx_date,sku,qty,unit_price\nT1,2026-11-01,KOPI,2,25000\nT1,2026-11-01,TEH,1,\nT2,bukan-tanggal,KOPI,1,1\nT3,2026-11-02,XXX,1,1\nT4,2026-11-02,KOPI,0,1";
    const r = parseSalesCsv(csv, new Set(["KOPI", "TEH"]));
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0].lines).toHaveLength(2);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5, 6]);
  });
  it("menolak berkas tanpa kolom wajib", () => {
    expect(parseSalesCsv("a,b\n1,2", new Set()).errors.length).toBeGreaterThan(0);
  });
});
