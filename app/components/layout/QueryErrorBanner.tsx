import { IconAlertTriangle } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

type Failed = { key: string; message: string };

/**
 * Banner global: menampilkan setiap query aktif yang gagal (termasuk timeout basis data) beserta tombol "Coba lagi".
 * Tanpa ini, halaman yang gagal memuat data hanya terlihat kosong atau "Memuat…" tanpa akhir.
 * Kegagalan sesi (401/403) ditangani SessionGate, jadi tidak ditampilkan di sini.
 */
export function QueryErrorBanner() {
  const qc = useQueryClient();
  const cache = qc.getQueryCache();
  const snapshot = useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () => failedSignature(cache.getAll()),
    () => "",
  );
  const failed = snapshot ? (JSON.parse(snapshot) as Failed[]) : [];
  if (failed.length === 0) return null;
  const retry = () => void qc.refetchQueries({ predicate: (q) => q.state.status === "error" && q.getObserversCount() > 0 });
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive md:px-8">
      <IconAlertTriangle className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Sebagian data gagal dimuat{failed[0]?.message ? `: ${failed[0].message}` : ""}.
        {failed.length > 1 ? ` (${failed.length} permintaan)` : ""}
      </span>
      <Button size="sm" variant="outline" onClick={retry}>Coba lagi</Button>
    </div>
  );
}

function failedSignature(queries: ReturnType<ReturnType<typeof useQueryClient>["getQueryCache"]>["getAll"] extends () => infer R ? R : never): string {
  const out: Failed[] = [];
  for (const q of queries as any[]) {
    if (q.state.status !== "error" || q.getObserversCount() === 0) continue;
    const e: any = q.state.error;
    const code = e?.statusCode ?? e?.status;
    if (code === 401 || code === 403) continue;
    if (String(q.queryKey?.[1] ?? q.queryKey?.[0]).includes("get-current-user")) continue;
    out.push({ key: JSON.stringify(q.queryKey), message: String(e?.message ?? "").slice(0, 160) });
  }
  return out.length ? JSON.stringify(out) : "";
}
