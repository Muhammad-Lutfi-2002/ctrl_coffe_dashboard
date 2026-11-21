import { useState } from "react";
import { Link } from "react-router";

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
import { formatDate, formatNumber, todayISO } from "@/lib/format";

export function meta() {
  return [{ title: "Purchase Request - CTRL Coffee" }];
}

export default function PurchaseRequestsRoute() {
  const { user } = useUser();
  const role = user?.roleCode;
  const prs = useList<any[]>("list-purchase-requests");
  const materials = useList<any[]>("list-materials");
  const low = useList<any[]>("list-low-stock");
  const create = useRun("create-purchase-request");
  const decide = useRun("decide-purchase-request");
  const [open, setOpen] = useState(false);
  const [needed, setNeeded] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ idMaterials: string; qty: string }[]>([{ idMaterials: "", qty: "" }]);
  const [decision, setDecision] = useState<{ pr: any; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const rows = prs.data ?? [];

  const prefillFromLowStock = () => { setLines((low.data ?? []).map((m) => ({ idMaterials: m.idMaterials, qty: String(Math.max(1, Math.ceil(m.minStock * 2 - m.balance))) }))); setOpen(true); };
  const closeCreate = () => { setOpen(false); setLines([{ idMaterials: "", qty: "" }]); setNotes(""); create.clearError(); };

  return (
    <PageBody>
      <PageHeader title="Purchase Request" description="PR multi-item dibuat Purchasing, diputuskan Owner (penolakan wajib catatan). PR yang disetujui lanjut ke perbandingan penawaran supplier."
        actions={role === "purchasing" ? <>{(low.data ?? []).length > 0 ? <Button variant="outline" onClick={prefillFromLowStock}>Dari stok minimum ({(low.data ?? []).length})</Button> : null}<Button onClick={() => setOpen(true)}>Buat PR</Button></> : undefined} />
      {rows.length === 0 ? <Empty>Belum ada Purchase Request.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Pemohon</TableHead><TableHead>Dibutuhkan</TableHead><TableHead>Item</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Penawaran</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rows.map((p) => (
            <TableRow key={p.idPurchaseRequests}>
              <TableCell className="font-medium">{p.prNumber}</TableCell><TableCell>{p.requesterName}</TableCell><TableCell>{formatDate(p.neededBy)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.items.map((i: any) => `${i.materialName} ${formatNumber(i.qty)} ${i.unitName}`).join(", ")}</TableCell>
              <TableCell><StatusBadge status={p.status} /></TableCell><TableCell className="text-right tabular-nums">{p.quotationCount}</TableCell>
              <TableCell className="text-right">
                {role === "owner" && p.status === "submitted" ? <><Button size="sm" onClick={() => { setNote(""); setDecision({ pr: p, decision: "approved" }); }}>Setujui</Button><Button size="sm" variant="outline" className="ml-1" onClick={() => { setNote(""); setDecision({ pr: p, decision: "rejected" }); }}>Tolak</Button></> : null}
                {(p.status === "approved" || p.status === "ordered") && (role === "purchasing" || role === "owner") ? <Link to={`/procurement/${p.idPurchaseRequests}`} className="text-sm font-medium text-primary hover:underline">Penawaran & PO →</Link> : null}
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></TableShell>
      )}

      <FormDialog wide open={open} onOpenChange={(o) => !o && closeCreate()} title="Buat Purchase Request" pending={create.pending} error={create.error}
        onSubmit={async () => { await create.run({ neededBy: needed, notes, items: lines.filter((l) => l.idMaterials && Number(l.qty) > 0).map((l) => ({ idMaterials: l.idMaterials, qty: Number(l.qty) })) }); closeCreate(); }}>
        <div className="grid gap-3 sm:grid-cols-2"><Field id="pr-date" label="Dibutuhkan paling lambat"><Input id="pr-date" type="date" required min={todayISO()} value={needed} onChange={(e) => setNeeded(e.target.value)} /></Field><Field id="pr-notes" label="Catatan"><Input id="pr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_auto] gap-2">
              <select aria-label="Bahan baku" className={nativeSelectClass} value={l.idMaterials} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, idMaterials: e.target.value } : x)))}><option value="">Pilih bahan…</option>{(materials.data ?? []).filter((m) => m.isActive).map((m) => <option key={m.idMaterials} value={m.idMaterials}>{m.materialName} (saldo {formatNumber(m.balance)} {m.unitName})</option>)}</select>
              <NumberInput id={`pr-q-${i}`} aria-label="Jumlah" placeholder="Jumlah" value={l.qty} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: v } : x)))} min={0.001} />
              <Button type="button" variant="ghost" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>Hapus</Button>
            </div>))}
          <Button type="button" variant="outline" onClick={() => setLines([...lines, { idMaterials: "", qty: "" }])}>Tambah item</Button>
        </div>
      </FormDialog>

      <FormDialog open={!!decision} onOpenChange={(o) => { if (!o) { setDecision(null); decide.clearError(); } }} pending={decide.pending} error={decide.error}
        title={decision?.decision === "approved" ? `Setujui ${decision?.pr.prNumber}` : `Tolak ${decision?.pr.prNumber}`} submitLabel={decision?.decision === "approved" ? "Setujui" : "Tolak"}
        onSubmit={async () => { await decide.run({ idPurchaseRequests: decision!.pr.idPurchaseRequests, decision: decision!.decision, note }); setDecision(null); }}>
        <Field id="dc-note" label={decision?.decision === "rejected" ? "Catatan penolakan (wajib)" : "Catatan (opsional)"}><Input id="dc-note" required={decision?.decision === "rejected"} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </FormDialog>
    </PageBody>
  );
}
