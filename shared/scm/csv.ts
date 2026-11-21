import { round3 } from "./rules";

/** Parser CSV (RFC 4180 sederhana): kutip ganda, koma, newline di dalam kutip. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export type SalesCsvLine = { row: number; externalRef: string; trxDate: string; sku: string; qty: number; unitPrice: number | null };
export type SalesCsvError = { row: number; message: string };
export type SalesCsvParse = { transactions: { externalRef: string; trxDate: string; lines: SalesCsvLine[] }[]; errors: SalesCsvError[]; rowCount: number };

export const SALES_CSV_HEADER = ["external_ref", "trx_date", "sku", "qty", "unit_price"];

/** Validasi struktur dan nilai impor CSV penjualan. Baris valid dikelompokkan per external_ref. */
export function parseSalesCsv(text: string, knownSkus: ReadonlySet<string>): SalesCsvParse {
  const rows = parseCsv(text);
  const errors: SalesCsvError[] = [];
  if (rows.length === 0) return { transactions: [], errors: [{ row: 1, message: "Berkas kosong" }], rowCount: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  for (const required of ["external_ref", "trx_date", "sku", "qty"]) {
    if (idx(required) < 0) errors.push({ row: 1, message: `Kolom wajib "${required}" tidak ditemukan` });
  }
  if (errors.length) return { transactions: [], errors, rowCount: rows.length - 1 };

  const groups = new Map<string, { externalRef: string; trxDate: string; lines: SalesCsvLine[] }>();
  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const get = (n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? "").trim() : "");
    const externalRef = get("external_ref");
    const dateRaw = get("trx_date");
    const sku = get("sku");
    const qty = Number(get("qty"));
    const priceRaw = get("unit_price");
    const unitPrice = priceRaw === "" ? null : Number(priceRaw);
    const bad: string[] = [];
    if (!externalRef) bad.push("external_ref kosong");
    const parsedDate = new Date(dateRaw);
    if (!dateRaw || Number.isNaN(parsedDate.getTime())) bad.push("trx_date tidak valid");
    if (!sku) bad.push("sku kosong");
    else if (!knownSkus.has(sku)) bad.push(`SKU "${sku}" tidak ditemukan`);
    if (!Number.isFinite(qty) || qty <= 0) bad.push("qty harus > 0");
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) bad.push("unit_price tidak valid");
    if (bad.length) { errors.push({ row: rowNo, message: bad.join("; ") }); return; }
    const iso = parsedDate.toISOString();
    const g = groups.get(externalRef) ?? { externalRef, trxDate: iso, lines: [] };
    g.lines.push({ row: rowNo, externalRef, trxDate: iso, sku, qty: round3(qty), unitPrice });
    groups.set(externalRef, g);
  });
  return { transactions: [...groups.values()], errors, rowCount: rows.length - 1 };
}
