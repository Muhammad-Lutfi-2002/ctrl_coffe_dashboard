const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("id-ID");
const date = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatIDR = (value: number) => currency.format(value);
export const formatNumber = (value: number) => number.format(value);

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? "-" : date.format(parsed);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function errorMessage(error: unknown, fallback = "Gagal menyimpan data") {
  return error instanceof Error && error.message ? error.message : fallback;
}
