import { useState } from "react";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, NumberInput } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatIDR } from "@/lib/format";

export function meta() {
  return [{ title: "Pembayaran - CTRL Coffee" }];
}

const LABEL: Record<string, string> = { pending_approval: "Menunggu Owner", approved: "Disetujui", paid: "Lunas", rejected: "Ditolak" };

export default function PaymentsRoute() {
  const { user } = useUser();
  const role = user?.roleCode;
  const payments = useList<any[]>("list-payments");
  const invoices = useList<any[]>("list-invoices");
  const settings = useList<any>("get-settings");
  const create = useRun("create-payment"), decide = useRun("decide-payment"), paid = useRun("mark-payment-paid");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ idSupplierInvoices: "", amount: "", method: "transfer" });
  const [dec, setDec] = useState<{ p: any; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const payable = (invoices.data ?? []).filter((i) => i.status === "matched" && i.remaining > 0);
  const inv = payable.find((i) => i.idSupplierInvoices === f.idSupplierInvoices);
  const threshold = settings.data?.paymentApprovalThreshold as number | undefined;
  const close = () => { setOpen(false); setF({ idSupplierInvoices: "", amount: "", method: "transfer" }); create.clearError(); };

  return (
    <PageBody>
      <PageHeader title="Pembayaran Supplier" description={`Pembayaran dapat bertahap. Nominal di atas ambang kewenangan ${threshold === undefined ? "" : formatIDR(threshold)} memerlukan persetujuan Owner; di bawah ambang langsung disetujui.`}
        actions={role === "finance" ? <Button onClick={() => setOpen(true)} disabled={payable.length === 0}>Buat pembayaran</Button> : undefined} />
      {(payments.data ?? []).length === 0 ? <Empty>Belum ada pembayaran. Invoice yang lolos verifikasi dapat dibayar.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Invoice / PO</TableHead><TableHead>Supplier</TableHead><TableHead>Jatuh tempo</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{(payments.data ?? []).map((p) => (
            <TableRow key={p.idPayments}>
              <TableCell className="font-medium">{p.paymentNumber}</TableCell><TableCell>{p.invoiceNumber}<div className="text-xs text-muted-foreground">{p.poNumber}</div></TableCell><TableCell>{p.supplierName}</TableCell><TableCell>{formatDate(p.dueDate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatIDR(p.amount)}</TableCell>
              <TableCell>{p.status === "paid" ? <StatusBadge status="paid" /> : <span className="text-sm">{LABEL[p.status]}</span>}{p.paidAt ? <div className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</div> : null}</TableCell>
              <TableCell className="text-right">
                {role === "owner" && p.status === "pending_approval" ? <><Button size="sm" onClick={() => { setNote(""); setDec({ p, decision: "approved" }); }}>Setujui</Button><Button size="sm" variant="outline" className="ml-1" onClick={() => { setNote(""); setDec({ p, decision: "rejected" }); }}>Tolak</Button></> : null}
                {role === "finance" && p.status === "approved" ? <Button size="sm" disabled={paid.pending} onClick={() => paid.run({ idPayments: p.idPayments })}>Catat lunas</Button> : null}
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></TableShell>
      )}
      {paid.error ? <p role="alert" className="text-sm text-destructive">{paid.error}</p> : null}

      <FormDialog open={open} onOpenChange={(o) => !o && close()} title="Buat pembayaran supplier" pending={create.pending} error={create.error}
        description={inv ? `Sisa tagihan ${formatIDR(inv.remaining)}.${threshold !== undefined && Number(f.amount) > threshold ? " Nominal ini memerlukan persetujuan Owner." : ""}` : undefined}
        onSubmit={async () => { await create.run({ idSupplierInvoices: f.idSupplierInvoices, amount: Number(f.amount), method: f.method }); close(); }}>
        <Field id="pm-inv" label="Invoice (sudah lolos three-way matching)"><select id="pm-inv" required className={nativeSelectClass} value={f.idSupplierInvoices} onChange={(e) => setF({ ...f, idSupplierInvoices: e.target.value, amount: String(payable.find((i) => i.idSupplierInvoices === e.target.value)?.remaining ?? "") })}><option value="">Pilih…</option>{payable.map((i) => <option key={i.idSupplierInvoices} value={i.idSupplierInvoices}>{i.invoiceNumber} · {i.supplierName} · sisa {formatIDR(i.remaining)}</option>)}</select></Field>
        <Field id="pm-amt" label="Nominal (Rp)"><NumberInput id="pm-amt" required value={f.amount} onChange={(v) => setF({ ...f, amount: v })} min={1} /></Field>
        <Field id="pm-m" label="Metode"><select id="pm-m" className={nativeSelectClass} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="transfer">Transfer</option><option value="cash">Tunai</option><option value="giro">Giro</option></select></Field>
      </FormDialog>

      <FormDialog open={!!dec} onOpenChange={(o) => { if (!o) { setDec(null); decide.clearError(); } }} pending={decide.pending} error={decide.error} submitLabel={dec?.decision === "approved" ? "Setujui" : "Tolak"}
        title={`${dec?.decision === "approved" ? "Setujui" : "Tolak"} ${dec?.p.paymentNumber ?? ""}`} description={dec ? `${dec.p.supplierName} · ${formatIDR(dec.p.amount)}` : undefined}
        onSubmit={async () => { await decide.run({ idPayments: dec!.p.idPayments, decision: dec!.decision, note }); setDec(null); }}>
        <Field id="pd-note" label={dec?.decision === "rejected" ? "Catatan penolakan (wajib)" : "Catatan (opsional)"}><Input id="pd-note" required={dec?.decision === "rejected"} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </FormDialog>
    </PageBody>
  );
}
