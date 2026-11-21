import { useState } from "react";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, NumberInput, Tabs } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/format";

export function meta() {
  return [{ title: "Stok dan Mutasi - CTRL Coffee" }];
}

const TYPE_LABEL: Record<string, string> = { opening_balance: "Saldo awal", receipt: "Penerimaan", usage: "Pemakaian", damaged: "Rusak", expired: "Kedaluwarsa", adjustment: "Penyesuaian", opname_adjustment: "Selisih opname" };

export default function InventoryRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "admin";
  const [tab, setTab] = useState("stock");
  const stock = useList<any[]>("list-stock");
  const moves = useList<any[]>("list-stock-movements", {}, tab === "moves");
  const opnames = useList<any[]>("list-stock-opnames", {}, tab === "opname" && user?.roleCode !== "purchasing");
  const rows = stock.data ?? [];
  const [dlg, setDlg] = useState<null | "move" | "opening" | "opname">(null);
  const move = useRun("record-stock-movement");
  const opening = useRun("record-opening-balance");
  const createOp = useRun("create-stock-opname");
  const finalize = useRun("finalize-stock-opname");
  const [f, setF] = useState({ idMaterials: "", movementType: "usage", qty: "", note: "" });
  const [counts, setCounts] = useState<Record<string, string>>({});
  const close = () => { setDlg(null); setF({ idMaterials: "", movementType: "usage", qty: "", note: "" }); setCounts({}); move.clearError(); opening.clearError(); createOp.clearError(); };

  return (
    <PageBody>
      <PageHeader title="Stok dan Mutasi" description="Saldo stok dihitung dari riwayat mutasi yang sah (barang masuk, pemakaian, rusak, kedaluwarsa, penyesuaian, opname)."
        actions={canWrite ? <><Button variant="outline" onClick={() => setDlg("opening")}>Saldo awal</Button><Button variant="outline" onClick={() => setDlg("opname")}>Stock opname</Button><Button onClick={() => setDlg("move")}>Catat barang keluar</Button></> : undefined} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "stock", label: "Saldo stok" }, { id: "moves", label: "Kartu stok" }, ...(user?.roleCode !== "purchasing" ? [{ id: "opname", label: "Stock opname" }] : [])]} />

      {tab === "stock" ? (
        rows.length === 0 ? <Empty>Belum ada bahan baku. Tambahkan di Data Induk.</Empty> : (
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Bahan baku</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Minimum</TableHead><TableHead className="text-right">Pengaman</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((m) => (
              <TableRow key={m.idMaterials}><TableCell className="text-muted-foreground">{m.sku}</TableCell><TableCell className="font-medium">{m.materialName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.balance)}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.minStock)}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.safetyStock)}</TableCell><TableCell><StatusBadge status={m.status} /></TableCell></TableRow>
            ))}</TableBody>
          </Table></TableShell>
        )
      ) : null}

      {tab === "moves" ? (
        (moves.data ?? []).length === 0 ? <Empty>Belum ada mutasi stok.</Empty> : (
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Bahan baku</TableHead><TableHead>Jenis</TableHead><TableHead className="text-right">Jumlah</TableHead><TableHead>Catatan</TableHead></TableRow></TableHeader>
            <TableBody>{(moves.data ?? []).map((m) => (
              <TableRow key={m.idStockMovements}><TableCell>{formatDate(m.movedAt)}</TableCell><TableCell className="font-medium">{m.materialName}</TableCell><TableCell>{TYPE_LABEL[m.movementType] ?? m.movementType}</TableCell><TableCell className={`text-right tabular-nums ${m.qtyDelta < 0 ? "text-destructive" : ""}`}>{m.qtyDelta > 0 ? "+" : ""}{formatNumber(m.qtyDelta)}</TableCell><TableCell className="text-muted-foreground">{m.note}</TableCell></TableRow>
            ))}</TableBody>
          </Table></TableShell>
        )
      ) : null}

      {tab === "opname" ? (
        (opnames.data ?? []).length === 0 ? <Empty>Belum ada stock opname.</Empty> : (
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead>Catatan</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{(opnames.data ?? []).map((o) => (
              <TableRow key={o.idStockOpnames}><TableCell className="font-medium">{o.opnameNumber}</TableCell><TableCell>{formatDate(o.opnameDate)}</TableCell><TableCell>{o.status === "draft" ? "Draft" : "Final"}</TableCell><TableCell className="text-muted-foreground">{o.note}</TableCell>
                <TableCell className="text-right">{canWrite && o.status === "draft" ? <Button size="sm" disabled={finalize.pending} onClick={() => finalize.run({ idStockOpnames: o.idStockOpnames })}>Finalisasi</Button> : null}</TableCell></TableRow>
            ))}</TableBody>
          </Table></TableShell>
        )
      ) : null}
      {finalize.error ? <p role="alert" className="text-sm text-destructive">{finalize.error}</p> : null}

      <FormDialog open={dlg === "move"} onOpenChange={(o) => !o && close()} title="Catat barang keluar / penyesuaian" pending={move.pending} error={move.error}
        description="Pemakaian, rusak, dan kedaluwarsa tidak boleh melebihi saldo. Penyesuaian dapat bernilai positif atau negatif."
        onSubmit={async () => { await move.run({ idMaterials: f.idMaterials, movementType: f.movementType, qty: Number(f.qty), note: f.note }); close(); }}>
        <Field id="mv-mat" label="Bahan baku"><select id="mv-mat" required className={nativeSelectClass} value={f.idMaterials} onChange={(e) => setF({ ...f, idMaterials: e.target.value })}><option value="">Pilih…</option>{rows.map((m) => <option key={m.idMaterials} value={m.idMaterials}>{m.materialName} (saldo {formatNumber(m.balance)})</option>)}</select></Field>
        <Field id="mv-type" label="Jenis"><select id="mv-type" className={nativeSelectClass} value={f.movementType} onChange={(e) => setF({ ...f, movementType: e.target.value })}><option value="usage">Pemakaian</option><option value="damaged">Rusak</option><option value="expired">Kedaluwarsa</option><option value="adjustment">Penyesuaian (+/−)</option></select></Field>
        <Field id="mv-qty" label="Jumlah"><NumberInput id="mv-qty" required value={f.qty} onChange={(v) => setF({ ...f, qty: v })} min={f.movementType === "adjustment" ? -1e9 : 0.001} /></Field>
        <Field id="mv-note" label="Catatan"><Input id="mv-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </FormDialog>

      <FormDialog open={dlg === "opening"} onOpenChange={(o) => !o && close()} title="Saldo awal bahan baku" pending={opening.pending} error={opening.error}
        onSubmit={async () => { await opening.run({ idMaterials: f.idMaterials, qty: Number(f.qty), note: f.note || "Saldo awal" }); close(); }}>
        <Field id="op-mat" label="Bahan baku"><select id="op-mat" required className={nativeSelectClass} value={f.idMaterials} onChange={(e) => setF({ ...f, idMaterials: e.target.value })}><option value="">Pilih…</option>{rows.map((m) => <option key={m.idMaterials} value={m.idMaterials}>{m.materialName}</option>)}</select></Field>
        <Field id="op-qty" label="Jumlah"><NumberInput id="op-qty" required value={f.qty} onChange={(v) => setF({ ...f, qty: v })} min={0.001} /></Field>
      </FormDialog>

      <FormDialog wide open={dlg === "opname"} onOpenChange={(o) => !o && close()} title="Stock opname" description="Isi jumlah hasil hitung fisik. Selisih terhadap saldo sistem dicatat sebagai mutasi saat difinalisasi." pending={createOp.pending} error={createOp.error}
        onSubmit={async () => { const items = Object.entries(counts).filter(([, v]) => v !== "").map(([idMaterials, v]) => ({ idMaterials, countedQty: Number(v) })); await createOp.run({ items, note: f.note }); close(); }}>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          <Table><TableHeader><TableRow><TableHead>Bahan baku</TableHead><TableHead className="text-right">Saldo sistem</TableHead><TableHead className="w-36">Hasil hitung</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((m) => (<TableRow key={m.idMaterials}><TableCell>{m.materialName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.balance)}</TableCell><TableCell><NumberInput id={`c-${m.idMaterials}`} value={counts[m.idMaterials] ?? ""} onChange={(v) => setCounts({ ...counts, [m.idMaterials]: v })} /></TableCell></TableRow>))}</TableBody></Table>
        </div>
        <Field id="op-note" label="Catatan"><Input id="op-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </FormDialog>
    </PageBody>
  );
}
