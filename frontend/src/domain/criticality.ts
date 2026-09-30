import type { CriticalityLevel } from './types';

/**
 * Единая семантика уровней критичности для всего фронтенда.
 * Цвета и классы тона описаны в styles/tokens.css, здесь — только маппинг.
 */

/** CSS-класс тона (`.ui-tone-*` из components/ui/ui.css) — для текста и точек. */
const TONE_CLASS: Record<CriticalityLevel, string> = {
  critical: 'ui-tone-critical',
  high: 'ui-tone-high',
  medium: 'ui-tone-medium',
  low: 'ui-tone-low',
};

/** CSS-переменная цвета (для inline-стилей SVG и полос прогресса). */
const TONE_VAR: Record<CriticalityLevel, string> = {
  critical: 'var(--level-critical)',
  high: 'var(--level-high)',
  medium: 'var(--level-medium)',
  low: 'var(--level-low)',
};

/** Подписи уровня для UI (легенды, подсказки, aria). */
export const CRITICALITY_LABELS: Record<CriticalityLevel, string> = {
  critical: 'Критичная',
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

export function criticalityToneClass(level: CriticalityLevel): string {
  return TONE_CLASS[level];
}

export function criticalityColor(level: CriticalityLevel): string {
  return TONE_VAR[level];
}
