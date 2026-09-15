import type { ObjectTreeData } from './types';

/**
 * Мок-доменные данные дерева объектов.
 * Пока пусто: наполнение появится при проектировании графа (кнопки «Проектирование»).
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
