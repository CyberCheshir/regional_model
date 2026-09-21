/**
 * Нижняя панель «Демонстрируемый период» (макет `UI images/bottom panel.png`).
 *
 * Период задаётся одним из трёх режимов:
 *  - 'year'   — демонстрируется один год (`year`);
 *  - 'period' — демонстрируется диапазон годов (`range` = [начало, конец]);
 *  - 'all'    — демонстрируется весь период проекта (`PROJECT_YEARS`).
 *
 * Значения годов хранятся ЧИСЛАМИ, в UI отображаются как «2030» и т.п.
 */

/** Режим отображения периода. */
export type TimeRangeMode = 'year' | 'period' | 'all';

/** Двойной диапазон годов: [начало, конец], начало ≤ конец. */
export type YearRange = [number, number];

/** Состояние нижней панели периода (это же значение уходит наверх, в App). */
export type TimeRangeState = {
  mode: TimeRangeMode;
  /** Выбранный год для режима 'year'. */
  year: number;
  /** Выбранный диапазон для режима 'period'. */
  range: YearRange;
};

/**
 * Горизонт проекта (длительность шкалы) в годах.
 * Начало шкалы — ТЕКУЩИЙ год, конец — текущий + (HORIZON_YEARS − 1).
 * В 2026 году это даёт ровно ось макета 2026…2040 (15 лет).
 */
export const PROJECT_HORIZON_YEARS = 15;

/**
 * Первый год шкалы — текущий календарный год.
 * Вычисляется при загрузке модуля; в разные годы значение будет разным.
 */
export function projectStartYear(now: Date = new Date()): number {
  return now.getFullYear();
}

/** Последний год шкалы (начало + горизонт − 1). */
export function projectEndYear(now: Date = new Date()): number {
  return projectStartYear(now) + PROJECT_HORIZON_YEARS - 1;
}

/** Все годы шкалы проекта (для насечек и режима «Всё время»). */
export function projectYears(now: Date = new Date()): number[] {
  const start = projectStartYear(now);
  return Array.from({ length: PROJECT_HORIZON_YEARS }, (_, index) => start + index);
}

/**
 * Годы, подписи которых рисуются крупно (в макете: 2026, 2028, 2030, 2032,
 * 2035, 2038, 2040 — то есть начало, каждый чётный, и последний год шкалы).
 * Остальные годы — мелкие насечки.
 */
export function projectMajorYears(now: Date = new Date()): number[] {
  const start = projectStartYear(now);
  const end = projectEndYear(now);
  const major = projectYears(now).filter(
    (year) => year === start || year === end || year % 2 === 0,
  );
  return major;
}

/**
 * Текущая шкала проекта для ПРОДАКШНА (вычисляется один раз при загрузке модуля).
 * Держим как константы для обычного использования; тесты/утилиты могут
 * вызвать `projectYears(now)` с явной датой.
 */
export const PROJECT_YEAR_MIN = projectStartYear();
export const PROJECT_YEAR_MAX = projectEndYear();

/** Все годы шкалы (производное от PROJECT_YEAR_MIN/MAX). */
export const PROJECT_YEARS: readonly number[] = projectYears();

/** Акцентные годы шкалы (производное от границ). */
export const PROJECT_YEAR_MAJOR: readonly number[] = projectMajorYears();

/**
 * Значение по умолчанию: диапазон от 5-го до 10-го года шкалы
 * (в 2026 году это ровно 2030–2035, как в макете).
 */
const DEFAULT_OFFSET_FROM = 4;
const DEFAULT_OFFSET_TO = 9;

export const DEFAULT_TIME_RANGE: TimeRangeState = {
  mode: 'period',
  year: PROJECT_YEAR_MIN + DEFAULT_OFFSET_FROM,
  range: [PROJECT_YEAR_MIN + DEFAULT_OFFSET_FROM, PROJECT_YEAR_MIN + DEFAULT_OFFSET_TO],
};

/** Подписи режимов для сегментированного переключателя. */
export const TIME_RANGE_MODE_LABEL: Record<TimeRangeMode, string> = {
  year: 'Год',
  period: 'Период',
  all: 'Всё время',
};

/** Порядок режимов в переключателе. */
export const TIME_RANGE_MODE_ORDER: readonly TimeRangeMode[] = ['year', 'period', 'all'];

/** Ограничить значение шкалой проекта. */
export function clampYear(year: number): number {
  return Math.min(PROJECT_YEAR_MAX, Math.max(PROJECT_YEAR_MIN, Math.round(year)));
}

/**
 * Привести диапазон к корректному виду БЕЗ перестановки концов.
 *
 * `moving` — какую ручку тянет пользователь; «залипшая» ручка остаётся
 * на месте, а тянущая ограничивается ею:
 *   - левая не может стать правее правой (максимум — end);
 *   - правая не может стать левее левой (минимум — start).
 *
 * Раньше функция меняла концы местами (`[end, start]`) — из-за этого ручки
 * «перекрещивались»: пользователь тянул левую ручку, она становилась правой,
 * и дальнейшее перетаскивание теряло захват.
 */
export function normalizeRange(range: YearRange, moving: 'start' | 'end'): YearRange {
  const start = clampYear(range[0]);
  const end = clampYear(range[1]);
  if (moving === 'start') {
    // Левая ручка: не правее правой; при совпадении отступаем на год влево.
    const maxStart = end === start ? Math.max(PROJECT_YEAR_MIN, end - 1) : end;
    return [Math.min(start, maxStart), end];
  }
  // Правая ручка: не левее левой; при совпадении отступаем на год вправо.
  const minEnd = start === end ? Math.min(PROJECT_YEAR_MAX, start + 1) : start;
  return [start, Math.max(end, minEnd)];
}

/** Человекочитаемое описание выбранного периода (для title/подписи). */
export function describeTimeRange(state: TimeRangeState): string {
  switch (state.mode) {
    case 'year':
      return `${state.year}`;
    case 'all':
      return `${PROJECT_YEAR_MIN}–${PROJECT_YEAR_MAX}`;
    case 'period':
    default:
      return `${state.range[0]}–${state.range[1]}`;
  }
}
