import { Fragment, useState } from "react";

import { PageBody, PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableShell } from "@/components/shared/table-shell";
import { Empty } from "@/components/scm/ui";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useList } from "@/hooks/use-list";
import { useRun } from "@/hooks/use-run";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatIDR, formatNumber } from "@/lib/format";

export function meta() {
  return [{ title: "Purchase Order - CTRL Coffee" }];
}

export default function PurchaseOrdersRoute() {
  const { user } = useUser();
  const pos = useList<any[]>("list-purchase-orders");
  const cancel = useRun("cancel-purchase-order");
  const [open, setOpen] = useState<string | null>(null);
  const rows = pos.data ?? [];
  return (
    <PageBody>
      <PageHeader title="Purchase Order" description="PO dibuat otomatis dari penawaran supplier terpilih; harga dan lead time mengikuti penawaran. Total dan sisa penerimaan dihitung dari data transaksi." />
      {rows.length === 0 ? <Empty>Belum ada PO. PO dibuat dari PR yang disetujui setelah memilih supplier.</Empty> : (
        <TableShell><Table>
          <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Supplier</TableHead><TableHead>PR</TableHead><TableHead>Tanggal</TableHead><TableHead>Janji tiba</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{rows.map((p) => (
            <Fragment key={p.idPurchaseOrders}>
              <TableRow>
                <TableCell className="font-medium">{p.poNumber}</TableCell><TableCell>{p.supplierName}</TableCell><TableCell>{p.prNumber}</TableCell><TableCell>{formatDate(p.orderDate)}</TableCell><TableCell>{formatDate(p.expectedDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatIDR(p.total)}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setOpen(open === p.idPurchaseOrders ? null : p.idPurchaseOrders)}>{open === p.idPurchaseOrders ? "Tutup" : "Rincian"}</Button>
                  {user?.roleCode === "purchasing" && p.status === "sent" ? <Button size="sm" variant="outline" disabled={cancel.pending} onClick={() => cancel.run({ idPurchaseOrders: p.idPurchaseOrders })}>Batalkan</Button> : null}</TableCell>
              </TableRow>
              {open === p.idPurchaseOrders ? (
                <TableRow><TableCell colSpan={8} className="bg-secondary/40">
                  <Table><TableHeader><TableRow><TableHead>Bahan baku</TableHead><TableHead className="text-right">Dipesan</TableHead><TableHead className="text-right">Diterima</TableHead><TableHead className="text-right">Ditolak</TableHead><TableHead className="text-right">Sisa</TableHead><TableHead className="text-right">Harga</TableHead></TableRow></TableHeader>
                    <TableBody>{p.items.map((l: any) => (<TableRow key={l.idPoItems}><TableCell>{l.materialName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(l.qtyOrdered)} {l.unitName}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(l.qtyAccepted)}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(l.qtyRejected)}</TableCell><TableCell className="text-right tabular-nums">{formatNumber(l.remaining)}</TableCell><TableCell className="text-right tabular-nums">{formatIDR(l.unitPrice)}</TableCell></TableRow>))}</TableBody></Table>
                </TableCell></TableRow>
              ) : null}
            </Fragment>
          ))}</TableBody>
        </Table></TableShell>
      )}
      {cancel.error ? <p role="alert" className="text-sm text-destructive">{cancel.error}</p> : null}
    </PageBody>
  );
}
