import type { FluidType } from '../map/mapData';

export const FLUID_LABELS = {
  oil: 'Нефть',
  gas: 'Газ',
  water: 'Вода',
} as const satisfies Record<FluidType, string>;

export const PERIOD_LABELS = {
  map: 'Как на карте',
  project: 'Весь период проекта',
  custom: 'Свой диапазон',
} as const;

export const PLACEMENT_LABELS = {
  auto: 'Авто',
  top: 'Сверху',
  bottom: 'Снизу',
  left: 'Слева',
  right: 'Справа',
} as const;

/** Конфигурация плавающей диаграммы (components.md §3.1 diagramModalState). */
export type DiagramConfig = {
  fluid: FluidType;
  periodMode: 'map' | 'project' | 'custom';
  customRange: [number, number];
  placement: 'auto' | 'top' | 'bottom' | 'left' | 'right';
};

export const DEFAULT_DIAGRAM_CONFIG: DiagramConfig = {
  fluid: 'oil',
  periodMode: 'map',
  customRange: [2030, 2035],
  placement: 'auto',
};
