/**
 * Модель данных дерева объектов (design description/components.md §3.2).
 * Группы первого уровня — категории (кусты, объекты подготовки, точки
 * поставки, трубопроводы); внутри — подгруппы и листовые узлы.
 */

/** Категория объекта — определяет иконку узла дерева */
export type TreeNodeKind =
  | 'wellpad'
  | 'facility'
  | 'delivery-point'
  | 'pipeline'
  /** Сегмент трубопровода (дочерний узел трубопровода в дереве) */
  | 'segment';

export type TreeNodeData = {
  id: string;
  /** Отображаемое имя узла */
  label: string;
  /** Категория — влияет на иконку и цвет */
  kind: TreeNodeKind;
  /** Подтип для вторичной строки (например, «УПН», «Куст 1») */
  subType?: string;
  children?: TreeNodeData[];
};

export type ObjectTreeData = {
  id: string;
  label: string;
  children: TreeNodeData[];
};
