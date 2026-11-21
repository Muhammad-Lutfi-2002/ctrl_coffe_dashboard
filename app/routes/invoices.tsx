import { useState } from "react";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { TableShell } from "@/components/shared/table-shell";
import { Badge } from "@/components/ui/badge";
import { Empty, FormDialog, NumberInput } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatIDR, formatNumber, todayISO } from "@/lib/format";

export function meta() {
  return [{ title: "Invoice Supplier - CTRL Coffee" }];
}

const STATE: Record<string, string> = { recorded: "Belum diverifikasi", matched: "Sesuai (3-way)", held: "Ditahan" };

export default function InvoicesRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "finance";
  const invoices = useList<any[]>("list-invoices");
  const pos = useList<any[]>("list-purchase-orders");
  const record = useRun("record-invoice"), verify = useRun("verify-invoice");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ idPurchaseOrders: "", invoiceNumber: "", invoiceDate: todayISO(), dueDate: todayISO() });
  const [lines, setLines] = useState<Record<string, { qty: string; price: string }>>({});
  const [result, setResult] = useState<any>(null);
  const po = (pos.data ?? []).find((p) => p.idPurchaseOrders === f.idPurchaseOrders);
  const eligible = (pos.data ?? []).filter((p) => p.status !== "cancelled" && p.items.some((l: any) => l.qtyAccepted > 0));
  const pickPo = (id: string) => {
    setF({ ...f, idPurchaseOrders: id });
    const p = (pos.data ?? []).find((x) => x.idPurchaseOrders === id);
    setLines(Object.fromEntries((p?.items ?? []).filter((l: any) => l.qtyAccepted > 0).map((l: any) => [l.idPoItems, { qty: String(l.qtyAccepted), price: String(l.unitPrice) }])));
  };
  const close = () => { setOpen(false); setLines({}); setF({ idPurchaseOrders: "", invoiceNumber: "", invoiceDate: todayISO(), dueDate: todayISO() }); record.clearError(); };

  return (
    <PageBody>
      <PageHeader title="Invoice Supplier" description="Keuangan mencatat invoice lalu memverifikasi dengan three-way matching: PO – penerimaan barang – invoice. Hanya invoice yang sesuai dapat dibayar."
        actions={canWrite ? <Button onClick={() => setOpen(true)}>Catat invoice</Button> : undefined} />
      {(invoices.data ?? []).length === 0 ? <Empty>Belum ada invoice.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>PO / Supplier</TableHead><TableHead>Tanggal</TableHead><TableHead>Jatuh tempo</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Dibayar</TableHead><TableHead>Verifikasi</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{(invoices.data ?? []).map((i) => (
            <TableRow key={i.idSupplierInvoices}>
              <TableCell className="font-medium">{i.invoiceNumber}</TableCell><TableCell>{i.poNumber}<div className="text-xs text-muted-foreground">{i.supplierName}</div></TableCell><TableCell>{formatDate(i.invoiceDate)}</TableCell><TableCell>{formatDate(i.dueDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatIDR(i.total)}</TableCell><TableCell className="text-right tabular-nums">{formatIDR(i.paid)}</TableCell>
              <TableCell><Badge variant="outline" className={i.status === "held" ? "text-destructive" : i.status === "matched" ? "text-primary" : ""}>{STATE[i.status]}</Badge>{i.verificationNote ? <div className="mt-1 max-w-xs text-xs text-muted-foreground">{i.verificationNote}</div> : null}</TableCell>
              <TableCell className="text-right">{canWrite && i.status !== "matched" ? <Button size="sm" disabled={verify.pending} onClick={async () => { setResult(await verify.run({ idSupplierInvoices: i.idSupplierInvoices })); }}>{i.status === "held" ? "Verifikasi ulang" : "Verifikasi"}</Button> : null}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></TableShell>
      )}
      {verify.error ? <p role="alert" className="text-sm text-destructive">{verify.error}</p> : null}
      {result ? <p className={`text-sm ${result.status === "matched" ? "text-primary" : "text-destructive"}`}>{result.status === "matched" ? "Invoice sesuai dan dapat dibayar." : `Invoice ditahan: ${result.note}`}</p> : null}

      <FormDialog wide open={open} onOpenChange={(o) => !o && close()} title="Catat invoice supplier" pending={record.pending} error={record.error}
        onSubmit={async () => { await record.run({ ...f, items: Object.entries(lines).filter(([, v]) => Number(v.qty) > 0).map(([idPoItems, v]) => ({ idPoItems, qtyInvoiced: Number(v.qty), unitPrice: Number(v.price) })) }); close(); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="iv-po" label="Purchase Order"><select id="iv-po" required className={nativeSelectClass} value={f.idPurchaseOrders} onChange={(e) => pickPo(e.target.value)}><option value="">Pilih PO…</option>{eligible.map((p) => <option key={p.idPurchaseOrders} value={p.idPurchaseOrders}>{p.poNumber} · {p.supplierName}</option>)}</select></Field>
          <Field id="iv-no" label="Nomor invoice supplier"><Input id="iv-no" required value={f.invoiceNumber} onChange={(e) => setF({ ...f, invoiceNumber: e.target.value })} /></Field>
          <Field id="iv-date" label="Tanggal invoice"><Input id="iv-date" type="date" required value={f.invoiceDate} onChange={(e) => setF({ ...f, invoiceDate: e.target.value })} /></Field>
          <Field id="iv-due" label="Jatuh tempo"><Input id="iv-due" type="date" required min={f.invoiceDate} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        </div>
        {po ? <Table><TableHeader><TableRow><TableHead>Bahan baku</TableHead><TableHead className="text-right">Diterima</TableHead><TableHead className="w-32">Qty ditagih</TableHead><TableHead className="w-36">Harga satuan</TableHead></TableRow></TableHeader>
          <TableBody>{po.items.filter((l: any) => l.qtyAccepted > 0).map((l: any) => (
            <TableRow key={l.idPoItems}><TableCell>{l.materialName} <span className="text-xs text-muted-foreground">(PO {formatIDR(l.unitPrice)})</span></TableCell><TableCell className="text-right tabular-nums">{formatNumber(l.qtyAccepted)}</TableCell>
              <TableCell><NumberInput id={`q-${l.idPoItems}`} aria-label="Qty ditagih" value={lines[l.idPoItems]?.qty ?? ""} onChange={(v) => setLines({ ...lines, [l.idPoItems]: { qty: v, price: lines[l.idPoItems]?.price ?? "" } })} /></TableCell>
              <TableCell><NumberInput id={`p-${l.idPoItems}`} aria-label="Harga satuan" value={lines[l.idPoItems]?.price ?? ""} onChange={(v) => setLines({ ...lines, [l.idPoItems]: { qty: lines[l.idPoItems]?.qty ?? "", price: v } })} /></TableCell></TableRow>
          ))}</TableBody></Table> : null}
      </FormDialog>
    </PageBody>
  );
}
