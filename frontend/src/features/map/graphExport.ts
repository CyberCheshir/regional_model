import { graphPointToLngLat } from './geo';
import type {
  DrawVertex,
  DrawnSegment,
  MapFitting,
  MapTap,
  MapVertex,
} from './drawingTypes';

/**
 * Экспорт спроектированного графа в GeoJSON-подобную структуру с
 * географическими координатами (lng/lat) — для API/выгрузки.
 *
 * Геокоординаты вершин берутся напрямую из модели, а концы рёбер
 * вычисляются из их мировых координат (актуальны на момент вызова).
 */

export type GeoPoint = [number, number]; // [lng, lat]

export type GeoFeature = {
  type: 'Feature';
  id: string;
  properties: Record<string, unknown>;
  geometry:
  | { type: 'Point'; coordinates: GeoPoint }
  | { type: 'LineString'; coordinates: GeoPoint[] };
};

export type GraphGeoJSON = {
  type: 'FeatureCollection';
  features: GeoFeature[];
};

/** Геокоординаты конца ребра (из мировой точки или из привязки вершины). */
function vertexLngLat(v: DrawVertex): GeoPoint {
  // Если вершина — объект/тройник/врезка, используем их сохранённые lng/lat.
  // Иначе вычисляем из мировых координат.
  const g = graphPointToLngLat(v.x, v.y);
  return [g.lng, g.lat];
}

export type GraphSnapshotForExport = {
  vertices: MapVertex[];
  fittings: MapFitting[];
  taps: MapTap[];
  segments: DrawnSegment[];
};

/** Экспорт вершин-объектов (кусты / УПН / точки поставки) как точки. */
export function verticesToGeoJSON(vertices: MapVertex[]): GeoFeature[] {
  return vertices.map((v) => ({
    type: 'Feature',
    id: v.id,
    properties: {
      kind: v.kind,
      label: v.label,
      x: v.x,
      y: v.y,
      lng: v.lng,
      lat: v.lat,
      ...(v.w !== undefined ? { width: v.w } : {}),
      ...(v.h !== undefined ? { height: v.h } : {}),
    },
    geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
  }));
}

/** Экспорт тройников (серых вершин) как точек. */
export function fittingsToGeoJSON(fittings: MapFitting[]): GeoFeature[] {
  return fittings.map((f) => ({
    type: 'Feature',
    id: f.id,
    properties: { kind: 'tee', label: f.label, x: f.x, y: f.y, lng: f.lng, lat: f.lat },
    geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
  }));
}

/** Экспорт врезок как точек (с привязкой к ребру). */
export function tapsToGeoJSON(taps: MapTap[]): GeoFeature[] {
  return taps.map((t) => ({
    type: 'Feature',
    id: t.id,
    properties: {
      kind: 'tap',
      label: t.label,
      edgeId: t.edgeId,
      t: t.t,
      x: t.x,
      y: t.y,
      lng: t.lng,
      lat: t.lat,
    },
    geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
  }));
}

/** Экспорт рёбер (сегментов) как LineString с координатами концов. */
export function segmentsToGeoJSON(segments: DrawnSegment[]): GeoFeature[] {
  return segments.map((s) => ({
    type: 'Feature',
    id: s.id,
    properties: {
      kind: 'pipeline-segment',
      pipelineId: s.pipelineId,
      fluid: s.fluid,
      from: [s.from.x, s.from.y],
      to: [s.to.x, s.to.y],
    },
    geometry: { type: 'LineString', coordinates: [vertexLngLat(s.from), vertexLngLat(s.to)] },
  }));
}

/** Полная выгрузка графа в FeatureCollection (для API/экспорта). */
export function graphToGeoJSON(data: GraphSnapshotForExport): GraphGeoJSON {
  return {
    type: 'FeatureCollection',
    features: [
      ...verticesToGeoJSON(data.vertices),
      ...fittingsToGeoJSON(data.fittings),
      ...tapsToGeoJSON(data.taps),
      ...segmentsToGeoJSON(data.segments),
    ],
  };
}
