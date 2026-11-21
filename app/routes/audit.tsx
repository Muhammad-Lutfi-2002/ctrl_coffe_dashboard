import { PageBody, PageHeader } from "@/components/shared/page-header";
import { TableShell } from "@/components/shared/table-shell";
import { Empty } from "@/components/scm/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";

export function meta() {
  return [{ title: "Jejak Audit - CTRL Coffee" }];
}

export default function AuditRoute() {
  const logs = useList<any[]>("list-audit-logs");
  return (
    <PageBody>
      <PageHeader title="Jejak Audit" description="Catatan append-only atas perubahan data penting: persetujuan, pemilihan supplier, perubahan bobot, penerimaan, verifikasi invoice, dan pembayaran." />
      {(logs.data ?? []).length === 0 ? <Empty>Belum ada catatan.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Pengguna</TableHead><TableHead>Aksi</TableHead><TableHead>Entitas</TableHead><TableHead>Rincian</TableHead></TableRow></TableHeader>
          <TableBody>{(logs.data ?? []).map((l) => (
            <TableRow key={l.idAuditLogs}><TableCell className="whitespace-nowrap">{new Date(l.loggedAt).toLocaleString("id-ID")}</TableCell><TableCell>{l.actorName ?? "-"}</TableCell><TableCell className="font-medium">{l.action}</TableCell><TableCell>{l.entityType}</TableCell><TableCell className="max-w-md truncate text-xs text-muted-foreground" title={JSON.stringify(l.detail)}>{l.detail ? JSON.stringify(l.detail) : ""}</TableCell></TableRow>
          ))}</TableBody>
        </Table></TableShell>
      )}
    </PageBody>
  );
}
