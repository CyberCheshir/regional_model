/**
 * Цветовая палитра карты (Этап 6).
 *
 * Значения дублируют CSS-токены из styles.css, т.к. canvas vis-network
 * не умеет читать CSS-переменные (см. problem_log/frontend.md, Этап 6).
 * При изменении токенов в styles.css синхронизировать значения здесь.
 */

/** Цвета маркеров узлов (объекты добычи/подготовки/сдачи) */
export const MARKER_COLORS = {
  wellpad: '#F97316', // --marker-wellpad
  facility: '#22C55E', // --marker-processing
  'delivery-point': '#38BDF8', // --marker-delivery
} as const;

/** Цвет маркера узла по его виду; неизвестные виды — нейтральный. */
export function getMarkerColor(kind: string): string {
  return (MARKER_COLORS as Record<string, string | undefined>)[kind] ?? '#94A3B8';
}

/** Цвета флюидов рёбер (трубопроводы) */
export const FLUID_COLORS = {
  oil: '#0066CC', // --pipeline-oil
  gas: '#D97706', // --pipeline-gas
  water: '#0EA5E9', // --pipeline-water
} as const;

/** Цвет подписей рёбер на тёмной подложке */
export const EDGE_LABEL_COLOR = '#C3CDE0';

/** Цвет выделения ребра/узла */
export const HIGHLIGHT_COLOR = '#FFFFFF';

/**
 * Стрелки направления на рёбрах (граф ориентированный — потоки текут
 * от начала ребра к его концу: from → to).
 */
export const EDGE_ARROWS = {
  to: { enabled: true, scaleFactor: 0.4 },
} as const;

/** Базовая толщина ребра, px. */
export const EDGE_WIDTH = 3;

/** Толщина выделенного ребра, px (UX: выделение — лёгкое утолщение, не смена цвета). */
export const EDGE_SELECT_WIDTH = 5;
