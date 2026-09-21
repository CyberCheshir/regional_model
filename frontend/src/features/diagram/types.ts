import type { FluidType } from '../map/mapData';
import { DEFAULT_TIME_RANGE } from '../timeRange/types';

export const FLUID_LABELS = {
  oil: 'Нефть',
  gas: 'Газ',
  product: 'Продукт',
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
  // Диапазон берём из шкалы периода — иначе при смене года он вышел бы за её границы.
  customRange: [...DEFAULT_TIME_RANGE.range],
  placement: 'auto',
};
