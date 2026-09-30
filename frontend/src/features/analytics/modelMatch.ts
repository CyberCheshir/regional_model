import type { GraphNode } from '../../domain/types';
import type { Pipeline } from '../../domain/types';

/** Результат сопоставления элемента с объектами модели */
export type ElementMatch = { label: string } | undefined;

/**
 * Ищет элемент модели (вершину или трубопровод), чья подпись содержит имя `element`
 * (без учета регистра). Общая логика для вкладок аналитики, обогащающих
 * макетные данные реальными объектами карты.
 */
export function matchElementLabel(
  vertices: GraphNode[],
  pipelines: Pipeline[],
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
  pipelines: Pipeline[],
): T[] {
  if (vertices.length === 0 && pipelines.length === 0) {
    return items;
  }
  return items.map((item) => {
    const match = matchElementLabel(vertices, pipelines, item.element);
    return match ? { ...item, element: match.label } : item;
  });
}
