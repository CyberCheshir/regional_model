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
  oil: '#0066CC', // --pipeline-oil — Нефть (синий)
  gas: '#D97706', // --pipeline-gas — Газ (жёлто-оранжевый)
  product: '#1E3A8A', // Продукт (тёмно-синий / navy)
} as const;

/** Цвет ребра по флюиду; неизвестный — нейтральный «нефть». */
export function getFluidColor(fluid: string): string {
  return (FLUID_COLORS as Record<string, string | undefined>)[fluid] ?? FLUID_COLORS.oil;
}

/** Цвет «Логического потока» — тёмно-серый (не зависит от флюида). */
export const LOGICAL_FLOW_COLOR = '#4B5563';

/**
 * Итоговый цвет ребра с учётом класса и флюида:
 * «Логический поток» — всегда тёмно-серый, остальные классы — цвет флюида.
 */
export function getEdgeColor(fluid: string, pipelineClass: string): string {
  return pipelineClass === 'logical' ? LOGICAL_FLOW_COLOR : getFluidColor(fluid);
}

/**
 * Стиль ребра по КЛАССУ трубопровода (ортогонален цвету флюида):
 * толщина линии задаёт значимость, «логический поток» — пунктир.
 * Значения соответствуют макету «Класс трубопровода».
 */
export const PIPELINE_CLASS_STYLE: Record<
  'field' | 'interfield' | 'trunk' | 'logical',
  { width: number; dash?: string }
> = {
  field: { width: 2.5 }, // Промысловый — тонкая
  interfield: { width: 4 }, // Межпромысловый — толще
  trunk: { width: 6 }, // Магистральный — самая толстая
  logical: { width: 2.5, dash: '8 6' }, // Логический поток — пунктир
};

/** Стиль ребра по классу с откатом на «промысловый» для неизвестных значений. */
export function getPipelineClassStyle(pipelineClass: string): {
  width: number;
  dash?: string;
} {
  return (
    PIPELINE_CLASS_STYLE[
      pipelineClass as keyof typeof PIPELINE_CLASS_STYLE
    ] ?? PIPELINE_CLASS_STYLE.field
  );
}

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
