import type { GraphNode } from '../../domain/types';
import type { MapVertex } from '../map/drawingTypes';
import type { PipelineRecord } from '../map/mapDrawingHelpers';

/** Результат сопоставления элемента с объектами модели */
export type ElementMatch = { label: string } | undefined;

/**
 * Привести вершины-объекты карты (MapVertex) к форме узла графа (GraphNode).
 * Сопоставление идёт по label, поэтому нужен только он;
 * id/kind/entityId заполняются для соблюдения контракта GraphNode.
 */
export function toGraphNodes(vertices: MapVertex[]): GraphNode[] {
  return vertices.map((v) => ({
    id: v.id,
    label: v.label,
    kind:
      v.kind === 'wellpad'
        ? 'wellpad'
        : v.kind === 'delivery-point'
          ? 'delivery'
          : 'processing',
    entityId: v.uid,
  }));
}

/**
 * Ищет элемент модели (вершину или трубопровод), чья подпись содержит имя `element`
 * (без учета регистра). Общая логика для вкладок аналитики, обогащающих
 * макетные данные реальными объектами карты.
 */
export function matchElementLabel(
  vertices: GraphNode[],
  pipelines: readonly { label: string }[],
  element: string,
): ElementMatch {
  const needle = element.toLowerCase();
  return (
    vertices.find((v) => v.label.toLowerCase().includes(needle)) ??
    pipelines.find((p) => p.label.toLowerCase().includes(needle))
  );
}

/**
 * Обогащает список макетных элементов реальными подписями объектов модели:
 * при совпадении подставляет label вершины/трубопровода вместо макетного имени.
 * Возвращает исходный список, если модель пуста.
 */
export function enrichWithModelElements<T extends { element: string }>(
  items: T[],
  vertices: GraphNode[],
  pipelines: readonly PipelineRecord[],
): T[] {
  if (vertices.length === 0 && pipelines.length === 0) {
    return items;
  }
  return items.map((item) => {
    const match = matchElementLabel(vertices, pipelines, item.element);
    return match ? { ...item, element: match.label } : item;
  });
}
