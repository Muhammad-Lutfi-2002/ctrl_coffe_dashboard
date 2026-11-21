import { useActionQuery } from "@agent-native/core/client/hooks";

/** Query action baca; mengembalikan data (default undefined) dan status. */
export function useList<T = any>(action: string, args: Record<string, unknown> = {}, enabled = true) {
  const q = useActionQuery(action, args, { enabled } as any);
  return { data: q.data as T | undefined, isLoading: q.isLoading, error: q.error as Error | null, refetch: q.refetch };
}
