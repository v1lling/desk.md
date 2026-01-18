import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Area } from "@/types";
import * as areaLib from "@/lib/orbit/areas";
import { useSettingsStore } from "./settings";

// Query keys
export const areaKeys = {
  all: ["areas"] as const,
  detail: (areaId: string) => [...areaKeys.all, "detail", areaId] as const,
};

/**
 * Hook to fetch all areas
 */
export function useAreas() {
  return useQuery({
    queryKey: areaKeys.all,
    queryFn: () => areaLib.getAreas(),
  });
}

/**
 * Hook to fetch a single area
 */
export function useArea(areaId: string | null) {
  return useQuery({
    queryKey: areaKeys.detail(areaId || ""),
    queryFn: () => areaLib.getArea(areaId!),
    enabled: !!areaId,
  });
}

/**
 * Hook to create a new area
 */
export function useCreateArea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      description?: string;
      color?: string;
    }) => areaLib.createArea(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areaKeys.all });
    },
  });
}

/**
 * Hook to update an area
 */
export function useUpdateArea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      areaId,
      updates,
    }: {
      areaId: string;
      updates: Partial<Pick<Area, "name" | "description" | "color">>;
    }) => areaLib.updateArea(areaId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areaKeys.all });
    },
  });
}

/**
 * Hook to delete an area
 */
export function useDeleteArea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (areaId: string) => areaLib.deleteArea(areaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: areaKeys.all });
    },
  });
}

/**
 * Selector hook to get the current area
 */
export function useCurrentArea() {
  const { data: areas = [] } = useAreas();
  const currentAreaId = useSettingsStore((state) => state.currentAreaId);
  return areas.find((area) => area.id === currentAreaId) || areas[0] || null;
}
