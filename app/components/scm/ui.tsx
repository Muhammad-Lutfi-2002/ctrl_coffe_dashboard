import { useState } from "react";

import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function FormDialog({ open, onOpenChange, title, description, submitLabel = "Simpan", pending, error, onSubmit, children, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; submitLabel?: string; pending?: boolean; error?: string | null;
  onSubmit: () => void | Promise<void>; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <form onSubmit={(e) => { e.preventDefault(); void onSubmit(); }} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </DialogHeader>
          {children}
          {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={pending}>{pending ? "Memproses…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "negative" | "positive" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className={cn("mt-1 text-xs", tone === "negative" ? "text-destructive" : tone === "positive" ? "text-primary" : "text-muted-foreground")}>{hint}</p> : null}
    </div>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors", value === t.id ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Bagan garis sederhana (SVG) dari data deret waktu nyata. */
export function LineChart({ points, height = 180 }: { points: { label: string; value: number }[]; height?: number }) {
  if (points.length === 0) return <Empty>Belum ada data pada periode ini.</Empty>;
  const W = 640, H = height, pad = { l: 56, r: 12, t: 12, b: 24 };
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const step = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tren penjualan">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{formatIDR(t).replace("Rp", "").trim()}</text>
        </g>
      ))}
      <path d={path} fill="none" className="stroke-primary" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r={3} className="fill-primary"><title>{`${p.label}: ${formatIDR(p.value)}`}</title></circle>
          {i % step === 0 ? <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{p.label.slice(5)}</text> : null}
        </g>
      ))}
    </svg>
  );
}

export function BarList({ rows, format = formatIDR }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  if (rows.length === 0) return <Empty>Belum ada data.</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate">{r.label}</span><span className="shrink-0 tabular-nums text-muted-foreground">{format(r.value)}</span></div>
          <div className="h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function NumberInput({ id, value, onChange, min = 0, step = "any", ...rest }: { id: string; value: string; onChange: (v: string) => void; min?: number; step?: string } & Omit<React.ComponentProps<typeof Input>, "onChange" | "value" | "min" | "step">) {
  return <Input id={id} type="number" inputMode="decimal" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export { Field, useState };
