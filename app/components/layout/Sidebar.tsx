import { IconLogout } from "@tabler/icons-react";
import { NavLink } from "react-router";

import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { NAV_ITEMS, ROLE_LABELS, canAccess, type NavItem } from "@/lib/nav";
import { supabaseBrowser } from "@/lib/supabase-client";
import { cn } from "@/lib/utils";

const GROUPS: NavItem["group"][] = ["Ringkasan", "Persediaan", "Pengadaan", "Keuangan", "Penjualan", "Sistem"];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useUser();
  const role = user?.roleCode;

  async function handleSignOut() {
    onNavigate?.();
    await supabaseBrowser().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="px-5 pb-6 pt-5">
        <div className="flex items-center gap-2.5">
          <img src="/ctrl-coffee-logo.png" alt="" className="h-9 w-auto shrink-0" />
          <p className="text-[15px] font-semibold leading-none tracking-tight text-foreground">CTRL + Coffee</p>
        </div>
        <p className="mt-2 pl-0.5 text-xs text-muted-foreground">Supply Chain Management</p>
      </div>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-6" aria-label="Menu utama">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group && role && canAccess(role, item));
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-0.5">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group}</p>
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={onNavigate}
                  className={({ isActive }) => cn("flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                    isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}>
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        {user ? (
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.roleCode]} · {user.email}</p>
          </div>
        ) : null}
        <Button variant="ghost" className="h-9 w-full justify-start gap-2.5 px-2 text-sm font-normal text-sidebar-foreground" onClick={handleSignOut}>
          <IconLogout className="size-4 shrink-0" />
          Keluar
        </Button>
      </div>
    </div>
  );
}
