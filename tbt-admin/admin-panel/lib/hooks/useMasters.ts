import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import type { CreatableOption } from "@/components/shared/CreatableSelect";

/**
 * Master-data hooks — one pair per master kind.
 *
 * The backend exposes three parallel resources at
 * `/api/masters/{cities|states|business-types}`. This module wraps
 * each in a `useQuery` + `useMutation` pair so callers can drop them
 * into any form field with three lines of code:
 *
 * ```tsx
 * const { data: cities } = useCities();
 * const create = useCreateCity();
 * <CreatableSelect
 *   value={form.city}
 *   options={cities ?? []}
 *   onChange={(v) => setField('city', v)}
 *   onCreate={(name) => create.mutateAsync(name)}
 * />
 * ```
 *
 * Query cache is keyed by kind so the three masters are independent
 * — creating a new state doesn't invalidate the cities list. New
 * values from `useCreate*` invalidate the matching list so the
 * dropdown shows the new value on next open without a refetch spinner.
 */

export type MasterKind = "cities" | "states" | "business-types";

function useMasters(kind: MasterKind) {
  return useQuery({
    queryKey: ["masters", kind],
    queryFn: async (): Promise<CreatableOption[]> => {
      const res: any = await apiClient.get(`/api/masters/${kind}`);
      return (res?.data ?? []) as CreatableOption[];
    },
    // Master lists are cheap to recompute but rarely mutate. Cache
    // aggressively so the dropdowns feel instant on repeat opens.
    staleTime: 5 * 60_000,
  });
}

function useCreateMaster(kind: MasterKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<CreatableOption> => {
      const res: any = await apiClient.post(`/api/masters/${kind}`, { name });
      // Backend response shape: { success, data: { id, name }, error }
      const created = res?.data ?? res;
      return created as CreatableOption;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["masters", kind] });
    },
  });
}

// Explicit per-kind exports keep call sites readable and let us type-
// narrow the hook signatures if we ever diverge one of them (e.g. add
// a country param to cities).
export const useCities = () => useMasters("cities");
export const useStates = () => useMasters("states");
export const useBusinessTypes = () => useMasters("business-types");

export const useCreateCity = () => useCreateMaster("cities");
export const useCreateState = () => useCreateMaster("states");
export const useCreateBusinessType = () => useCreateMaster("business-types");
