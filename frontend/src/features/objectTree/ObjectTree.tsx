import { useEffect, useRef, useState } from 'react';
import type { ObjectTreeData, TreeNodeData } from './types';
import { AppIcon } from '../../components/AppIcon';
import tapIcon from '../../assets/design/tap.png';
import wellpadIcon from '../../assets/design/wellpad.png';
import facilityIcon from '../../assets/design/facility.png';
import deliveryPointIcon from '../../assets/design/delivery-point.png';
import pipelineIcon from '../../assets/design/pipeline.png';
import './ObjectTree.css';

/** PNG-иконки групп совпадают с кнопками соответствующих инструментов. */
const GROUP_ICON: Record<string, string> = {
  'group-wellpads': wellpadIcon,
  'group-facilities': facilityIcon,
  'group-delivery': deliveryPointIcon,
  'group-pipelines': pipelineIcon,
  'group-taps': tapIcon,
};

export type ObjectTreeEvents = {
  /** Клик по узлу — выбор объекта (инспектор, карта) */
  onSelect?: (node: TreeNodeData) => void;
  /** Открыть диаграмму по объекту (floating modal) */
  onOpenDiagram?: (node: TreeNodeData) => void;
  /** Показать/скрыть объект на карте */
  onToggleVisibility?: (node: TreeNodeData, visible: boolean) => void;
  /**
   * Переименовать узел (двойной клик по имени). Вызывается только при
   * изменённом непустом имени — отмена/без изменений сюда не попадают.
   */
  onRename?: (node: TreeNodeData, nextLabel: string) => void;
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
  onRename,
}: ObjectTreeProps) {
  // Все группы и вложенные узлы по умолчанию свернуты.
  // Новые элементы также не раскрываются автоматически: состояние дерева
  // должно оставаться предсказуемым после добавления объектов.
  const [internalExpanded, setInternalExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const expanded = expandedIds ?? internalExpanded;

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
          onRename={onRename}
        />
      ))}
    </ul>
  );
}

/** Оборачивает группу верхнего уровня в узловое представление */
function groupNode(group: ObjectTreeData): TreeNodeData {
  return { id: group.id, label: group.label, kind: 'facility', children: group.children };
}

/** Рекурсивная ветка дерева: контейнер или листовой узел. */
type TreeBranchProps = ObjectTreeEvents & {
  node: TreeNodeData;
  depth: number;
  expanded: ReadonlySet<string>;
  selectedId?: string | null;
  hiddenIds?: ReadonlySet<string>;
  onToggleExpand: (id: string) => void;
};

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
  onRename,
}: TreeBranchProps) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const isHidden = hiddenIds?.has(node.id) ?? false;

  // Строки-ГРУПЫ (контейнеры без реальной сущности) переименовывать нельзя.
  const isGroup = node.id.startsWith('group-');
  const canRename = !!onRename && !isGroup;

  // Inline-редактирование имени (двойной клик).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // При входе в режим правки — фокус и выделение всего текста (быстрая замена).
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (!canRename) return;
    // Двойной клик уже вызвал клик (select). Если узел ещё НЕ выбран (или
    // клик-тоггл его снял) — принудительно выбираем, чтобы инспектор и карта
    // продолжали показывать редактируемый объект.
    if (!isSelected) onSelect?.(node);
    setDraft(node.label);
    setEditing(true);
  };

  /** Завершить редактирование: commit — сохранить (если изменилось), иначе отмена. */
  const commit = (save: boolean) => {
    setEditing(false);
    if (!save) return;
    const next = draft.trim();
    // Пустое или неизменное имя — не трогаем (без лишнего шага истории).
    if (!next || next === node.label) return;
    onRename?.(node, next);
  };

  const handleLabelClick = () => {
    // Группа — только контейнер дерева, а не сущность API.
    // Она не должна открывать свойства и инициировать запрос /api/entities/group-*.
    if (editing || isGroup) return;
    onSelect?.(node);
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
      <div
        className={
          'object-tree__row' +
          (isGroup ? ' object-tree__row--group' : '') +
          (isSelected ? ' object-tree__row--selected' : '') +
          (isHidden ? ' object-tree__row--hidden' : '')
        }
        style={{ paddingLeft: 12 + depth * 16 }}
        // Двойной клик по ЛЮБОМУ месту строки (кроме кнопок-действий, они
        // гасят всплытие) — вход в редактирование имени. Удобнее, чем попадать
        // точно по тексту: цель клика шире (UX-практика «forgiving target»).
        onDoubleClick={canRename ? startEdit : undefined}
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

        {GROUP_ICON[node.id] && (
          <img
            src={GROUP_ICON[node.id]}
            alt=""
            className="object-tree__kind-icon object-tree__kind-icon--raster"
            width={18}
            height={18}
          />
        )}

        {editing ? (
          <input
            ref={inputRef}
            className="object-tree__rename-input"
            type="text"
            value={draft}
            spellCheck={false}
            aria-label={`Переименовать «${node.label}»`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commit(true);
              else if (e.key === 'Escape') commit(false);
            }}
            // Потеря фокуса (клик вне) — сохраняем как принятое действие.
            onBlur={() => commit(true)}
            // Двойной клик внутри поля не должен переоткрывать редактор.
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            className="object-tree__label"
            onClick={handleLabelClick}
            // onDoubleClick обрабатывается на строке (row) — не дублируем здесь.
            title={canRename ? `${node.label} — двойной клик для переименования` : node.label}
          >
            <span className="object-tree__name">{node.label}</span>
            {node.subType && <span className="object-tree__sub">{node.subType}</span>}
          </button>
        )}

        <span
          className="object-tree__actions"
          // Двойной клик по кнопкам-действиям НЕ должен запускать переименование.
          onDoubleClick={(e) => e.stopPropagation()}
        >
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
