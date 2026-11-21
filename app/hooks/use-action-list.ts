import { useActionQuery } from "@agent-native/core/client/hooks";
import { useMemo } from "react";

export function useActionList<T>(action: string): T[] {
  const { data } = useActionQuery(action, {});
  return useMemo(() => (data ?? []) as T[], [data]);
}
