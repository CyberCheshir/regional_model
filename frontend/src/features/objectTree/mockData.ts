import type { ObjectTreeData } from './types';

/**
 * Стартовые/базовые данные дерева объектов («Группы элементов»).
 * По умолчанию пусто: наполняется при проектировании графа на карте (кнопки «Проектирование»)
 * или при загрузке сценария.
 */
export const mockTreeData: ObjectTreeData[] = [];

/** Плоский список всех узлов дерева (группы + объекты). */
export const flattenTreeNodes: readonly ObjectTreeData[] = mockTreeData.flatMap(
  (group) => [group, ...group.children] as ObjectTreeData[],
);

/** Поиск узла дерева по id (null, если не найден). */
export function findTreeNode(id: string): ObjectTreeData | null {
  return flattenTreeNodes.find((n) => n.id === id) ?? null;
}
