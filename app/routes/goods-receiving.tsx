import { useState } from "react";

import { Field } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, NumberInput, Section } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/format";

export function meta() {
  return [{ title: "Penerimaan Barang - CTRL Coffee" }];
}

export default function GoodsReceivingRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "admin";
  const pos = useList<any[]>("list-purchase-orders");
  const receipts = useList<any[]>("list-goods-receipts");
  const receive = useRun("receive-goods");
  const [po, setPo] = useState<any>(null);
  const [q, setQ] = useState<Record<string, { ok: string; bad: string }>>({});
  const [note, setNote] = useState("");
  const open = (pos.data ?? []).filter((p) => p.status === "sent" || p.status === "partial");
  const close = () => { setPo(null); setQ({}); setNote(""); receive.clearError(); };

  return (
    <PageBody>
      <PageHeader title="Penerimaan Barang" description="Admin mencatat penerimaan terhadap PO (boleh parsial). Hanya jumlah diterima yang masuk stok, lewat mutasi stok; selisih terhadap PO tercatat." />
      <Section title="PO menunggu penerimaan">
        {open.length === 0 ? <Empty>Tidak ada PO yang menunggu penerimaan.</Empty> : (
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>PO</TableHead><TableHead>Supplier</TableHead><TableHead>Janji tiba</TableHead><TableHead>Sisa</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{open.map((p) => (
              <TableRow key={p.idPurchaseOrders}><TableCell className="font-medium">{p.poNumber}</TableCell><TableCell>{p.supplierName}</TableCell><TableCell>{formatDate(p.expectedDate)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.items.filter((l: any) => l.remaining > 0).map((l: any) => `${l.materialName} ${formatNumber(l.remaining)} ${l.unitName}`).join(", ")}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">{canWrite ? <Button size="sm" onClick={() => setPo(p)}>Catat penerimaan</Button> : null}</TableCell></TableRow>
            ))}</TableBody>
          </Table></TableShell>
        )}
      </Section>
      <Section title="Riwayat penerimaan">
        {(receipts.data ?? []).length === 0 ? <Empty>Belum ada penerimaan.</Empty> : (
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>PO</TableHead><TableHead>Diterima</TableHead><TableHead>Penerima</TableHead><TableHead>Catatan</TableHead></TableRow></TableHeader>
            <TableBody>{(receipts.data ?? []).map((r) => (<TableRow key={r.idGoodsReceipts}><TableCell className="font-medium">{r.grNumber}</TableCell><TableCell>{r.poNumber}</TableCell><TableCell>{formatDate(r.receivedAt)}</TableCell><TableCell>{r.receiverName}</TableCell><TableCell className="text-muted-foreground">{r.note}</TableCell></TableRow>))}</TableBody>
          </Table></TableShell>
        )}
      </Section>

      <FormDialog wide open={!!po} onOpenChange={(o) => !o && close()} title={`Penerimaan ${po?.poNumber ?? ""}`} pending={receive.pending} error={receive.error}
        description="Isi jumlah yang diterima baik dan yang ditolak per item. Jumlah diterima tidak boleh melebihi sisa PO."
        onSubmit={async () => { await receive.run({ idPurchaseOrders: po.idPurchaseOrders, note, items: po.items.map((l: any) => ({ idPoItems: l.idPoItems, qtyAccepted: Number(q[l.idPoItems]?.ok || 0), qtyRejected: Number(q[l.idPoItems]?.bad || 0) })).filter((i: any) => i.qtyAccepted > 0 || i.qtyRejected > 0) }); close(); }}>
        <Table><TableHeader><TableRow><TableHead>Bahan baku</TableHead><TableHead className="text-right">Sisa PO</TableHead><TableHead className="w-32">Diterima</TableHead><TableHead className="w-32">Ditolak</TableHead></TableRow></TableHeader>
          <TableBody>{(po?.items ?? []).map((l: any) => (
            <TableRow key={l.idPoItems}><TableCell>{l.materialName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(l.remaining)} {l.unitName}</TableCell>
              <TableCell><NumberInput id={`ok-${l.idPoItems}`} aria-label={`Diterima ${l.materialName}`} value={q[l.idPoItems]?.ok ?? ""} onChange={(v) => setQ({ ...q, [l.idPoItems]: { ok: v, bad: q[l.idPoItems]?.bad ?? "" } })} /></TableCell>
              <TableCell><NumberInput id={`bad-${l.idPoItems}`} aria-label={`Ditolak ${l.materialName}`} value={q[l.idPoItems]?.bad ?? ""} onChange={(v) => setQ({ ...q, [l.idPoItems]: { ok: q[l.idPoItems]?.ok ?? "", bad: v } })} /></TableCell></TableRow>
          ))}</TableBody></Table>
        <Field id="gr-note" label="Catatan"><Input id="gr-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </FormDialog>
    </PageBody>
  );
}
