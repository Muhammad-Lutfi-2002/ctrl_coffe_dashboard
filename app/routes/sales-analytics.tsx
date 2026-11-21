import { useState } from "react";

import { nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { TableShell } from "@/components/shared/table-shell";
import { BarList, Empty, KpiCard, LineChart, Section } from "@/components/scm/ui";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { formatDate, formatIDR, formatNumber } from "@/lib/format";

export function meta() {
  return [{ title: "Analitik Penjualan - CTRL Coffee" }];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function SalesAnalyticsRoute() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [idCategories, setCat] = useState("");
  const cats = useList<any[]>("list-categories");
  const d = useList<any>("get-sales-dashboard", { from, to, granularity, ...(idCategories ? { idCategories } : {}) }, from <= to);
  const s = d.data;
  const growth = s?.growthPercent;

  return (
    <PageBody>
      <PageHeader title="Analitik Penjualan" description="Dihitung langsung dari transaksi penjualan yang tersimpan (manual dan impor CSV). Pendapatan penjualan dibedakan dari pembelian supplier dan pengeluaran operasional." />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Dari<Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Sampai<Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" /></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Tren per<select className={`${nativeSelectClass} w-32`} value={granularity} onChange={(e) => setGranularity(e.target.value as any)}><option value="day">Hari</option><option value="week">Minggu</option><option value="month">Bulan</option></select></label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Kategori<select className={`${nativeSelectClass} w-44`} value={idCategories} onChange={(e) => setCat(e.target.value)}><option value="">Semua</option>{(cats.data ?? []).map((c) => <option key={c.idCategories} value={c.idCategories}>{c.categoryName}</option>)}</select></label>
      </div>
      {!s ? <p className="text-sm text-muted-foreground">Memuat…</p> : s.transactionCount === 0 && s.previous.transactionCount === 0 ? <Empty>Belum ada transaksi penjualan pada periode ini. Input atau impor data di halaman Data Penjualan.</Empty> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total pendapatan" value={formatIDR(s.totalRevenue)} />
            <KpiCard label="Jumlah transaksi" value={formatNumber(s.transactionCount)} hint={`${formatNumber(s.itemsSold)} item terjual`} />
            <KpiCard label="Rata-rata nilai transaksi" value={formatIDR(s.averageTransactionValue)} />
            <KpiCard label="Pertumbuhan vs periode sebelumnya" value={growth === null || growth === undefined ? "n/a" : `${growth > 0 ? "+" : ""}${growth}%`} tone={growth == null ? undefined : growth >= 0 ? "positive" : "negative"} hint={`Sebelumnya ${formatDate(s.previous.from)}–${formatDate(s.previous.to)}: ${formatIDR(s.previous.revenue)}`} />
          </div>
          <Section title="Tren penjualan"><div className="rounded-lg border border-border bg-card p-4"><LineChart points={s.trend.map((t: any) => ({ label: t.bucket, value: t.revenue }))} /></div></Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Produk terlaris (pendapatan)"><div className="rounded-lg border border-border bg-card p-4"><BarList rows={s.topProducts.map((p: any) => ({ label: p.productName, value: p.revenue }))} /></div></Section>
            <Section title="Perbandingan kategori"><div className="rounded-lg border border-border bg-card p-4"><BarList rows={s.byCategory.map((c: any) => ({ label: c.category, value: c.revenue }))} /></div></Section>
          </div>
          <Section title="Ringkasan produk terlaris">
            <TableShell><Table><TableHeader><TableRow><TableHead>Produk</TableHead><TableHead className="text-right">Jumlah terjual</TableHead><TableHead className="text-right">Pendapatan</TableHead></TableRow></TableHeader>
              <TableBody>{s.topProducts.map((p: any) => <TableRow key={p.idProducts}><TableCell className="font-medium">{p.productName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(p.qty)}</TableCell><TableCell className="text-right tabular-nums">{formatIDR(p.revenue)}</TableCell></TableRow>)}</TableBody></Table></TableShell>
          </Section>
        </>
      )}
    </PageBody>
  );
}
