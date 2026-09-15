import { AppIcon, type IconName } from '../../components/AppIcon';
import { CollapsibleSection } from '../../components/panel/CollapsibleSection';
import wellpadIcon from '../../assets/design/wellpad.png';
import facilityIcon from '../../assets/design/facility.png';
import deliveryPointIcon from '../../assets/design/delivery-point.png';
import pipelineIcon from '../../assets/design/pipeline.png';
import segmentIcon from '../../assets/design/segment.png';
import teeIcon from '../../assets/design/tee.png';
import tapIcon from '../../assets/design/tap.png';
import './GraphToolbar.css';

/** Действие панели инструментов рисования графа. */
export type GraphToolActionId =
  | 'create-wellpad'
  | 'create-facility'
  | 'create-delivery-point'
  | 'create-pipeline-segment'
  | 'create-pipeline'
  | 'create-tap'
  | 'create-tee';

export type GraphToolData = {
  id: GraphToolActionId;
  label: string;
  /** SVG-иконка из реестра (если нет raster-иконки) */
  icon: IconName;
  /** Растровая иконка (PNG) — имеет приоритет над SVG */
  iconSrc?: string;
};

/** Группа инструментов: подпись + набор кнопок. */
export type GraphToolGroup = {
  /** Заголовок группы (eyebrow) */
  title: string;
  tools: readonly GraphToolData[];
};

/**
 * Инструменты создания, сгруппированные по смыслу (UX: вершины / рёбра / фитинги).
 */
export const GRAPH_TOOL_GROUPS: readonly GraphToolGroup[] = [
  {
    title: 'Вершины',
    tools: [
      { id: 'create-wellpad', label: 'Куст', icon: 'tree-wellpad', iconSrc: wellpadIcon },
      { id: 'create-facility', label: 'Объект подготовки', icon: 'tree-facility', iconSrc: facilityIcon },
      { id: 'create-delivery-point', label: 'Точка поставки', icon: 'tree-delivery-point', iconSrc: deliveryPointIcon },
    ],
  },
  {
    title: 'Трубопроводы',
    tools: [
      { id: 'create-pipeline', label: 'Трубопровод', icon: 'tree-pipeline', iconSrc: pipelineIcon },
      { id: 'create-pipeline-segment', label: 'Сегмент', icon: 'flow-physical', iconSrc: segmentIcon },
    ],
  },
  {
    title: 'Фитинги',
    tools: [
      { id: 'create-tee', label: 'Тройник', icon: 'flow-logical', iconSrc: teeIcon },
      { id: 'create-tap', label: 'Врезка', icon: 'flow-physical', iconSrc: tapIcon },
    ],
  },
] as const;

/** Плоский реестр всех инструментов (для внешнего использования). */
export const GRAPH_TOOLS: readonly GraphToolData[] = GRAPH_TOOL_GROUPS.flatMap(
  (g) => g.tools,
);

export type GraphToolbarProps = {
  /** Вызов инструмента (например, create-wellpad) */
  onAction?: (action: GraphToolActionId) => void;
  /** Активная кнопка (визуально выделена) */
  activeAction?: GraphToolActionId | null;
  /** Есть выделенный элемент — кнопка «Удалить» активна */
  canDelete?: boolean;
  /** Удалить выделенный элемент */
  onDelete?: () => void;
};

/**
 * Панель инструментов рисования графа — размещается над деревом объектов
 * (design description/components.md §3.2).
 */
export function GraphToolbar({
  onAction,
  activeAction = null,
  canDelete = false,
  onDelete,
}: GraphToolbarProps) {
  return (
    <CollapsibleSection title="Проектирование" className="graph-toolbar-wrap">
      <div className="graph-toolbar" aria-label="Инструменты создания графа">
        {GRAPH_TOOL_GROUPS.map((group) => (
          <div
            key={group.title}
            className="graph-toolbar__group"
            role="group"
            aria-label={group.title}
          >
            <span className="graph-toolbar__group-title">{group.title}</span>
            <div className="graph-toolbar__group-buttons">
              {group.tools.map((tool) => {
                const isActive = tool.id === activeAction;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`graph-toolbar__button${isActive ? ' is-active' : ''}`}
                    title={tool.label}
                    aria-pressed={isActive}
                    onClick={() => onAction?.(tool.id)}
                  >
                    {tool.iconSrc ? (
                      <img
                        className="graph-toolbar__icon"
                        src={tool.iconSrc}
                        alt=""
                        width={18}
                        height={18}
                      />
                    ) : (
                      <AppIcon name={tool.icon} size={16} />
                    )}
                    <span className="graph-toolbar__label">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Удаление выделенного элемента — отдельно, после разделителя */}
        <div className="graph-toolbar__danger-zone">
          <button
            type="button"
            className="graph-toolbar__button graph-toolbar__button--danger"
            title={canDelete ? 'Удалить выделенное' : 'Выберите объект для удаления'}
            disabled={!canDelete}
            onClick={() => onDelete?.()}
          >
            <AppIcon name="trash" size={16} />
            <span className="graph-toolbar__label">Удалить</span>
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
