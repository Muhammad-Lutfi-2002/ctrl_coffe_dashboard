import { HeaderActionsProvider } from "@agent-native/toolkit/app-shell";
import { IconMenu2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";
import { canAccess, findNavItem, ROLE_LABELS } from "@/lib/nav";

import { QueryErrorBanner } from "./QueryErrorBanner";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  if (pathname === "/masuk") return <>{children}</>;
  return (
    <HeaderActionsProvider>
      <SessionGate>
        <ShellFrame>{children}</ShellFrame>
      </SessionGate>
    </HeaderActionsProvider>
  );
}

/** Wajib sesi Supabase valid dan akun terdaftar; selain itu diarahkan ke halaman masuk. */
function SessionGate({ children }: LayoutProps) {
  const { user, isLoading, error } = useUser();
  const unauthorized = !isLoading && !user && !!error;
  useEffect(() => {
    if (unauthorized && (error?.statusCode === 401 || error?.status === 401 || /Sesi tidak valid|401/.test(error?.message ?? ""))) window.location.assign("/masuk");
  }, [unauthorized, error]);
  if (isLoading) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Memuat sesi…</div>;
  if (!user) {
    return (
      <div className="flex h-screen flex-col items-start justify-center gap-3 p-10">
        <h1 className="text-xl font-semibold tracking-tight">Akun tidak dapat digunakan</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error?.message ?? "Sesi tidak ditemukan."} Hubungi Admin/Owner untuk didaftarkan atau diaktifkan.</p>
        <Button onClick={() => window.location.assign("/masuk")}>Ke halaman masuk</Button>
      </div>
    );
  }
  return <>{children}</>;
}

function ShellFrame({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useUser();
  const location = useLocation();
  const current = findNavItem(location.pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <Sidebar />
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu" onClick={() => setMenuOpen(true)}>
            <IconMenu2 className="size-5" />
          </Button>
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap truncate">
              <BreadcrumbItem className="text-muted-foreground">CTRL Coffee</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{current?.label ?? "Halaman"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {user ? <Badge variant="outline">{ROLE_LABELS[user.roleCode]}</Badge> : null}
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <QueryErrorBanner />
          <AccessGate>{children}</AccessGate>
        </main>
      </div>
    </div>
  );
}

/** Pembatasan tampilan (UX). Penegakan hak akses sebenarnya ada di server (setiap action memeriksa peran). */
function AccessGate({ children }: LayoutProps) {
  const { user } = useUser();
  const location = useLocation();
  const item = findNavItem(location.pathname);
  if (user && item && !canAccess(user.roleCode, item)) {
    return (
      <div className="flex flex-col items-start gap-3 p-6 md:p-10">
        <Badge variant="outline">{ROLE_LABELS[user.roleCode]}</Badge>
        <h1 className="text-xl font-semibold tracking-tight">Tidak ada akses</h1>
        <p className="max-w-md text-sm text-muted-foreground">Peran {ROLE_LABELS[user.roleCode]} tidak berwenang membuka halaman {item.label}.</p>
      </div>
    );
  }
  return <>{children}</>;
}
