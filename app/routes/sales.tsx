import { useState } from "react";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, NumberInput } from "@/components/scm/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatIDR } from "@/lib/format";

export function meta() {
  return [{ title: "Data Penjualan - CTRL Coffee" }];
}

const TEMPLATE = "external_ref,trx_date,sku,qty,unit_price\nINV-0001,2026-11-01,LATTE,2,30000\n";

export default function SalesRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "admin";
  const sales = useList<any[]>("list-sales");
  const products = useList<any[]>("list-products");
  const create = useRun("create-sale"), imp = useRun("import-sales-csv");
  const [dlg, setDlg] = useState<null | "manual" | "csv">(null);
  const [lines, setLines] = useState<{ idProducts: string; qty: string }[]>([{ idProducts: "", qty: "1" }]);
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const close = () => { setDlg(null); setLines([{ idProducts: "", qty: "1" }]); setFile(null); setPreview(null); create.clearError(); imp.clearError(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const content = await f.text(); setFile({ name: f.name, content }); setPreview(null);
    try { setPreview(await imp.run({ fileName: f.name, content, dryRun: true })); } catch { /* galat ditampilkan */ }
  };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" })); a.download = "template-penjualan.csv"; a.click(); };

  return (
    <PageBody>
      <PageHeader title="Data Penjualan" description="Sumber data dashboard analitik: input manual atau impor CSV dari aplikasi kasir. Impor memvalidasi penuh dan mencegah duplikasi (berkas sama dan nomor transaksi sama)."
        actions={canWrite ? <><Button variant="outline" onClick={() => setDlg("csv")}>Impor CSV</Button><Button onClick={() => setDlg("manual")}>Input penjualan</Button></> : undefined} />
      {(sales.data ?? []).length === 0 ? <Empty>Belum ada transaksi penjualan.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Sumber</TableHead><TableHead>No. referensi</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
          <TableBody>{(sales.data ?? []).map((t) => (<TableRow key={t.idSalesTransactions}><TableCell>{formatDate(t.trxDate)}</TableCell><TableCell><Badge variant="outline">{t.source === "manual" ? "Manual" : "Impor CSV"}</Badge></TableCell><TableCell className="text-muted-foreground">{t.externalRef ?? "-"}</TableCell><TableCell className="text-right tabular-nums">{formatIDR(t.total)}</TableCell></TableRow>))}</TableBody>
        </Table></TableShell>
      )}

      <FormDialog wide open={dlg === "manual"} onOpenChange={(o) => !o && close()} title="Input transaksi penjualan" pending={create.pending} error={create.error}
        onSubmit={async () => { await create.run({ items: lines.filter((l) => l.idProducts && Number(l.qty) > 0).map((l) => ({ idProducts: l.idProducts, qty: Number(l.qty) })) }); close(); }}>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2">
            <select aria-label="Produk" className={nativeSelectClass} value={l.idProducts} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, idProducts: e.target.value } : x)))}><option value="">Pilih produk…</option>{(products.data ?? []).filter((p) => p.isActive).map((p) => <option key={p.idProducts} value={p.idProducts}>{p.productName} · {formatIDR(p.price)}</option>)}</select>
            <NumberInput id={`s-q-${i}`} aria-label="Jumlah" value={l.qty} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: v } : x)))} min={0.001} />
            <Button type="button" variant="ghost" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>Hapus</Button>
          </div>))}
        <Button type="button" variant="outline" onClick={() => setLines([...lines, { idProducts: "", qty: "1" }])}>Tambah item</Button>
      </FormDialog>

      <FormDialog wide open={dlg === "csv"} onOpenChange={(o) => !o && close()} title="Impor penjualan dari CSV" submitLabel="Impor" pending={imp.pending} error={imp.error}
        description="Kolom: external_ref, trx_date, sku, qty, unit_price (opsional; kosong = harga produk). Baris dengan external_ref sama digabung menjadi satu transaksi."
        onSubmit={async () => { if (!file) return; await imp.run({ fileName: file.name, content: file.content }); close(); }}>
        <div className="flex items-center gap-3"><Input type="file" accept=".csv,text/csv" onChange={onFile} aria-label="Berkas CSV" /><Button type="button" variant="outline" onClick={download}>Unduh templat</Button></div>
        {preview ? (
          <div className="rounded-md border border-border p-3 text-sm">
            <p>Baris data: <b>{preview.rowCount}</b> · Transaksi: <b>{preview.transactionCount}</b> · Akan diimpor: <b>{preview.willImport}</b> · Duplikat dilewati: <b>{preview.duplicates}</b></p>
            {preview.errors.length ? <><p className="mt-2 font-medium text-destructive">Berkas ditolak — perbaiki baris berikut lalu unggah ulang:</p><ul className="mt-1 list-disc pl-5 text-destructive">{preview.errors.slice(0, 15).map((e: any, i: number) => <li key={i}>Baris {e.row}: {e.message}</li>)}</ul></> : <p className="mt-2 text-primary">Berkas valid.</p>}
          </div>
        ) : null}
      </FormDialog>
    </PageBody>
  );
}
