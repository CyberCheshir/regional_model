import type { TreeNodeKind } from '../objectTree/types';

/**
 * Мок-данные карты: узлы-объекты и рёбра-трубопроводы (design.png).
 * Координаты фиксированные (physics отключён) — стабильный «план месторождения».
 * Заменяются загрузкой с API на этапе 9.
 */

export type MapNodeKind = Exclude<TreeNodeKind, 'pipeline'>;

export type MapNodeData = {
  id: string;
  label: string;
  kind: MapNodeKind;
  x: number;
  y: number;
  /** Активные предупреждения — подсветка, если showWarnings */
  warnings?: number;
};

export type FluidType = 'oil' | 'gas' | 'product';

export type MapEdgeData = {
  id: string;
  from: string;
  to: string;
  label: string;
  fluid: FluidType;
  /** Расход для бейджа на ребре, например «1,8 млн м³/сут» */
  flowLabel: string;
};

// Граф пока пуст: наполняется через панель «Проектирование».
export const mockMapNodes: MapNodeData[] = [];

export const mockMapEdges: MapEdgeData[] = [];

/** Рёбра, инцидентные узлу, — для скрытия узла вместе с его трубопроводами. */
export function edgesConnectedTo(nodeId: string, edges: MapEdgeData[]): MapEdgeData[] {
  return edges.filter((e) => e.from === nodeId || e.to === nodeId);
}
