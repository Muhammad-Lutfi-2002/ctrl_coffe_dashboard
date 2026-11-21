import { useState } from "react";
import { Link, useParams } from "react-router";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, NumberInput, Section } from "@/components/scm/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatIDR, formatNumber, todayISO } from "@/lib/format";

export function meta() {
  return [{ title: "Perbandingan Penawaran - CTRL Coffee" }];
}

const CRITERIA: [string, string][] = [["price", "Harga"], ["performance", "Kinerja"], ["lead_time", "Lead time"], ["payment_term", "Syarat bayar"]];

export default function ProcurementRoute() {
  const { id = "" } = useParams();
  const { user } = useUser();
  const canWrite = user?.roleCode === "purchasing";
  const prs = useList<any[]>("list-purchase-requests");
  const cmp = useList<any>("compare-quotations", { idPurchaseRequests: id });
  const pos = useList<any[]>("list-purchase-orders");
  const suppliers = useList<any[]>("list-suppliers");
  const addQ = useRun("add-quotation"), select = useRun("select-supplier"), mkPo = useRun("create-purchase-order");
  const pr = (prs.data ?? []).find((p) => p.idPurchaseRequests === id);
  const po = (pos.data ?? []).find((p) => p.idPurchaseRequests === id && p.status !== "cancelled");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ idSuppliers: "", quotationDate: todayISO(), validUntil: "", leadTimeDays: "", paymentTermDays: "0" });
  const [prices, setPrices] = useState<Record<string, { unitPrice: string; minOrderQty: string }>>({});
  const [pick, setPick] = useState<any>(null);
  const [reason, setReason] = useState("");
  const items = cmp.data?.items ?? [];
  const quotes: any[] = cmp.data?.quotations ?? [];
  const rec = quotes.find((q) => q.recommended);
  const used = new Set(quotes.map((q) => q.idSuppliers));
  const w = cmp.data?.weights;
  const closeAdd = () => { setOpen(false); setPrices({}); setF({ idSuppliers: "", quotationDate: todayISO(), validUntil: "", leadTimeDays: "", paymentTermDays: "0" }); addQ.clearError(); };

  return (
    <PageBody>
      <PageHeader title={pr ? `Penawaran: ${pr.prNumber}` : "Penawaran supplier"} description="Bandingkan minimal dua penawaran. Skor SAW adalah rekomendasi; keputusan akhir tetap pada Purchasing dan alasan wajib dicatat bila memilih bukan skor tertinggi."
        actions={<><Link to="/purchase-requests" className="text-sm text-primary hover:underline">← Kembali</Link>{canWrite && pr?.status === "approved" ? <Button onClick={() => setOpen(true)}>Catat penawaran</Button> : null}</>} />
      {pr ? <div className="flex flex-wrap items-center gap-2 text-sm"><StatusBadge status={pr.status} /><span className="text-muted-foreground">Dibutuhkan {formatDate(pr.neededBy)} ·</span>{items.map((i: any) => <Badge key={i.idMaterials} variant="outline">{i.materialName}: {formatNumber(i.qty)} {i.unitName}</Badge>)}</div> : null}

      {quotes.length === 0 ? <Empty>Belum ada penawaran. Catat penawaran dari minimal dua supplier.</Empty> : (
        <Section title="Perbandingan penawaran" actions={w ? <span className="text-xs text-muted-foreground">Bobot: harga {w.price}% · kinerja {w.performance}% · lead time {w.lead_time}% · syarat bayar {w.payment_term}%</span> : undefined}>
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Total harga</TableHead><TableHead className="text-right">Kinerja</TableHead><TableHead className="text-right">Lead time</TableHead><TableHead className="text-right">Tempo bayar</TableHead>{CRITERIA.map(([k, l]) => <TableHead key={k} className="text-right">Skor {l.toLowerCase()}</TableHead>)}<TableHead className="text-right">Skor akhir</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{quotes.map((q) => (
              <TableRow key={q.idSupplierQuotations} className={q.isSelected ? "bg-secondary/60" : undefined}>
                <TableCell className="font-medium">{q.supplierName}{q.recommended ? <Badge className="ml-2" variant="outline">Rekomendasi</Badge> : null}{q.isSelected ? <Badge className="ml-2">Dipilih</Badge> : null}
                  {q.issues.length ? <div className="mt-1 text-xs text-destructive">{q.issues.join("; ")}</div> : null}{q.isSelected && q.selectionReason ? <div className="mt-1 text-xs text-muted-foreground">Alasan: {q.selectionReason}</div> : null}</TableCell>
                <TableCell className="text-right tabular-nums">{formatIDR(q.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{q.performance}{q.isNewSupplier ? "*" : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{q.leadTimeDays} hr</TableCell>
                <TableCell className="text-right tabular-nums">{q.paymentTermDays === 0 ? "Tunai" : `${q.paymentTermDays} hr`}</TableCell>
                {CRITERIA.map(([k]) => <TableCell key={k} className="text-right tabular-nums">{q.scores[k]}</TableCell>)}
                <TableCell className="text-right text-base font-semibold tabular-nums">{q.eligible ? q.totalScore : "-"}</TableCell>
                <TableCell className="text-right">{canWrite && pr?.status === "approved" && q.eligible && cmp.data?.canSelect ? <Button size="sm" variant={q.recommended ? "default" : "outline"} onClick={() => { setReason(""); select.clearError(); setPick(q); }}>Pilih</Button> : null}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></TableShell>
          <p className="text-xs text-muted-foreground">* Supplier belum memiliki riwayat penerimaan: memakai nilai awal. Harga per bahan:</p>
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>Bahan baku</TableHead>{quotes.map((q) => <TableHead key={q.idSupplierQuotations} className="text-right">{q.supplierName}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{items.map((it: any) => (<TableRow key={it.idMaterials}><TableCell>{it.materialName} ({formatNumber(it.qty)} {it.unitName})</TableCell>{quotes.map((q) => { const p = q.items.find((x: any) => x.idMaterials === it.idMaterials)?.unitPrice; return <TableCell key={q.idSupplierQuotations} className="text-right tabular-nums">{p == null ? "-" : formatIDR(p)}</TableCell>; })}</TableRow>))}</TableBody>
          </Table></TableShell>
          {!cmp.data?.canSelect ? <p className="text-sm text-destructive">Minimal dua penawaran diperlukan sebelum supplier dapat dipilih.</p> : null}
        </Section>
      )}

      {canWrite && pr?.status === "approved" && quotes.some((q) => q.isSelected) ? (
        <div className="flex items-center gap-3"><Button disabled={mkPo.pending} onClick={() => mkPo.run({ idPurchaseRequests: id })}>Buat Purchase Order dari penawaran terpilih</Button>{mkPo.error ? <span role="alert" className="text-sm text-destructive">{mkPo.error}</span> : null}</div>
      ) : null}
      {po ? <p className="text-sm">PO dibuat: <Link className="font-medium text-primary hover:underline" to="/purchase-orders">{po.poNumber}</Link> ({po.supplierName}, {formatIDR(po.total)})</p> : null}

      <FormDialog wide open={open} onOpenChange={(o) => !o && closeAdd()} title="Catat penawaran supplier" pending={addQ.pending} error={addQ.error}
        description="Penawaran harus mencakup seluruh item PR agar dapat dipilih. Satu supplier hanya satu penawaran per PR."
        onSubmit={async () => { await addQ.run({ idPurchaseRequests: id, idSuppliers: f.idSuppliers, quotationDate: f.quotationDate, validUntil: f.validUntil, leadTimeDays: Number(f.leadTimeDays), paymentTermDays: Number(f.paymentTermDays), items: items.filter((i: any) => prices[i.idMaterials]?.unitPrice !== undefined && prices[i.idMaterials]?.unitPrice !== "").map((i: any) => ({ idMaterials: i.idMaterials, unitPrice: Number(prices[i.idMaterials].unitPrice), minOrderQty: Number(prices[i.idMaterials].minOrderQty || 0) })) }); closeAdd(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="q-sup" label="Supplier"><select id="q-sup" required className={nativeSelectClass} value={f.idSuppliers} onChange={(e) => setF({ ...f, idSuppliers: e.target.value })}><option value="">Pilih…</option>{(suppliers.data ?? []).filter((s) => s.isActive && !used.has(s.idSuppliers)).map((s) => <option key={s.idSuppliers} value={s.idSuppliers}>{s.supplierName}</option>)}</select></Field>
          <Field id="q-date" label="Tanggal penawaran"><Input id="q-date" type="date" required value={f.quotationDate} onChange={(e) => setF({ ...f, quotationDate: e.target.value })} /></Field>
          <Field id="q-valid" label="Berlaku sampai"><Input id="q-valid" type="date" required min={f.quotationDate} value={f.validUntil} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></Field>
          <Field id="q-lead" label="Lead time (hari)"><NumberInput id="q-lead" required step="1" value={f.leadTimeDays} onChange={(v) => setF({ ...f, leadTimeDays: v })} /></Field>
          <Field id="q-term" label="Syarat pembayaran (hari, 0 = tunai)"><NumberInput id="q-term" required step="1" value={f.paymentTermDays} onChange={(v) => setF({ ...f, paymentTermDays: v })} /></Field>
        </div>
        <div className="flex flex-col gap-2">{items.map((i: any) => (
          <div key={i.idMaterials} className="grid grid-cols-[1fr_9rem_8rem] items-center gap-2">
            <span className="text-sm">{i.materialName} <span className="text-muted-foreground">({formatNumber(i.qty)} {i.unitName})</span></span>
            <NumberInput id={`p-${i.idMaterials}`} aria-label={`Harga satuan ${i.materialName}`} placeholder="Harga satuan" required value={prices[i.idMaterials]?.unitPrice ?? ""} onChange={(v) => setPrices({ ...prices, [i.idMaterials]: { unitPrice: v, minOrderQty: prices[i.idMaterials]?.minOrderQty ?? "" } })} />
            <NumberInput id={`m-${i.idMaterials}`} aria-label={`Minimal order ${i.materialName}`} placeholder="Min. order" value={prices[i.idMaterials]?.minOrderQty ?? ""} onChange={(v) => setPrices({ ...prices, [i.idMaterials]: { unitPrice: prices[i.idMaterials]?.unitPrice ?? "", minOrderQty: v } })} />
          </div>))}</div>
      </FormDialog>

      <FormDialog open={!!pick} onOpenChange={(o) => !o && setPick(null)} title={`Pilih ${pick?.supplierName ?? ""}`} submitLabel="Pilih supplier" pending={select.pending} error={select.error}
        description={pick && rec && pick.idSupplierQuotations !== rec.idSupplierQuotations ? `Supplier ini bukan rekomendasi skor tertinggi (${rec.supplierName}). Alasan pemilihan wajib diisi.` : "Supplier ini adalah rekomendasi skor tertinggi."}
        onSubmit={async () => { await select.run({ idSupplierQuotations: pick.idSupplierQuotations, reason }); setPick(null); }}>
        <Field id="sel-reason" label="Alasan pemilihan"><Input id="sel-reason" required={!!(pick && rec && pick.idSupplierQuotations !== rec.idSupplierQuotations)} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </FormDialog>
    </PageBody>
  );
}
