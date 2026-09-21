/**
 * Разбор импортируемого GeoJSON лицензионного участка (чистая функция).
 *
 * Поддерживаются:
 *  - FeatureCollection / Feature с geometry типа Polygon / MultiPolygon;
 *  - «сырой» GeoJSON-geometry без обёртки Feature;
 *  - координаты в порядке [lng, lat] (стандарт GeoJSON).
 *
 * Из MultiPolygon берётся ПЕРВЫЙ внешний контур.
 * Возвращает массив точек {lng, lat} или null, если полигон не найден/короткий.
 */

export type ImportedAreaPoint = { lng: number; lat: number };

/** Привести массив координат GeoJSON к точкам {lng, lat}. */
function toPoints(ring: unknown): ImportedAreaPoint[] | null {
  if (!Array.isArray(ring)) return null;
  const points: ImportedAreaPoint[] = [];
  for (const item of ring) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const [lng, lat] = item;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    // Пропускаем дублирующую замыкающую точку (первая == последняя).
    if (
      points.length > 0 &&
      points[0].lng === lng &&
      points[0].lat === lat
    ) {
      continue;
    }
    points.push({ lng, lat });
  }
  return points.length >= 3 ? points : null;
}

/** Извлечь внешний контур полигона из geometry любого поддерживаемого типа. */
function ringFromGeometry(geometry: unknown): ImportedAreaPoint[] | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const geo = geometry as { type?: string; coordinates?: unknown };
  if (geo.type === 'Polygon') {
    const coords = geo.coordinates as unknown[];
    return Array.isArray(coords) ? toPoints(coords[0]) : null;
  }
  if (geo.type === 'MultiPolygon') {
    const coords = geo.coordinates as unknown[];
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const first = coords[0] as unknown[];
    return Array.isArray(first) ? toPoints(first[0]) : null;
  }
  return null;
}

/**
 * Разобрать GeoJSON и вернуть точки первого полигона (внешний контур).
 * @returns точки [{lng, lat}, …] (>=3) или null.
 */
export function parseLicenceAreaGeoJSON(raw: unknown): ImportedAreaPoint[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // 1. FeatureCollection: ищем первую фичу с полигоном.
  if (obj.type === 'FeatureCollection') {
    const features = obj.features;
    if (!Array.isArray(features)) return null;
    for (const feature of features) {
      const f = feature as { geometry?: unknown };
      const points = ringFromGeometry(f.geometry);
      if (points) return points;
    }
    return null;
  }

  // 2. Single Feature.
  if (obj.type === 'Feature') {
    return ringFromGeometry(obj.geometry);
  }

  // 3. «Сырая» geometry (Polygon / MultiPolygon).
  return ringFromGeometry(raw);
}
