/**
 * Domain Layer: Импорт и экспорт данных модели.
 *
 * Единый источник истины для всех файловых операций:
 *  - Экспорт и импорт полной модели (JSON-снимок проекта);
 *  - Экспорт и импорт реестра объектов («Объекты и координаты», «Параметры объектов»);
 *  - Экспорт и импорт профилей продукции;
 *  - Экспорт и импорт лицензионных участков (JSON / CSV / GeoJSON).
 *
 * Все выгрузки берут актуальные данные напрямую из domain layer,
 * а загрузки валидируют и передают нормализованные данные в domain layer.
 */
import * as XLSX from 'xlsx';
import type { ModelObject } from '../features/dataModule/types';
import type { ProductProfile, ProductSeries, ProductType } from './types';
import { buildSavePayload, type MapSaveInput, type MapSavePayload } from '../api/mapSave';
import { sanitizeSnapshot, type ProjectSnapshotInput } from '../features/map/mapDrawingHelpers';

/** Простое и точное прямое сопоставление сущностей по полному имени. */
export function matchName(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase().replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
  const cleanB = b.trim().toLowerCase().replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
  return cleanA === cleanB;
}

/** Прямое сопоставление по имени без искажений (только регистр, тире и тримминг). */
export function normalizeEntityName(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[–—−]/g, '-');
}

/* ------------------------------------------------------------------ */
/* Вспомогательные браузерные функции скачивания файлов               */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJsonFile(data: unknown, fileName: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, fileName.endsWith('.json') ? fileName : `${fileName}.json`);
}

export function downloadCsvFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
}

/* ------------------------------------------------------------------ */
/* 1. Экспорт и импорт полной модели проекта (снимок графа)           */
/* ------------------------------------------------------------------ */

/**
 * Формирует полный снимок модели из доменного состояния.
 */
export function exportDomainModel(input: MapSaveInput): MapSavePayload {
  return buildSavePayload(input);
}

/**
 * Скачивает полную модель в виде JSON-файла.
 */
export function downloadDomainModel(
  inputOrPayload: MapSaveInput | MapSavePayload,
  fileName = 'regional-model.json',
): void {
  const payload = 'facilities' in inputOrPayload ? inputOrPayload : exportDomainModel(inputOrPayload);
  downloadJsonFile(payload, fileName);
}

/**
 * Читает и валидирует файл полной модели (JSON).
 */
export async function parseDomainModelFile(file: File): Promise<ProjectSnapshotInput> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.facilities)) {
    throw new Error('Файл не содержит корректного снимка модели (ожидается объект со свойством facilities)');
  }
  return sanitizeSnapshot(parsed as ProjectSnapshotInput);
}

/* ------------------------------------------------------------------ */
/* 2. Экспорт и импорт таблицы объектов (модуль «Данные» -> шаблоны)  */
/* ------------------------------------------------------------------ */

export function objectsToCSV(objects: ModelObject[]): string {
  const header = ['ID', 'Объект', 'Категория', 'Тип / Класс', 'Владелец', 'Период эксплуатации', 'Состояние', 'Источник'];
  const rows = objects.map((obj) => [
    `"${obj.id}"`,
    `"${obj.name.replace(/"/g, '""')}"`,
    `"${obj.category}"`,
    `"${obj.typeClass}"`,
    `"${(obj.owner || '—').replace(/"/g, '""')}"`,
    `"${obj.period || '—'}"`,
    `"${obj.condition || 'Работает'}"`,
    `"${obj.source || 'Модель'}"`,
  ]);
  return [header.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

/**
 * Скачать реестр объектов в формате CSV или JSON.
 */
export function downloadDomainObjects(
  objects: ModelObject[],
  format: 'json' | 'csv' = 'csv',
  fileName = 'Объекты_ПДИМ',
): void {
  if (format === 'csv') {
    const csv = objectsToCSV(objects);
    downloadCsvFile(csv, `${fileName}.csv`);
  } else {
    downloadJsonFile(objects, `${fileName}.json`);
  }
}

/**
 * Разбор входящего текстового/CSV файла с параметрами объектов.
 */
export function parseDomainObjectsCSV(text: string): Array<Partial<ModelObject> & { id: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const split = (line: string) =>
    line.split(';').map((col) => col.trim().replace(/^"|"$/g, ''));

  const results: Array<Partial<ModelObject> & { id: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const id = cells[0];
    if (!id) continue;
    results.push({
      id,
      name: cells[1] || undefined,
      category: (cells[2] as ModelObject['category']) || undefined,
      typeClass: cells[3] || undefined,
      owner: cells[4] || undefined,
      period: cells[5] || undefined,
      condition: cells[6] || undefined,
      source: cells[7] || undefined,
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* 4. Парсеры Excel-файлов («площадки.xlsx», «добыча-поставка.xlsx»,     */
/*    «параметры по длине трубопроводов.xlsx»)                         */
/* ------------------------------------------------------------------ */

export type PlatformImportItem = {
  name: string;
  lat: number;
  lng: number;
};

/** Разбор координаты из строки вида «60.3870910°СШ» или числа */
export function parseGeoCoordinate(val: unknown): { num: number; isLat?: boolean; isLng?: boolean } | null {
  if (val == null) return null;
  if (typeof val === 'number') return { num: val };
  const str = String(val).trim().replace(',', '.');
  if (!str) return null;

  const isSouth = str.includes('ЮШ') || str.includes('S');
  const isWest = str.includes('ЗД') || str.includes('W');
  const isLat = str.includes('СШ') || str.includes('ЮШ') || str.includes('N') || str.includes('S');
  const isLng = str.includes('ВД') || str.includes('ЗД') || str.includes('E') || str.includes('W');

  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return null;
  let num = parseFloat(match[0]);
  if (isNaN(num)) return null;
  if (isSouth || isWest) num = -Math.abs(num);

  return { num, isLat, isLng };
}

/**
 * Парсер файла «площадки.xlsx» («Объекты и координаты»).
 * Столбцы: Название, x (широта), y (долгота).
 */
export async function parsePlatformsFile(file: File): Promise<PlatformImportItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  if (rows.length < 2) return [];

  // Поиск заголовков столбцов
  const header = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase());
  let colNameIdx = header.findIndex((h) => h.includes('назван') || h.includes('объект') || h.includes('имя'));
  let colXIdx = header.findIndex((h) => h === 'x' || h.includes('широт') || h.includes('lat'));
  let colYIdx = header.findIndex((h) => h === 'y' || h.includes('долгот') || h.includes('lng') || h.includes('lon'));

  if (colNameIdx === -1) colNameIdx = 0;
  if (colXIdx === -1) colXIdx = 1;
  if (colYIdx === -1) colYIdx = 2;

  const results: PlatformImportItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rawName = row[colNameIdx];
    if (!rawName) continue;
    const name = String(rawName).trim();

    const c1 = parseGeoCoordinate(row[colXIdx]);
    const c2 = parseGeoCoordinate(row[colYIdx]);
    if (!c1 || !c2) continue;

    let lat: number;
    let lng: number;

    if (c1.isLat || c2.isLng) {
      lat = c1.num;
      lng = c2.num;
    } else if (c1.isLng || c2.isLat) {
      lat = c2.num;
      lng = c1.num;
    } else {
      // Авто-детект по диапазонам широт/долгот РФ/Сибири
      if (c1.num >= 40 && c1.num <= 85 && c2.num >= 20 && c2.num <= 190) {
        lat = c1.num;
        lng = c2.num;
      } else if (c2.num >= 40 && c2.num <= 85 && c1.num >= 20 && c1.num <= 190) {
        lat = c2.num;
        lng = c1.num;
      } else {
        lat = c1.num;
        lng = c2.num;
      }
    }

    results.push({ name, lat, lng });
  }

  return results;
}

export type ProfileImportItem = {
  entityName: string;
  flowType?: string;
  profile: ProductProfile;
  period: string;
  primaryFluid?: 'oil' | 'gas' | 'water';
  rawProductsCount: number;
  rawRows?: Array<{ product: string; unit: string; values: Array<{ year: number; value: number }> }>;
};

/**
 * Парсер файла «добыча-поставка.xlsx» («Профили»).
 * Столбцы: Наименование, Тип, Продукт, Ед.изм, 2026, 2027, ..., 2046.
 */
export async function parseProfilesFile(file: File): Promise<ProfileImportItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  if (rows.length < 2) return [];

  // Заголовок и колонки годов
  const headerRow = rows[0] || [];
  const yearCols: Array<{ year: number; colIdx: number }> = [];

  for (let c = 0; c < headerRow.length; c++) {
    const y = Number(headerRow[c]);
    if (Number.isInteger(y) && y >= 1990 && y <= 2100) {
      yearCols.push({ year: y, colIdx: c });
    }
  }

  if (yearCols.length === 0) return [];
  yearCols.sort((a, b) => a.year - b.year);
  const startYear = yearCols[0].year;
  const endYear = yearCols[yearCols.length - 1].year;
  const period = `${startYear}–${endYear}`;

  // Группировка строк по имени объекта
  type EntityRow = {
    type: string;
    product: string;
    unit: string;
    values: Array<{ year: number; value: number }>;
  };
  const grouped = new Map<string, EntityRow[]>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const entityName = String(row[0]).trim();
    const type = String(row[1] || 'Добыча').trim();
    const product = String(row[2] || '').trim();
    const unit = String(row[3] || '').trim();

    const values = yearCols.map(({ year, colIdx }) => {
      const raw = row[colIdx];
      const val = typeof raw === 'number' ? raw : parseFloat(String(raw || '0').replace(',', '.'));
      return { year, value: isNaN(val) ? 0 : Math.round(val * 100) / 100 };
    });

    const list = grouped.get(entityName) || [];
    list.push({ type, product, unit, values });
    grouped.set(entityName, list);
  }

  const results: ProfileImportItem[] = [];

  for (const [entityName, rowList] of grouped.entries()) {
    const series: ProductSeries[] = [];
    const products: ProductProfile['products'] = [];

    for (const r of rowList) {
      const pLower = r.product.toLowerCase();
      let prodType: ProductType = 'oil';
      if (pLower.includes('нефть')) prodType = 'oil';
      else if (pLower.includes('газ') || pLower.includes('пг') || pLower.includes('пнг') || pLower.includes('сог')) prodType = 'gas';
      else if (pLower.includes('вод')) prodType = 'water';
      else if (pLower.includes('сгк') || pLower.includes('жидк')) prodType = 'liquid';
      else continue; // Пропускаем давление/температуру для графика профилей флюидов

      if (!products.some((p) => p.product === prodType)) {
        products.push({
          product: prodType,
          unit: r.unit || (prodType === 'gas' ? 'млн м³/год' : 'тыс. т/год'),
          enabled: true,
        });
      }

      // Объединяем строки одного типа вещества (например, ПНГ + ПГ) в один ряд с суммированием по годам
      const existing = series.find((s) => s.product === prodType);
      if (existing) {
        for (const pt of r.values) {
          const targetPt = existing.points.find((p) => p.year === pt.year);
          if (targetPt) {
            targetPt.value = Math.round((targetPt.value + pt.value) * 100) / 100;
          } else {
            existing.points.push({ ...pt });
          }
        }
      } else {
        series.push({
          product: prodType,
          points: r.values.map((v) => ({ ...v })),
        });
      }
    }

    // Если нет стандартных флюидов (например, только технологические строки), берем базовый список
    if (products.length === 0) {
      products.push(
        { product: 'oil', unit: 'тыс. т/год', enabled: true },
        { product: 'gas', unit: 'млн м³/год', enabled: true },
        { product: 'water', unit: 'тыс. т/год', enabled: true },
      );
    }

    const measureLabel = rowList[0]?.type?.toLowerCase().includes('поставк') ? 'Поставка' : 'Добыча';

    let primaryFluid: 'oil' | 'gas' | 'water' = 'oil';
    const hasGas = series.some((s) => s.product === 'gas' && s.points.some((p) => p.value > 0));
    const hasOil = series.some((s) => s.product === 'oil' && s.points.some((p) => p.value > 0));
    const hasWater = series.some((s) => s.product === 'water' && s.points.some((p) => p.value > 0));

    if (hasGas && !hasOil) primaryFluid = 'gas';
    else if (hasWater && !hasOil && !hasGas) primaryFluid = 'water';
    else primaryFluid = 'oil';

    const profile: ProductProfile = {
      measureLabel,
      startYear,
      endYear,
      products,
      series,
    };

    results.push({
      entityName,
      flowType: rowList[0]?.type,
      profile,
      period,
      primaryFluid,
      rawProductsCount: rowList.length,
      rawRows: rowList,
    });
  }

  return results;
}

export type ElevationPoint = {
  pointNo: number;
  distanceKm: number;
  elevationM: number;
  groundTempC?: number;
  roughnessMm?: number;
  insulationMm?: number;
  heatTransferCoeff?: number;
};

export type PipelineElevationStats = {
  pipelineName: string;
  totalDistanceKm: number;
  minElevationM: number;
  maxElevationM: number;
  pointsCount: number;
  avgRoughnessMm?: number;
};

export type ElevationImportItem = {
  pipelineName: string;
  points: ElevationPoint[];
  stats: PipelineElevationStats;
};

/**
 * Парсер файла «параметры по длине трубопроводов.xlsx» («Высотные отметки трубопроводов»).
 */
export async function parseElevationsFile(file: File): Promise<ElevationImportItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  if (rows.length < 2) return [];

  const header = (rows[0] || []).map((c) => String(c || '').trim().toLowerCase());
  const colPipeIdx = header.findIndex((h) => h.includes('pipeline') || h.includes('трубопровод') || h.includes('трасс'));
  const colDistIdx = header.findIndex((h) => h.includes('distance') || h.includes('пикетаж') || h.includes('дистанц'));
  const colElevIdx = header.findIndex((h) => h.includes('elevation') || h.includes('отметк') || h.includes('высот'));
  const colPointIdx = header.findIndex((h) => h.includes('point') || h.includes('номер') || h.includes('№'));
  const colRoughIdx = header.findIndex((h) => h.includes('roughness') || h.includes('шероховат'));
  const colTempIdx = header.findIndex((h) => h.includes('temp') || h.includes('температур'));
  const colInsulIdx = header.findIndex((h) => h.includes('insulation') || h.includes('изоляц'));

  const pipeCol = colPipeIdx !== -1 ? colPipeIdx : 1;
  const distCol = colDistIdx !== -1 ? colDistIdx : 3;
  const elevCol = colElevIdx !== -1 ? colElevIdx : 4;
  const pointCol = colPointIdx !== -1 ? colPointIdx : 2;

  const grouped = new Map<string, ElevationPoint[]>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[pipeCol]) continue;
    const pipeName = String(row[pipeCol]).trim();

    const pointNo = Number(row[pointCol]) || i;
    const distanceKm = parseFloat(String(row[distCol] || '0').replace(',', '.')) || 0;
    const elevationM = parseFloat(String(row[elevCol] || '0').replace(',', '.')) || 0;
    const roughnessMm = colRoughIdx !== -1 ? parseFloat(String(row[colRoughIdx] || '0').replace(',', '.')) : undefined;
    const groundTempC = colTempIdx !== -1 ? parseFloat(String(row[colTempIdx] || '0').replace(',', '.')) : undefined;
    const insulationMm = colInsulIdx !== -1 ? parseFloat(String(row[colInsulIdx] || '0').replace(',', '.')) : undefined;

    const list = grouped.get(pipeName) || [];
    list.push({
      pointNo,
      distanceKm: Math.round(distanceKm * 1000) / 1000,
      elevationM: Math.round(elevationM * 10) / 10,
      roughnessMm: roughnessMm != null && !isNaN(roughnessMm) ? roughnessMm : undefined,
      groundTempC: groundTempC != null && !isNaN(groundTempC) ? groundTempC : undefined,
      insulationMm: insulationMm != null && !isNaN(insulationMm) ? insulationMm : undefined,
    });
    grouped.set(pipeName, list);
  }

  const results: ElevationImportItem[] = [];

  for (const [pipelineName, points] of grouped.entries()) {
    points.sort((a, b) => a.distanceKm - b.distanceKm);
    const elevations = points.map((p) => p.elevationM);
    const minElevationM = elevations.length > 0 ? Math.min(...elevations) : 0;
    const maxElevationM = elevations.length > 0 ? Math.max(...elevations) : 0;
    const totalDistanceKm = points.length > 0 ? points[points.length - 1].distanceKm : 0;
    const roughnessList = points.map((p) => p.roughnessMm).filter((r): r is number => r != null && !isNaN(r));
    const avgRoughnessMm =
      roughnessList.length > 0 ? Math.round((roughnessList.reduce((a, b) => a + b, 0) / roughnessList.length) * 1000) / 1000 : undefined;

    results.push({
      pipelineName,
      points,
      stats: {
        pipelineName,
        totalDistanceKm,
        minElevationM,
        maxElevationM,
        pointsCount: points.length,
        avgRoughnessMm,
      },
    });
  }

  return results;
}

export function exportDomainProfile(profile: ProductProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function downloadDomainProfile(profile: ProductProfile, fileName = 'product-profile.json'): void {
  downloadJsonFile(profile, fileName);
}

function isNumeric(s: string): boolean {
  return s.trim() !== '' && Number.isFinite(Number(s.replace(',', '.')));
}

/**
 * Разбор таблицы профиля продукции из текста (CSV/TXT).
 */
export function parseDomainProfileTable(
  text: string,
  products: ReadonlyArray<{ product: ProductType; unit: string }>,
): ProductSeries[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');
  if (lines.length < 2) return null;
  const split = (line: string) => line.split(/[;,]/).map((c) => c.trim());
  const header = split(lines[0]);
  if (header.length < 2) return null;
  const cols = Math.min(header.length - 1, products.length);
  const rows: { year: number; values: number[] }[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const year = Number(cells[0]);
    if (!Number.isInteger(year)) continue;
    const values: number[] = [];
    for (let i = 1; i <= cols; i++) {
      const raw = cells[i] ?? '';
      values.push(isNumeric(raw) ? Number(raw.replace(',', '.')) : 0);
    }
    rows.push({ year, values });
  }
  if (rows.length === 0) return null;
  return products.slice(0, cols).map((p, idx) => ({
    product: p.product,
    points: rows.map((r) => ({ year: r.year, value: r.values[idx] ?? 0 })),
  }));
}
