import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import { errorMessage } from "@/lib/format";

/** Menjalankan action mutasi dan menyimpan pesan galat dari server (mis. validasi stok, otorisasi). */
export function useRun(action: string) {
  const m = useActionMutation(action);
  const [error, setError] = useState<string | null>(null);
  const run = async (args: Record<string, unknown> = {}) => {
    setError(null);
    try {
      return await (m.mutateAsync as (a: unknown) => Promise<any>)(args);
    } catch (e) {
      setError(errorMessage(e, "Terjadi kesalahan"));
      throw e;
    }
  };
  return { run, pending: m.isPending, error, clearError: () => setError(null) };
}
