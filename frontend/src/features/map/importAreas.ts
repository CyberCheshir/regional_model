/**
 * Импорт/экспорт ЛИЦЕНЗИОННЫХ УЧАСТКОВ из файлов (чистые функции).
 *
 * Поддерживаемые форматы на входе:
 *   1. Нормализованная Markdown-таблица (как `data.txt`):
 *      | SVG | Точка | X, px | Y, px | X norm | Y norm |
 *      |  1  |   1   |  502  |   6   | 0.974  | 0.000  |
 *      — строки группируются по колонке SVG, точки берутся из X/Y norm.
 *   2. CSV с теми же колонками (разделитель `,` или `;`).
 *   3. JSON: массив участков или объект FeatureCollection / {areas:[…]}:
 *      [{ "name": "ЛУ-1", "points": [[xNorm,yNorm], …] }, …]
 *
 * Нормализованные координаты (∈ [0..1]) переводятся в абсолютные lng/lat
 * через bounding box карты (Mercator-проекция, линейно по x и y).
 */

import { MAP_CENTER } from './geo';

export type AreaNormPoint = { x: number; y: number };

export type ImportedNormArea = {
  /** Имя участка (по умолчанию формируется из номера SVG) */
  name: string;
  /** Точки в НОРМАЛИЗОВАННЫХ координатах (x,y ∈ [0..1]) */
  norm: AreaNormPoint[];
};

export type ImportedAreaPoint = { lng: number; lat: number };

/**
 * Прямоугольник карты в географических координатах, которому соответствуют
 * нормализованные координаты [0..1]. По умолчанию — квадрат вокруг MAP_CENTER.
 */
export type MapBoundingBox = {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
};

/**
 * Охват по умолчанию (градусы) — если bbox не задан явно.
 * Держим участки рядом с центром карты, чтобы они были видны при zoom ~10.
 */
const DEFAULT_SPAN_DEG = 0.5;

/** Bounding box по умолчанию вокруг текущего центра карты. */
export function defaultBoundingBox(): MapBoundingBox {
  return {
    minLng: MAP_CENTER.lng - DEFAULT_SPAN_DEG,
    maxLng: MAP_CENTER.lng + DEFAULT_SPAN_DEG,
    minLat: MAP_CENTER.lat - DEFAULT_SPAN_DEG,
    maxLat: MAP_CENTER.lat + DEFAULT_SPAN_DEG,
  };
}

/**
 * Перевод нормализованной точки [0..1] в lng/lat по bounding box.
 * ВАЖНО: Y в экранных координатах растёт ВНИЗ, а широта — ВВЕРХ,
 * поэтому Y norm инвертируется (y=0 → верх → maxLat).
 */
export function normToLngLat(p: AreaNormPoint, box: MapBoundingBox): ImportedAreaPoint {
  const lng = box.minLng + p.x * (box.maxLng - box.minLng);
  const lat = box.maxLat - p.y * (box.maxLat - box.minLat);
  return { lng, lat };
}

/** Разбор числа из ячейки таблицы (пустое/нечисло → null). */
function parseNum(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const normalized = cell.replace(',', '.').trim();
  if (normalized === '' || normalized === '—' || normalized === '-') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Разбить строку таблицы/CSV на ячейки (по `|`, `,` или `;`). */
function splitRow(line: string): string[] {
  // Markdown-таблица: строки вида "| a | b | c |"
  if (line.includes('|')) {
    return line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim());
  }
  const delimiter = line.includes(';') ? ';' : ',';
  return line.split(delimiter).map((c) => c.trim());
}

/** Строка — разделитель заголовка Markdown-таблицы (|---|---|)? */
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:|-]+$/.test(line) && line.includes('-');
}

/**
 * Найти индексы нужных колонок в строке-заголовке.
 * Возвращает индексы колонок {svg, xNorm, yNorm} (с позиционным fallback).
 * Поддерживаем русские и английские заголовки.
 */
function locateColumns(header: string[]): {
  svg: number;
  xNorm: number;
  yNorm: number;
} {
  const find = (patterns: RegExp[]): number =>
    header.findIndex((h) => patterns.some((re) => re.test(h)));

  let svg = find([/svg/i, /участ/i, /area/i, /id/i]);
  // Приоритет — нормализованные колонки («norm»), иначе сырые X/Y (px).
  let xNorm = find([/x.*norm/i, /^x$/i, /^x,/i]);
  let yNorm = find([/y.*norm/i, /^y$/i, /^y,/i]);

  // Fallback: нормализованные — последние две колонки, svg — первая.
  const last = header.length - 1;
  if (xNorm < 0) xNorm = last - 1;
  if (yNorm < 0) yNorm = last;
  if (svg < 0) svg = 0;

  return { svg, xNorm, yNorm };
}

/**
 * Разобрать таблицу (Markdown/CSV) в участки по колонке SVG.
 * @returns массив участков в нормализованных координатах или null.
 */
function parseTable(text: string): ImportedNormArea[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '');

  if (lines.length === 0) return null;

  // Первая непустая строка — заголовок.
  const header = splitRow(lines[0]);
  const cols = locateColumns(header);

  const groups = new Map<string, AreaNormPoint[]>();
  const order: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;

    const x = parseNum(cells[cols.xNorm]);
    const y = parseNum(cells[cols.yNorm]);
    if (x === null || y === null) continue;

    const key = cells[cols.svg]?.trim() || '1';
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push({ x, y });
  }

  if (order.length === 0) return null;

  // Порядок точек внутри группы — как в файле (строки идут по колонке «Точка»).
  return order.map((key, index) => ({
    name: `Лицензионный участок ${index + 1}`,
    norm: groups.get(key)!,
  }));
}

/** Разобрать JSON-вариант (массив участков или FeatureCollection). */
function parseJson(raw: unknown): ImportedNormArea[] | null {
  if (!raw || typeof raw !== 'object') return null;

  const asArea = (item: unknown, index: number): ImportedNormArea | null => {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;
    const name =
      typeof obj.name === 'string'
        ? obj.name
        : typeof obj.label === 'string'
          ? obj.label
          : `Лицензионный участок ${index + 1}`;

    // Точки могут быть: norm:[{x,y}], points:[[x,y]] или points:[{x,y}].
    const source =
      (Array.isArray(obj.norm) && obj.norm) ||
      (Array.isArray(obj.points) && obj.points) ||
      (Array.isArray(obj.polygon) && obj.polygon) ||
      null;
    if (!source) return null;

    const norm: AreaNormPoint[] = [];
    for (const p of source as unknown[]) {
      if (Array.isArray(p) && p.length >= 2) {
        const x = Number(p[0]);
        const y = Number(p[1]);
        if (Number.isFinite(x) && Number.isFinite(y)) norm.push({ x, y });
      } else if (p && typeof p === 'object') {
        const o = p as Record<string, unknown>;
        const x = Number(o.x);
        const y = Number(o.y);
        if (Number.isFinite(x) && Number.isFinite(y)) norm.push({ x, y });
      }
    }
    return norm.length >= 3 ? { name, norm } : null;
  };

  // 1. Массив участков.
  if (Array.isArray(raw)) {
    const areas = raw
      .map((item, i) => asArea(item, i))
      .filter((a): a is ImportedNormArea => a !== null);
    return areas.length > 0 ? areas : null;
  }

  // 2. Обёртки: { areas: [...] } / { features: [...] }.
  const obj = raw as Record<string, unknown>;
  const list =
    (Array.isArray(obj.areas) && obj.areas) ||
    (Array.isArray(obj.features) && obj.features) ||
    null;
  if (list) {
    const areas = (list as unknown[])
      .map((item, i) => asArea(item, i))
      .filter((a): a is ImportedNormArea => a !== null);
    return areas.length > 0 ? areas : null;
  }

  // 3. Одиночный участок-объект.
  const single = asArea(raw, 0);
  return single ? [single] : null;
}

/**
 * Универсальный разбор файла участков: сам определяет формат
 * (JSON / Markdown-таблица / CSV) по содержимому.
 */
export function parseAreasFile(text: string): ImportedNormArea[] | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  // JSON — если начинается с `[` или `{`.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return parseJson(JSON.parse(trimmed));
    } catch {
      // не JSON — падаем в разбор таблицы ниже
    }
  }

  return parseTable(trimmed);
}

/** Разобрать файл и сразу вернуть участки в АБСОЛЮТНЫХ lng/lat. */
export function parseAreasToLngLat(
  text: string,
  box: MapBoundingBox = defaultBoundingBox(),
): Array<{ name: string; points: ImportedAreaPoint[] }> | null {
  const areas = parseAreasFile(text);
  if (!areas) return null;
  return areas.map((a) => ({
    name: a.name,
    points: a.norm.map((p) => normToLngLat(p, box)),
  }));
}

// ---------------------------------------------------------------------------
// Экспорт участков в JSON / CSV / GeoJSON
// ---------------------------------------------------------------------------

export type AreaForExport = {
  label: string;
  lngLat: Array<{ lng: number; lat: number }>;
};

/** Экспорт участков в JSON: [{ name, points: [[lng,lat], …] }, …]. */
export function areasToJson(areas: readonly AreaForExport[]): string {
  return JSON.stringify(
    areas.map((a) => ({
      name: a.label,
      points: a.lngLat.map((p) => [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))]),
    })),
    null,
    2,
  );
}

/** Экранирование ячейки CSV. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Экспорт участков в CSV с абсолютными координатами:
 *   area,point,lng,lat
 */
export function areasToCsv(areas: readonly AreaForExport[]): string {
  const rows: string[] = ['area,point,lng,lat'];
  for (const area of areas) {
    area.lngLat.forEach((p, i) => {
      rows.push(
        [
          csvCell(area.label),
          i + 1,
          p.lng.toFixed(6),
          p.lat.toFixed(6),
        ].join(','),
      );
    });
  }
  return rows.join('\n');
}

/**
 * Экспорт участков в НОРМАЛИЗОВАННЫЙ формат (обратный импорту):
 *   area,point,x_norm,y_norm,lng,lat
 * Удобно для сверки с `data.txt` (X norm / Y norm).
 */
export function areasToNormalizedCsv(
  areas: readonly AreaForExport[],
  box: MapBoundingBox = defaultBoundingBox(),
): string {
  const lngSpan = box.maxLng - box.minLng || 1;
  const latSpan = box.maxLat - box.minLat || 1;
  const rows: string[] = ['area,point,x_norm,y_norm,lng,lat'];
  for (const area of areas) {
    area.lngLat.forEach((p, i) => {
      const xNorm = (p.lng - box.minLng) / lngSpan;
      const yNorm = (box.maxLat - p.lat) / latSpan;
      rows.push(
        [
          csvCell(area.label),
          i + 1,
          xNorm.toFixed(6),
          yNorm.toFixed(6),
          p.lng.toFixed(6),
          p.lat.toFixed(6),
        ].join(','),
      );
    });
  }
  return rows.join('\n');
}

/** Тип экспортируемого файла. */
export type AreaExportFormat = 'json' | 'csv' | 'geojson';

/** MIME-тип и расширение по формату. */
export const AREA_EXPORT_META: Record<AreaExportFormat, { mime: string; ext: string }> = {
  json: { mime: 'application/json', ext: 'json' },
  csv: { mime: 'text/csv', ext: 'csv' },
  geojson: { mime: 'application/geo+json', ext: 'geojson' },
};

/** Сериализовать участки в строку выбранного формата. */
export function serializeAreas(
  areas: readonly AreaForExport[],
  format: AreaExportFormat,
): string {
  if (format === 'csv') return areasToCsv(areas);
  if (format === 'geojson') return areasToGeoJSON(areas);
  return areasToJson(areas);
}

/**
 * Скачать участки файлом в выбранном формате (браузерный download).
 * Возвращает имя сохранённого файла.
 */
export function downloadAreasFile(
  areas: readonly AreaForExport[],
  format: AreaExportFormat,
  baseName = 'licence-areas',
): string {
  const meta = AREA_EXPORT_META[format];
  const fileName = `${baseName}.${meta.ext}`;
  const blob = new Blob([serializeAreas(areas, format)], {
    type: `${meta.mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}

/** Экспорт участков в GeoJSON FeatureCollection (полигоны). */
export function areasToGeoJSON(areas: readonly AreaForExport[]): string {
  const features = areas.map((a) => ({
    type: 'Feature' as const,
    properties: { name: a.label, kind: 'licence-area' },
    geometry: {
      type: 'Polygon' as const,
      // GeoJSON требует замкнутый кольцевой контур: первая точка = последняя.
      coordinates: [
        [...a.lngLat.map((p) => [p.lng, p.lat]), [a.lngLat[0]?.lng ?? 0, a.lngLat[0]?.lat ?? 0]],
      ],
    },
  }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}
