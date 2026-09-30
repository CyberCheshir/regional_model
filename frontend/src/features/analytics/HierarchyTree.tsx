import { DEFAULT_HIERARCHY } from './hierarchyData';
import { CRITICALITY_LABELS } from '../../domain';
import { CriticalityDot } from '../../components/ui/CriticalityDot';
import type { WarningHierarchyNode } from './types';
import '../../components/ui/ui.css';
import './HierarchyTree.css';

export type HierarchyTreeProps = {
  /** Выбранный узел дерева */
  selectedNodeId: string;
  /** Клик по любому узлу */
  onSelectNode: (id: string) => void;
  /** Дополнительная логика при клике по листу (поиск связанного предупреждения/рекомендации) */
  onSelectLeaf?: (leaf: WarningHierarchyNode) => void;
};

/** Контекст рекурсивного обхода: выбранный узел и обработчики клика. */
type TreeContext = Pick<HierarchyTreeProps, 'selectedNodeId' | 'onSelectNode' | 'onSelectLeaf'>;

/** Строка дерева: точка критичности, подпись и счётчик. */
function TreeNode({
  node,
  selected,
  onSelect,
}: { node: WarningHierarchyNode; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`analytics-tree__node${selected ? ' analytics-tree__node--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="analytics-tree__left">
        <CriticalityDot level={node.criticality} title={CRITICALITY_LABELS[node.criticality]} />
        <span className="analytics-tree__label">{node.label}</span>
      </span>
      <span className="analytics-tree__badge">{node.count}</span>
    </button>
  );
}

/**
 * Рекурсивный уровень дерева. Корневой узел рендерится тем же компонентом,
 * что и вложенные, — отдельного кода для корня нет.
 */
function TreeNodes({
  nodes,
  selectedNodeId,
  onSelectNode,
  onSelectLeaf,
}: TreeContext & { nodes: WarningHierarchyNode[] }) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <TreeNode
            node={node}
            selected={selectedNodeId === node.id}
            onSelect={() => {
              onSelectNode(node.id);
              // Дополнительно сообщаем о выборе листа, чтобы вкладка могла
              // подсветить связанное предупреждение/рекомендацию.
              if (onSelectLeaf && !node.children) onSelectLeaf(node);
            }}
          />

          {node.children && (
            <div className="analytics-tree__children">
              <TreeNodes
                nodes={node.children}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onSelectLeaf={onSelectLeaf}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * Общий виджет «Иерархия модели» для вкладок аналитики
 * (используется в «Предупреждениях» и «Рекомендациях»).
 */
export function HierarchyTree({ selectedNodeId, onSelectNode, onSelectLeaf }: HierarchyTreeProps) {
  return (
    <div className="analytics-tree">
      <TreeNodes
        nodes={[DEFAULT_HIERARCHY]}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        onSelectLeaf={onSelectLeaf}
      />
    </div>
  );
}
