import {
  IconBuildingWarehouse, IconCash, IconChartBar, IconClipboardList, IconCoffee, IconFileInvoice, IconHistory, IconLayoutDashboard,
  IconPackageImport, IconReceipt2, IconSettings, IconShoppingCart, IconTruck, IconWallet,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

export const ROLES = ["admin", "purchasing", "finance", "owner"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", purchasing: "Purchasing", finance: "Keuangan", owner: "Owner" };

export type NavItem = {
  to: string; label: string; icon: ComponentType<{ className?: string }>; roles: Role[];
  group: "Ringkasan" | "Persediaan" | "Pengadaan" | "Keuangan" | "Penjualan" | "Sistem";
};

const ALL: Role[] = [...ROLES];
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: IconLayoutDashboard, roles: ALL, group: "Ringkasan" },
  { to: "/inventory", label: "Stok dan Mutasi", icon: IconBuildingWarehouse, roles: ["admin", "purchasing", "owner"], group: "Persediaan" },
  { to: "/master-data", label: "Data Induk", icon: IconCoffee, roles: ALL, group: "Persediaan" },
  { to: "/suppliers", label: "Supplier", icon: IconTruck, roles: ALL, group: "Pengadaan" },
  { to: "/purchase-requests", label: "Purchase Request", icon: IconClipboardList, roles: ["admin", "purchasing", "owner"], group: "Pengadaan" },
  { to: "/purchase-orders", label: "Purchase Order", icon: IconFileInvoice, roles: ALL, group: "Pengadaan" },
  { to: "/goods-receiving", label: "Penerimaan Barang", icon: IconPackageImport, roles: ["admin", "purchasing", "finance", "owner"], group: "Pengadaan" },
  { to: "/invoices", label: "Invoice Supplier", icon: IconReceipt2, roles: ["finance", "owner"], group: "Keuangan" },
  { to: "/payments", label: "Pembayaran", icon: IconCash, roles: ["finance", "owner"], group: "Keuangan" },
  { to: "/finance", label: "Anggaran dan Laporan", icon: IconWallet, roles: ["finance", "owner"], group: "Keuangan" },
  { to: "/sales", label: "Data Penjualan", icon: IconShoppingCart, roles: ["admin", "finance", "owner"], group: "Penjualan" },
  { to: "/sales-analytics", label: "Analitik Penjualan", icon: IconChartBar, roles: ["finance", "owner"], group: "Penjualan" },
  { to: "/settings", label: "Pengaturan", icon: IconSettings, roles: ["admin", "purchasing", "finance", "owner"], group: "Sistem" },
  { to: "/audit", label: "Jejak Audit", icon: IconHistory, roles: ["admin", "owner"], group: "Sistem" },
];

export function findNavItem(pathname: string) {
  const exact = NAV_ITEMS.find((i) => i.to === pathname);
  return exact ?? NAV_ITEMS.find((i) => i.to !== "/" && pathname.startsWith(i.to));
}
export const canAccess = (role: Role, item: NavItem) => item.roles.includes(role);
