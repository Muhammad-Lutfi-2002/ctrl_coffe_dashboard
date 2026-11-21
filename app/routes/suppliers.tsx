import { useState } from "react";

import { Field } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";

export function meta() {
  return [{ title: "Supplier - CTRL Coffee" }];
}

export default function SuppliersRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "purchasing";
  const suppliers = useList<any[]>("list-suppliers");
  const materials = useList<any[]>("list-materials");
  const create = useRun("create-supplier"), update = useRun("update-supplier"), link = useRun("set-supplier-materials");
  const [dlg, setDlg] = useState<null | "form" | "materials">(null);
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const close = () => { setDlg(null); setEdit(null); setF({}); create.clearError(); update.clearError(); link.clearError(); };
  const rows = suppliers.data ?? [];

  return (
    <PageBody>
      <PageHeader title="Supplier" description="Data supplier, bahan yang dipasok, dan kinerja historis (ketepatan waktu dan kesesuaian jumlah dari catatan penerimaan)."
        actions={canWrite ? <Button onClick={() => { setF({}); setDlg("form"); }}>Tambah supplier</Button> : undefined} />
      {rows.length === 0 ? <Empty>Belum ada supplier.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Kontak</TableHead><TableHead className="text-right">Skor kinerja</TableHead><TableHead className="text-right">Tepat waktu</TableHead><TableHead className="text-right">Kesesuaian jumlah</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rows.map((s) => (
            <TableRow key={s.idSuppliers}>
              <TableCell className="font-medium">{s.supplierName}<div className="text-xs text-muted-foreground">{s.materialIds.length} bahan dipasok</div></TableCell>
              <TableCell className="text-sm">{s.contactName}<div className="text-xs text-muted-foreground">{s.phone} {s.email}</div></TableCell>
              <TableCell className="text-right tabular-nums">{s.performance?.performance}{s.performance?.isNew ? <span className="block text-xs text-muted-foreground">nilai awal</span> : null}</TableCell>
              <TableCell className="text-right tabular-nums">{s.performance?.onTimePct == null ? "-" : `${s.performance.onTimePct}%`}</TableCell>
              <TableCell className="text-right tabular-nums">{s.performance?.accuracyPct == null ? "-" : `${s.performance.accuracyPct}%`}</TableCell>
              <TableCell><StatusBadge status={s.isActive ? "active" : "inactive"} /></TableCell>
              <TableCell className="text-right">{canWrite ? <><Button size="sm" variant="ghost" onClick={() => { setEdit(s); setF({ supplierName: s.supplierName, contactName: s.contactName, phone: s.phone, email: s.email, address: s.address }); setDlg("form"); }}>Ubah</Button><Button size="sm" variant="ghost" onClick={() => { setEdit(s); setSel(new Set(s.materialIds)); setDlg("materials"); }}>Bahan</Button><Button size="sm" variant="ghost" onClick={() => update.run({ idSuppliers: s.idSuppliers, isActive: !s.isActive })}>{s.isActive ? "Nonaktifkan" : "Aktifkan"}</Button></> : null}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></TableShell>
      )}
      <FormDialog open={dlg === "form"} onOpenChange={(o) => !o && close()} title={edit ? "Ubah supplier" : "Tambah supplier"} pending={create.pending || update.pending} error={create.error || update.error}
        onSubmit={async () => { edit ? await update.run({ idSuppliers: edit.idSuppliers, ...f }) : await create.run(f); close(); }}>
        {([["supplierName", "Nama supplier"], ["contactName", "Nama kontak"], ["phone", "Telepon"], ["email", "Email"], ["address", "Alamat"]] as const).map(([k, l]) => (
          <Field key={k} id={`s-${k}`} label={l}><Input id={`s-${k}`} required={k === "supplierName"} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
        ))}
      </FormDialog>
      <FormDialog open={dlg === "materials"} onOpenChange={(o) => !o && close()} title={`Bahan dipasok: ${edit?.supplierName ?? ""}`} pending={link.pending} error={link.error}
        onSubmit={async () => { await link.run({ idSuppliers: edit.idSuppliers, materialIds: [...sel] }); close(); }}>
        <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {(materials.data ?? []).map((m) => (
            <label key={m.idMaterials} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.has(m.idMaterials)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(m.idMaterials) : n.delete(m.idMaterials); setSel(n); }} />{m.materialName}</label>
          ))}
        </div>
      </FormDialog>
    </PageBody>
  );
}
