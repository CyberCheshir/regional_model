/**
 * Проверка парсера участков на образцах (фигуры 1–3).
 * Запуск: node frontend/scripts/check-import-samples.mjs
 * Сравнивает результат parseTable-логики с ожидаемым числом участков/точек.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(here, '..', 'public', 'samples');

// --- Копия ключевой логики importAreas.ts (для проверки без сборки TS) ---
function parseNum(cell) {
  if (cell === undefined) return null;
  const n = cell.replace(',', '.').trim();
  if (n === '' || n === '—' || n === '-') return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}
function splitRow(line) {
  if (line.includes('|')) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  }
  const d = line.includes(';') ? ';' : ',';
  return line.split(d).map((c) => c.trim());
}
function isSeparatorRow(line) {
  return /^\s*\|?[\s:|-]+$/.test(line) && line.includes('-');
}
function locateColumns(header) {
  const find = (ps) => header.findIndex((h) => ps.some((re) => re.test(h)));
  let svg = find([/svg/i, /участ/i, /area/i, /id/i]);
  let xNorm = find([/x.*norm/i, /^x$/i, /^x,/i]);
  let yNorm = find([/y.*norm/i, /^y$/i, /^y,/i]);
  const last = header.length - 1;
  if (xNorm < 0) xNorm = last - 1;
  if (yNorm < 0) yNorm = last;
  if (svg < 0) svg = 0;
  return { svg, xNorm, yNorm };
}
function parseTable(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
  if (lines.length === 0) return null;
  const cols = locateColumns(splitRow(lines[0]));
  const groups = new Map();
  const order = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    const x = parseNum(cells[cols.xNorm]);
    const y = parseNum(cells[cols.yNorm]);
    if (x === null || y === null) continue;
    const key = cells[cols.svg]?.trim() || '1';
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push({ x, y });
  }
  if (order.length === 0) return null;
  return order.map((k, i) => ({ name: `Лицензионный участок ${i + 1}`, norm: groups.get(k) }));
}

// --- Ожидания ---
const EXPECTED = {
  'licence-areas-figures-1-3.txt': [{ count: 9 }, { count: 14 }, { count: 9 }],
  'licence-areas-figures-1-3.csv': [{ count: 9 }, { count: 14 }, { count: 9 }],
};

let failures = 0;
for (const [file, expected] of Object.entries(EXPECTED)) {
  const text = readFileSync(join(samplesDir, file), 'utf8');
  const areas = parseTable(text);
  const ok =
    areas &&
    areas.length === expected.length &&
    areas.every((a, i) => a.norm.length === expected[i].count);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}: участков=${areas?.length}, точек=${areas?.map((a) => a.norm.length).join(',')}`);
  if (!ok) failures++;
}

// JSON-образец (3 участка)
try {
  const json = JSON.parse(readFileSync(join(samplesDir, 'licence-areas-figures-1-3.json'), 'utf8'));
  const ok = Array.isArray(json) && json.length === 3 && json[1].points.length === 14;
  console.log(`${ok ? 'PASS' : 'FAIL'}  licence-areas-figures-1-3.json: участков=${json.length}`);
  if (!ok) failures++;
} catch (e) {
  console.log(`FAIL  json: ${e.message}`);
  failures++;
}

// Основной файл меню «Примеры» — все 7 участков
try {
  const json = JSON.parse(readFileSync(join(samplesDir, 'licence-areas-1-7.json'), 'utf8'));
  const EXPECT_POINTS = [9, 14, 9, 10, 9, 7, 5];
  const ok =
    Array.isArray(json) &&
    json.length === 7 &&
    json.every((a, i) => a.points.length === EXPECT_POINTS[i]) &&
    json.every((a) => a.points.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
  console.log(`${ok ? 'PASS' : 'FAIL'}  licence-areas-1-7.json: участков=${json.length}, точки=${json.map((a) => a.points.length).join(',')}`);
  if (!ok) failures++;
} catch (e) {
  console.log(`FAIL  licence-areas-1-7.json: ${e.message}`);
  failures++;
}

// GeoJSON-образец (валидность + замкнутость контуров)
try {
  const gj = JSON.parse(readFileSync(join(samplesDir, 'licence-areas-figures-1-3.geojson'), 'utf8'));
  const ok =
    gj.type === 'FeatureCollection' &&
    gj.features.length === 3 &&
    gj.features.every((f) => {
      const ring = f.geometry.coordinates[0];
      const first = ring[0], last = ring[ring.length - 1];
      return ring.length >= 4 && first[0] === last[0] && first[1] === last[1];
    });
  console.log(`${ok ? 'PASS' : 'FAIL'}  licence-areas-figures-1-3.geojson: фич=${gj.features.length}, контуры замкнуты`);
  if (!ok) failures++;
} catch (e) {
  console.log(`FAIL  geojson: ${e.message}`);
  failures++;
}

console.log(failures === 0 ? '\nВсе образцы корректны.' : `\nПровалов: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
