import { useState } from 'react';
import type { ObjectTreeData, TreeNodeData } from './types';
import { AppIcon } from '../../components/AppIcon';
import type { IconName } from '../../components/IconRegistry';
import './ObjectTree.css';

/** Иконка по категории узла (icons.md: tree-*) */
const KIND_ICON: Record<TreeNodeData['kind'], IconName> = {
  wellpad: 'tree-wellpad',
  facility: 'tree-facility',
  'delivery-point': 'tree-delivery-point',
  pipeline: 'tree-pipeline',
};

export type ObjectTreeEvents = {
  /** Клик по узлу — выбор объекта (инспектор, карта) */
  onSelect?: (node: TreeNodeData) => void;
  /** Открыть диаграмму по объекту (floating modal) */
  onOpenDiagram?: (node: TreeNodeData) => void;
  /** Показать/скрыть объект на карте */
  onToggleVisibility?: (node: TreeNodeData, visible: boolean) => void;
};

type ObjectTreeProps = ObjectTreeEvents & {
  groups: ObjectTreeData[];
  /** id выделенного узла */
  selectedId?: string | null;
  /** id узлов, скрытых на карте */
  hiddenIds?: ReadonlySet<string>;
  /** id раскрытых групп (controlled); по умолчанию — внутреннее состояние */
  expandedIds?: ReadonlySet<string>;
  onExpandedChange?: (ids: ReadonlySet<string>) => void;
};

/**
 * Дерево объектов: группы → подгруппы/узлы → вложенные узлы.
 * Строки-узлы: иконка категории, имя, быстрые действия (диаграмма, глаз).
 */
export function ObjectTree({
  groups,
  selectedId,
  hiddenIds,
  expandedIds,
  onExpandedChange,
  onSelect,
  onOpenDiagram,
  onToggleVisibility,
}: ObjectTreeProps) {
  const [internalExpanded, setInternalExpanded] = useState<ReadonlySet<string>>(
    () => new Set(groups.map((g) => g.id)),
  );
  const expanded = expandedIds ?? internalExpanded;

  // Авто-раскрытие новых групп верхнего уровня (например, «Трубопроводы»,
  // появившейся при проектировании). Уже раскрытые/свёрнутые пользователем не трогаем.
  const [knownGroupIds, setKnownGroupIds] = useState<ReadonlySet<string>>(
    () => new Set(groups.map((g) => g.id)),
  );
  const groupIds = groups.map((g) => g.id);
  const hasNewGroup = groupIds.some((id) => !knownGroupIds.has(id));
  if (hasNewGroup && !expandedIds) {
    setKnownGroupIds(new Set(groupIds));
    setInternalExpanded((prev) => {
      const next = new Set(prev);
      groupIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (onExpandedChange) onExpandedChange(next);
    else setInternalExpanded(next);
  };

  return (
    <ul className="object-tree" role="tree" aria-label="Дерево объектов">
      {groups.map((group) => (
        <TreeBranch
          key={group.id}
          node={groupNode(group)}
          depth={0}
          expanded={expanded}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          onToggleExpand={toggleExpand}
          onSelect={onSelect}
          onOpenDiagram={onOpenDiagram}
          onToggleVisibility={onToggleVisibility}
        />
      ))}
    </ul>
  );
}

/** Оборачивает группу верхнего уровня в узловое представление */
function groupNode(group: ObjectTreeData): TreeNodeData {
  return { id: group.id, label: group.label, kind: 'facility', children: group.children };
}

type TreeBranchProps = ObjectTreeEvents & {
  node: TreeNodeData;
  depth: number;
  expanded: ReadonlySet<string>;
  selectedId?: string | null;
  hiddenIds?: ReadonlySet<string>;
  onToggleExpand: (id: string) => void;
};

/** Рекурсивная ветка дерева: контейнер или листовой узел */
function TreeBranch({
  node,
  depth,
  expanded,
  selectedId,
  hiddenIds,
  onToggleExpand,
  onSelect,
  onOpenDiagram,
  onToggleVisibility,
}: TreeBranchProps) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isHidden = hiddenIds?.has(node.id) ?? false;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
      <div
        className={
          'object-tree__row' +
          (isSelected ? ' object-tree__row--selected' : '') +
          (isHidden ? ' object-tree__row--hidden' : '')
        }
        style={{ paddingLeft: 12 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="object-tree__chevron"
            aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
            onClick={() => onToggleExpand(node.id)}
          >
            <AppIcon name="chevron" size={12} flipped={!isOpen} />
          </button>
        ) : (
          <span className="object-tree__chevron object-tree__chevron--stub" />
        )}

        <AppIcon name={KIND_ICON[node.kind]} size={16} className="object-tree__kind-icon" />

        <button type="button" className="object-tree__label" onClick={() => onSelect?.(node)}>
          <span className="object-tree__name">{node.label}</span>
          {node.subType && <span className="object-tree__sub">{node.subType}</span>}
        </button>

        <span className="object-tree__actions">
          <button
            type="button"
            className="object-tree__action"
            aria-label={`Диаграмма: ${node.label}`}
            title="Диаграмма"
            onClick={() => onOpenDiagram?.(node)}
          >
            <AppIcon name="action-chart" size={14} />
          </button>
          <button
            type="button"
            className={
              'object-tree__action' + (isHidden ? ' object-tree__action--off' : '')
            }
            aria-label={isHidden ? `Показать ${node.label}` : `Скрыть ${node.label}`}
            title={isHidden ? 'Показать' : 'Скрыть'}
            onClick={() => onToggleVisibility?.(node, isHidden)}
          >
            <AppIcon name="action-visibility" size={14} />
          </button>
        </span>
      </div>

      {hasChildren && isOpen && (
        <ul className="object-tree__children">
          {node.children!.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              hiddenIds={hiddenIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onOpenDiagram={onOpenDiagram}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
