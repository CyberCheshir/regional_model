/**
 * Геопривязка карты: конвертация между географическими координатами (lng/lat)
 * и мировыми пикселями Web Mercator (по стандарту тайлов XYZ).
 *
 * Наш граф (vis-network) живёт в условных «мировых» единицах. МЫ ПРИВЯЗЫВАЕМ
 * эти единицы к географии через фиксированный масштаб:
 *   1 мировая единица графа = MAP_METERS_PER_UNIT метров.
 * Это позволяет рисовать граф поверх реальных растровых тайлов и наоборот.
 */

/** Размер тайла в пикселях (стандарт XYZ). */
export const TILE_SIZE = 256;

/**
 * Реальная геопривязка: 1 мировая единица графа = 1 МЕТР реального мира.
 * Точка (0,0) графа соответствует MAP_CENTER. За счёт этого объекты/рёбра
 * имеют точные географические координаты (lng/lat), а тайлы ложатся 1:1.
 */
export const MAP_METERS_PER_UNIT = 1;

/**
 * Географический центр области (место, где находится точка (0,0) графа).
 * По умолчанию — точка 61.115171 N, 76.749737 E.
 */
export const MAP_CENTER = { lng: 76.749737, lat: 61.115171 } as const;

/** Начальный гео-зум карты. */
export const MAP_INITIAL_ZOOM = 12;

/** Границы зума для растровых тайлов. */
export const TILE_MIN_ZOOM = 2;
export const TILE_MAX_ZOOM = 19;

/** Ограничение широты Mercator (±85.0511°). */
const MAX_LAT = 85.05112878;

/** Мировые пиксели Web Mercator в точке (lng, lat) на зуме z (в пикселях 256/тайл). */
export function lngLatToWorldPixel(
  lng: number,
  lat: number,
  zoom: number,
): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** Гео-координаты по мировым пикселям Web Mercator на зуме z. */
export function worldPixelToLngLat(
  x: number,
  y: number,
  zoom: number,
): { lng: number; lat: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lng, lat };
}

/**
 * Метры на один мировой пиксель графа при заданной широте и гео-зуме.
 * Используется, чтобы связать масштаб графа (визуальные единицы) с гео-масштабом.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  const earthCircumference = 40075016.686;
  return (earthCircumference * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * Math.pow(2, zoom));
}

/**
 * Гео-координаты точки графа (worldUnitsX/Y) относительно центра карты.
 * Смещение в метрах переводим в градусы (приближение для небольших областей).
 */
export function graphPointToLngLat(
  x: number,
  y: number,
  center = MAP_CENTER,
  metersPerUnit = MAP_METERS_PER_UNIT,
): { lng: number; lat: number } {
  const dxMeters = x * metersPerUnit;
  const dyMeters = y * metersPerUnit;
  const latRad = (center.lat * Math.PI) / 180;
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111320 * Math.cos(latRad);
  return {
    lng: center.lng + (metersPerDegLng !== 0 ? dxMeters / metersPerDegLng : 0),
    // экранный +y направлен вниз, географический +lat — вверх
    lat: center.lat - dyMeters / metersPerDegLat,
  };
}

/** Обратное преобразование: lng/lat → мировые единицы графа. */
export function lngLatToGraphPoint(
  lng: number,
  lat: number,
  center = MAP_CENTER,
  metersPerUnit = MAP_METERS_PER_UNIT,
): { x: number; y: number } {
  const latRad = (center.lat * Math.PI) / 180;
  const metersPerDegLat = 111132.92;
  const metersPerDegLng = 111320 * Math.cos(latRad);
  const dxMeters = (lng - center.lng) * metersPerDegLng;
  const dyMeters = (center.lat - lat) * metersPerDegLat;
  return { x: dxMeters / metersPerUnit, y: dyMeters / metersPerUnit };
}
