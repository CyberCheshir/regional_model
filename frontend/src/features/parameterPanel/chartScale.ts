/**
 * Шкалы столбчатой диаграммы профиля продукции (только представление).
 *
 * Ряд попадает на шкалу по СВОЕЙ единице измерения из профиля, а не по типу продукта:
 *   - массовые единицы (…т/год)   → левая шкала;
 *   - объёмные единицы (…м³/год)  → правая шкала.
 * Значения между единицами не пересчитываются: если единица ряда не совпадает
 * ни с одной из двух шкал, ряд не рисуется и возвращается в `unplotted`.
 */
import type { ProductType } from '../../domain/types';

export type AxisSide = 'left' | 'right';
export type UnitKind = 'mass' | 'volume' | 'other';

/** Ключ сравнения единиц: регистр, пробелы, точки, «³»/«^3» не влияют («тыс.т/год» = «тыс. т/год»). */
export function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/³/g, '3').replace(/[\s.^]/g, '');
}

/** Род единицы: масса (т), объём (м³) или прочее. */
export function classifyUnit(unit: string): UnitKind {
  const u = normalizeUnit(unit);
  if (u.includes('м3')) return 'volume';
  if (u.includes('т/')) return 'mass';
  return 'other';
}

/** Типографика подписи единицы: «м3»/«м^3» → «м³». Сама единица не меняется. */
export function prettyUnit(unit: string): string {
  return unit.replace(/м\s*\^?\s*3/g, 'м³');
}

export type AxisInfo = {
  /** Единица шкалы — как в профиле (первый ряд этой шкалы) */
  unit: string;
  unitKey: string;
  products: ProductType[];
};

export type AxisAssignment = {
  axes: Partial<Record<AxisSide, AxisInfo>>;
  /** Ряды, единица которых не совпала ни с одной шкалой */
  unplotted: Array<{ product: ProductType; unit: string }>;
};

/** Основные единицы шкал: слева тыс. т/год, справа млн м³/год — занимают шкалу первыми. */
const PREFERRED_UNIT_KEY: Record<AxisSide, string> = {
  left: normalizeUnit('тыс. т/год'),
  right: normalizeUnit('млн м³/год'),
};

/**
 * Распределение рядов по шкалам. Сначала шкалы получают основные единицы
 * (PREFERRED_UNIT_KEY), затем остальные ряды — по роду единицы; порядок рядов
 * внутри шкалы сохраняется.
 */
export function assignAxes(items: ReadonlyArray<{ product: ProductType; unit: string }>): AxisAssignment {
  const axes: AxisAssignment['axes'] = {};
  const unplotted: AxisAssignment['unplotted'] = [];
  const sides: AxisSide[] = ['left', 'right'];

  for (const side of sides) {
    const first = items.find((it) => normalizeUnit(it.unit) === PREFERRED_UNIT_KEY[side]);
    if (first) axes[side] = { unit: first.unit, unitKey: PREFERRED_UNIT_KEY[side], products: [] };
  }

  for (const it of items) {
    const unitKey = normalizeUnit(it.unit);
    const same = sides.find((s) => axes[s]?.unitKey === unitKey);
    if (same) {
      axes[same]!.products.push(it.product);
      continue;
    }
    const kind = classifyUnit(it.unit);
    const preferred: AxisSide[] = kind === 'mass' ? ['left'] : kind === 'volume' ? ['right'] : sides;
    const free = preferred.find((s) => !axes[s]);
    if (free) axes[free] = { unit: it.unit, unitKey, products: [it.product] };
    else unplotted.push({ product: it.product, unit: it.unit });
  }
  return { axes, unplotted };
}

export type AxisScale = {
  /** Верх шкалы (кратен шагу) */
  max: number;
  step: number;
  /** Деления снизу вверх; fraction — доля высоты (0…1) */
  ticks: Array<{ value: number; fraction: number }>;
  /** Знаков после запятой в подписях делений */
  decimals: number;
};

/** «Круглые» множители шага: деления 0, 1500, 3000… читаются легко и плотно облегают данные. */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Шкала от 0 с `intervals` равными интервалами и «круглым» шагом, покрывающая dataMax. */
export function niceScale(dataMax: number, intervals: number): AxisScale {
  // Нет данных (все нули) — целые деления 0, 1, 2… вместо «0,00 0,25 0,50…».
  const safeMax = Number.isFinite(dataMax) && dataMax > 0 ? dataMax : intervals;
  const raw = safeMax / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const mult = NICE_STEPS.find((n) => n * mag >= raw * (1 - 1e-9)) ?? 10;
  const step = mult * mag;

  let decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const scaled = step * 10 ** decimals;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) decimals += 1;

  const ticks = Array.from({ length: intervals + 1 }, (_, i) => ({ value: step * i, fraction: i / intervals }));
  return { max: step * intervals, step, ticks, decimals };
}

/**
 * Общее число интервалов для всех шкал (4 или 5), чтобы деления левой и правой
 * шкал лежали на одних линиях сетки. Выбирается вариант, при котором самый
 * «пустой» ряд заполняет высоту графика сильнее.
 */
export function chooseIntervals(dataMaxes: number[]): number {
  let best = 4;
  let bestFill = -1;
  for (const n of [4, 5]) {
    const fill = Math.min(...dataMaxes.map((m) => (m > 0 ? m / niceScale(m, n).max : 1)));
    if (fill > bestFill + 1e-9) {
      best = n;
      bestFill = fill;
    }
  }
  return best;
}

/** Подпись деления: разделитель групп и десятичная запятая по ru-RU. */
export function formatTick(value: number, decimals: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
