/**
 * Константы и утилиты ширины панелей AppShell.
 * Источник дефолтов: design description/styles.md §3.5.
 */

/** Ширины колонок макета по умолчанию, px */
export const SHELL_COLUMNS = {
  activity: 56,
  left: 200,
  right: 380,
} as const;

/** Границы ручного изменения ширины боковых панелей, px */
export const PANEL_WIDTH_LIMITS = {
  min: 180,
  max: 560,
  /** Минимальная ширина левой панели (sidebar) */
  leftMin: 300,
} as const;

/** Ширина разделителя (sash), px */
export const RESIZER_WIDTH_PX = 6;

/** Ограничение ширины панели допустимым диапазоном (min можно переопределить). */
export function clampWidth(width: number, min: number = PANEL_WIDTH_LIMITS.min): number {
  return Math.min(Math.max(width, min), PANEL_WIDTH_LIMITS.max);
}
