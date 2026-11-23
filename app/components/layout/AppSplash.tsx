/** Layar pembuka saat sesi diperiksa: logo berdenyut dan bilah kemajuan, bukan teks "Memuat sesi…". */
export function AppSplash({ label = "Menyiapkan aplikasi" }: { label?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background" role="status" aria-live="polite">
      <img src="/ctrl-coffee-logo.png" alt="CTRL + Coffee" className="ctrl-pulse h-20 w-auto" />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted"><div className="ctrl-indeterminate h-full w-1/3 rounded-full bg-primary" /></div>
      <p className="text-xs text-muted-foreground">{label}…</p>
    </div>
  );
}
