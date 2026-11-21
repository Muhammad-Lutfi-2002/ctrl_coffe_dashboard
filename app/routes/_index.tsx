import { IconAlertTriangle } from "@tabler/icons-react";
import { Link } from "react-router";

import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, KpiCard, Section } from "@/components/scm/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useUser } from "@/hooks/use-user";
import { formatIDR, formatNumber } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/nav";

export function meta() {
  return [{ title: "Dashboard - CTRL Coffee" }];
}

export default function DashboardRoute() {
  const { user } = useUser();
  const { data: s, isLoading } = useList<any>("get-operational-summary");
  const role = user?.roleCode;
  if (isLoading || !s) return <PageBody><PageHeader title="Dashboard" /><p className="text-sm text-muted-foreground">Memuat ringkasan…</p></PageBody>;
  const fin = s.finance as any | undefined;
  return (
    <PageBody>
      <PageHeader title="Dashboard" description={`Ringkasan operasional untuk peran ${role ? ROLE_LABELS[role] : ""}. Semua angka berasal dari transaksi yang tersimpan.`}
        actions={role === "owner" || role === "finance" ? <Link to="/sales-analytics" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Buka analitik penjualan →</Link> : undefined} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {s.lowStockCount !== undefined ? <KpiCard label="Bahan di bawah stok minimum" value={formatNumber(s.lowStockCount)} tone={s.lowStockCount > 0 ? "negative" : "positive"} hint={s.lowStockCount > 0 ? "Perlu PR" : "Semua aman"} /> : null}
        {s.prPending !== undefined ? <KpiCard label="PR menunggu persetujuan" value={formatNumber(s.prPending)} hint={role === "owner" ? "Menunggu keputusan Owner" : undefined} /> : null}
        {s.prAwaitingQuotation !== undefined ? <KpiCard label="PR siap dibandingkan penawarannya" value={formatNumber(s.prAwaitingQuotation)} hint="Sudah disetujui, belum jadi PO" /> : null}
        {s.poOpen !== undefined ? <KpiCard label="PO berjalan" value={formatNumber(s.poOpen)} hint="Dikirim atau diterima sebagian" /> : null}
        {s.paymentsPendingApproval !== undefined ? <KpiCard label="Pembayaran menunggu Owner" value={formatNumber(s.paymentsPendingApproval)} /> : null}
        {s.invoicesToVerify !== undefined ? <KpiCard label="Invoice perlu verifikasi/ditahan" value={formatNumber(s.invoicesToVerify)} /> : null}
        {fin ? <KpiCard label={`Pendapatan penjualan ${fin.period}`} value={formatIDR(fin.salesRevenue)} /> : null}
        {fin ? <KpiCard label="Hutang supplier berjalan" value={formatIDR(fin.outstandingPayables)} /> : null}
      </div>

      {fin ? (
        <Section title={`Keuangan ${fin.period}`}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Anggaran" value={fin.budgetAmount === null ? "Belum diatur" : formatIDR(fin.budgetAmount)} />
            <KpiCard label="Pembayaran supplier (lunas)" value={formatIDR(fin.supplierPayments)} />
            <KpiCard label="Pengeluaran operasional" value={formatIDR(fin.operationalExpenses)} />
            <KpiCard label="Sisa anggaran" value={fin.budgetRemaining === null ? "-" : formatIDR(fin.budgetRemaining)} tone={fin.budgetRemaining !== null && fin.budgetRemaining < 0 ? "negative" : undefined} />
          </div>
        </Section>
      ) : null}

      {s.lowStock ? (
        <Section title="Stok perlu diisi ulang" actions={<Link to="/purchase-requests" className="text-sm text-primary hover:underline">Buat PR</Link>}>
          {s.lowStock.length === 0 ? <Empty>Tidak ada bahan di bawah stok minimum.</Empty> : (
            <TableShell>
              <Table>
                <TableHeader><TableRow><TableHead>Bahan baku</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Minimum</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{s.lowStock.map((m: any) => (
                  <TableRow key={m.idMaterials}><TableCell className="font-medium">{m.materialName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.balance)}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(m.minStock)}</TableCell><TableCell><StatusBadge status={m.status} /></TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </TableShell>
          )}
        </Section>
      ) : null}

      {s.supplierPerformance ? (
        <Section title="Kinerja supplier" actions={s.invoicesHeld > 0 ? <span className="flex items-center gap-1 text-sm text-destructive"><IconAlertTriangle className="size-4" />{s.invoicesHeld} invoice ditahan</span> : undefined}>
          {s.supplierPerformance.length === 0 ? <Empty>Belum ada supplier.</Empty> : (
            <TableShell>
              <Table>
                <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Skor kinerja</TableHead><TableHead className="text-right">Tepat waktu</TableHead><TableHead className="text-right">Kesesuaian jumlah</TableHead><TableHead className="text-right">Penerimaan</TableHead></TableRow></TableHeader>
                <TableBody>{s.supplierPerformance.map((p: any) => (
                  <TableRow key={p.idSuppliers}>
                    <TableCell className="font-medium">{p.supplierName}{p.isNew ? <span className="ml-2 text-xs text-muted-foreground">(belum ada riwayat: nilai awal)</span> : null}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.performance}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.onTimePct === null ? "-" : `${p.onTimePct}%`}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.accuracyPct === null ? "-" : `${p.accuracyPct}%`}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.receiptCount}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </TableShell>
          )}
        </Section>
      ) : null}
    </PageBody>
  );
}
