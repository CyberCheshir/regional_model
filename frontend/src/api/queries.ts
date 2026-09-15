import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchEntityDetails, fetchMapGraph } from './client';
import type { EntityDetails, MapGraph } from '../domain/types';

/** Ключи кэша react-query для приложения. */
export const queryKeys = {
  mapGraph: ['map', 'graph'] as const,
  entity: (id: string) => ['entity', id] as const,
};

/** useQuery: граф карты (узлы + рёбра). */
export function useMapGraphQuery(): UseQueryResult<MapGraph, Error> {
  return useQuery({
    queryKey: queryKeys.mapGraph,
    queryFn: fetchMapGraph,
    staleTime: 60_000,
  });
}

/** useQuery: детали выбранного объекта. */
export function useEntityDetailsQuery(
  entityId: string | null,
): UseQueryResult<EntityDetails, Error> {
  return useQuery({
    queryKey: queryKeys.entity(entityId ?? 'none'),
    queryFn: () => fetchEntityDetails(entityId as string),
    enabled: entityId !== null,
    staleTime: 30_000,
  });
}
