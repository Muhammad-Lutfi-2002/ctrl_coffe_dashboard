import { useEffect, useState } from "react";

import { Field, nativeSelectClass } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { FormDialog, NumberInput, Section } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatIDR } from "@/lib/format";
import { ROLE_LABELS, ROLES } from "@/lib/nav";

export function meta() {
  return [{ title: "Pengaturan - CTRL Coffee" }];
}

const NAMES: Record<string, string> = { price: "Harga", performance: "Kinerja historis", lead_time: "Lead time", payment_term: "Syarat pembayaran" };

export default function SettingsRoute() {
  const { user } = useUser();
  const role = user?.roleCode;
  const isOwner = role === "owner";
  const canUsers = role === "owner" || role === "admin";
  const weights = useList<any>("get-scoring-weights", {}, role === "owner" || role === "purchasing");
  const settings = useList<any>("get-settings");
  const users = useList<any[]>("list-users", {}, canUsers);
  const saveWeights = useRun("update-scoring-weights"), saveSetting = useRun("update-setting"), access = useRun("update-user-access"), createUser = useRun("create-user");
  const [w, setW] = useState<Record<string, string>>({});
  const [thr, setThr] = useState(""), [ns, setNs] = useState("");
  const [dlg, setDlg] = useState(false);
  const [u, setU] = useState({ fullName: "", email: "", password: "", roleCode: "purchasing" });
  useEffect(() => { if (weights.data) setW(Object.fromEntries(Object.entries(weights.data).map(([k, v]) => [k, String(v)]))); }, [weights.data]);
  useEffect(() => { if (settings.data) { setThr(String(settings.data.paymentApprovalThreshold)); setNs(String(settings.data.newSupplierPerformanceScore)); } }, [settings.data]);
  const sum = Object.values(w).reduce((a, b) => a + Number(b || 0), 0);

  return (
    <PageBody>
      <PageHeader title="Pengaturan" description="Parameter metode SAW, ambang kewenangan pembayaran, dan akun pengguna. Perubahan parameter hanya oleh Owner dan tercatat pada jejak audit." />
      {role === "owner" || role === "purchasing" ? (
        <Section title="Bobot kriteria SAW (perbandingan penawaran)">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-4">{Object.keys(NAMES).map((k) => (
              <Field key={k} id={`w-${k}`} label={`${NAMES[k]} (%)`}><NumberInput id={`w-${k}`} disabled={!isOwner} value={w[k] ?? ""} onChange={(v) => setW({ ...w, [k]: v })} max={100} /></Field>))}</div>
            <div className="mt-3 flex items-center gap-3"><span className={`text-sm ${sum === 100 ? "text-primary" : "text-destructive"}`}>Total {sum}%</span>
              {isOwner ? <Button disabled={sum !== 100 || saveWeights.pending} onClick={() => saveWeights.run(Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Number(v)])))}>Simpan bobot</Button> : <span className="text-xs text-muted-foreground">Hanya Owner yang dapat mengubah bobot.</span>}
              {saveWeights.error ? <span role="alert" className="text-sm text-destructive">{saveWeights.error}</span> : null}</div>
          </div>
        </Section>
      ) : null}
      <Section title="Kewenangan dan nilai awal">
        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
          <Field id="thr" label={`Ambang persetujuan pembayaran Owner (Rp) — saat ini ${settings.data ? formatIDR(settings.data.paymentApprovalThreshold) : ""}`}>
            <div className="flex gap-2"><NumberInput id="thr" disabled={!isOwner} value={thr} onChange={setThr} /><Button disabled={!isOwner || saveSetting.pending} onClick={() => saveSetting.run({ key: "payment_approval_threshold", value: Number(thr) })}>Simpan</Button></div></Field>
          <Field id="ns" label="Nilai kinerja awal supplier baru (0–100)">
            <div className="flex gap-2"><NumberInput id="ns" disabled={!isOwner} value={ns} onChange={setNs} max={100} /><Button disabled={!isOwner || saveSetting.pending} onClick={() => saveSetting.run({ key: "new_supplier_performance_score", value: Number(ns) })}>Simpan</Button></div></Field>
          {saveSetting.error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{saveSetting.error}</p> : null}
        </div>
      </Section>
      {canUsers ? (
        <Section title="Pengguna" actions={<Button onClick={() => setDlg(true)}>Tambah pengguna</Button>}>
          <TableShell><Table>
            <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Peran</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{(users.data ?? []).map((x) => (
              <TableRow key={x.idUsers}><TableCell className="font-medium">{x.fullName}</TableCell><TableCell>{x.email}</TableCell>
                <TableCell><select aria-label={`Peran ${x.fullName}`} className={`${nativeSelectClass} w-36`} value={x.roleCode} disabled={x.idUsers === user?.idUsers} onChange={(e) => access.run({ idUsers: x.idUsers, roleCode: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></TableCell>
                <TableCell><StatusBadge status={x.isActive ? "active" : "inactive"} /></TableCell>
                <TableCell className="text-right">{x.idUsers !== user?.idUsers ? <Button size="sm" variant="ghost" onClick={() => access.run({ idUsers: x.idUsers, isActive: !x.isActive })}>{x.isActive ? "Nonaktifkan" : "Aktifkan"}</Button> : null}</TableCell></TableRow>
            ))}</TableBody>
          </Table></TableShell>
          {access.error ? <p role="alert" className="text-sm text-destructive">{access.error}</p> : null}
        </Section>
      ) : null}
      <FormDialog open={dlg} onOpenChange={(o) => { setDlg(o); if (!o) createUser.clearError(); }} title="Tambah pengguna" pending={createUser.pending} error={createUser.error}
        description="Akun dibuat di Supabase Auth. Pengguna masuk dengan email dan kata sandi ini."
        onSubmit={async () => { await createUser.run(u); setDlg(false); setU({ fullName: "", email: "", password: "", roleCode: "purchasing" }); }}>
        <Field id="u-name" label="Nama lengkap"><Input id="u-name" required value={u.fullName} onChange={(e) => setU({ ...u, fullName: e.target.value })} /></Field>
        <Field id="u-email" label="Email"><Input id="u-email" type="email" required value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></Field>
        <Field id="u-pass" label="Kata sandi awal (min. 8 karakter)"><Input id="u-pass" type="password" minLength={8} required value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} /></Field>
        <Field id="u-role" label="Peran"><select id="u-role" className={nativeSelectClass} value={u.roleCode} onChange={(e) => setU({ ...u, roleCode: e.target.value })}>{ROLES.filter((r) => r !== "owner" || role === "owner").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
      </FormDialog>
    </PageBody>
  );
}
