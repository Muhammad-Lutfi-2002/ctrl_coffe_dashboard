import { useState } from "react";

import { Field } from "@/components/shared/field";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { TableShell } from "@/components/shared/table-shell";
import { Empty, FormDialog, KpiCard, NumberInput, Section } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatIDR, todayISO } from "@/lib/format";

export function meta() {
  return [{ title: "Anggaran dan Laporan - CTRL Coffee" }];
}

export default function FinanceRoute() {
  const { user } = useUser();
  const canWrite = user?.roleCode === "finance";
  const [period, setPeriod] = useState(todayISO().slice(0, 7));
  const report = useList<any>("get-finance-report", { period });
  const expenses = useList<any[]>("list-expenses");
  const setBudget = useRun("set-budget"), addExpense = useRun("record-expense");
  const [dlg, setDlg] = useState<null | "budget" | "expense">(null);
  const [f, setF] = useState({ amount: "", description: "", date: todayISO() });
  const r = report.data;
  const close = () => { setDlg(null); setF({ amount: "", description: "", date: todayISO() }); setBudget.clearError(); addExpense.clearError(); };
  const inMonth = (expenses.data ?? []).filter((e) => e.expenseDate.startsWith(period));

  return (
    <PageBody>
      <PageHeader title="Anggaran dan Laporan Keuangan" description="Pembelian supplier (pembayaran lunas) dibedakan dari pengeluaran operasional dan dari pendapatan penjualan."
        actions={<><Input aria-label="Periode" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-40" />{canWrite ? <><Button variant="outline" onClick={() => setDlg("budget")}>Atur anggaran</Button><Button onClick={() => setDlg("expense")}>Catat pengeluaran</Button></> : null}</>} />
      {r ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Pendapatan penjualan" value={formatIDR(r.salesRevenue)} />
          <KpiCard label="Anggaran" value={r.budgetAmount === null ? "Belum diatur" : formatIDR(r.budgetAmount)} />
          <KpiCard label="Pembelian supplier (lunas)" value={formatIDR(r.supplierPayments)} />
          <KpiCard label="Pengeluaran operasional" value={formatIDR(r.operationalExpenses)} />
          <KpiCard label="Total pengeluaran" value={formatIDR(r.totalOutflow)} />
          <KpiCard label="Sisa anggaran" value={r.budgetRemaining === null ? "-" : formatIDR(r.budgetRemaining)} tone={r.budgetRemaining !== null && r.budgetRemaining < 0 ? "negative" : undefined} />
          <KpiCard label="Hutang supplier berjalan" value={formatIDR(r.outstandingPayables)} hint="Invoice sesuai yang belum lunas" />
        </div>
      ) : null}
      <Section title={`Pengeluaran operasional ${period}`}>
        {inMonth.length === 0 ? <Empty>Belum ada pengeluaran operasional pada periode ini.</Empty> : (
          <TableShell><Table><TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Nominal</TableHead></TableRow></TableHeader>
            <TableBody>{inMonth.map((e) => <TableRow key={e.idExpenses}><TableCell>{formatDate(e.expenseDate)}</TableCell><TableCell>{e.description}</TableCell><TableCell className="text-right tabular-nums">{formatIDR(e.amount)}</TableCell></TableRow>)}</TableBody></Table></TableShell>
        )}
      </Section>
      <FormDialog open={dlg === "budget"} onOpenChange={(o) => !o && close()} title={`Anggaran ${period}`} pending={setBudget.pending} error={setBudget.error}
        onSubmit={async () => { await setBudget.run({ period, amount: Number(f.amount) }); close(); }}>
        <Field id="bg-amt" label="Anggaran bulan ini (Rp)"><NumberInput id="bg-amt" required value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
      </FormDialog>
      <FormDialog open={dlg === "expense"} onOpenChange={(o) => !o && close()} title="Catat pengeluaran operasional" pending={addExpense.pending} error={addExpense.error}
        onSubmit={async () => { await addExpense.run({ expenseDate: f.date, description: f.description, amount: Number(f.amount) }); close(); }}>
        <Field id="ex-date" label="Tanggal"><Input id="ex-date" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field id="ex-desc" label="Keterangan"><Input id="ex-desc" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field id="ex-amt" label="Nominal (Rp)"><NumberInput id="ex-amt" required value={f.amount} onChange={(v) => setF({ ...f, amount: v })} min={1} /></Field>
      </FormDialog>
    </PageBody>
  );
}
