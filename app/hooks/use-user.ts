import { useActionQuery } from "@agent-native/core/client/hooks";

import type { Role } from "@/lib/nav";

export type CurrentUser = { idUsers: string; email: string; fullName: string; roleCode: Role };

/** Identitas dan peran SELALU dari server (sesi Supabase + tabel users), tidak dari localStorage. */
export function useUser() {
  const q = useActionQuery("get-current-user", {}, { retry: false });
  return { user: (q.data ?? null) as CurrentUser | null, isLoading: q.isLoading, error: q.error as (Error & { statusCode?: number; status?: number }) | null };
}
