import { cn } from "@/lib/utils";

/** Placeholder pemuatan (shimmer halus) agar tata letak tidak melompat saat data tiba. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("ctrl-shimmer rounded-md bg-muted", className)} />;
}

export function KpiSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Memuat">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="mt-3 h-7 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card" role="status" aria-label="Memuat">
      <div className="flex gap-4 border-b border-border px-4 py-3">{Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}</div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/60 px-4 py-3.5 last:border-0">{Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-4 flex-1" />)}</div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="rounded-lg border border-border bg-card p-4" role="status" aria-label="Memuat"><Skeleton className="h-48 w-full" /></div>;
}
