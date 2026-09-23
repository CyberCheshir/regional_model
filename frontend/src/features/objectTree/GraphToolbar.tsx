import { AppIcon, type IconName } from '../../components/AppIcon';
import { CollapsibleSection } from '../../components/panel/CollapsibleSection';
import { PipelineSettingsPanel } from './PipelineSettingsPanel';
import { AreaExportMenu } from './AreaExportMenu';
import { SampleAreasMenu } from './SampleAreasMenu';
import type { DrainFluid, PipelineClass } from '../map/drawingTypes';
import type { AreaExportFormat } from '../map/importAreas';
import wellpadIcon from '../../assets/design/wellpad.png';
import facilityIcon from '../../assets/design/facility.png';
import deliveryPointIcon from '../../assets/design/delivery-point.png';
import teeIcon from '../../assets/design/tee.png';
import tapIcon from '../../assets/design/tap.png';
import './GraphToolbar.css';

/** Действие панели инструментов рисования графа. */
export type GraphToolActionId =
  | 'create-wellpad'
  | 'create-facility'
  | 'create-delivery-point'
  | 'create-pipeline'
  | 'create-logical-pipeline'
  | 'create-tap'
  | 'create-tee'
  | 'create-licence-area'
  | 'import-licence-area'
  | 'export-areas';

export type GraphToolData = {
  id: GraphToolActionId;
  /** Подпись кнопки; пустая строка — рендерить только иконку */
  label: string;
  /** Всплывающая подсказка (по умолчанию — label) */
  title?: string;
  /** SVG-иконка из реестра (если нет raster-иконки) */
  icon: IconName;
  /** Растровая иконка (PNG) — имеет приоритет над SVG */
  iconSrc?: string;
  /** Квадратная кнопка (иконка по центру, без текста) — для ряда действий */
  square?: boolean;
};

/** Группа инструментов: подпись + набор кнопок. */
export type GraphToolGroup = {
  /** Заголовок группы (eyebrow) */
  title: string;
  tools: readonly GraphToolData[];
  /** Кнопки группы в ОДНУ строку (иначе — столбиком) */
  inline?: boolean;
};

/**
 * Инструменты создания, сгруппированные по смыслу (UX: вершины / рёбра / фитинги).
 */
export const GRAPH_TOOL_GROUPS: readonly GraphToolGroup[] = [
  {
    title: 'Вершины',
    tools: [
      { id: 'create-wellpad', label: 'Система сбора', icon: 'tree-wellpad', iconSrc: wellpadIcon },
      { id: 'create-facility', label: 'Объект подготовки', icon: 'tree-facility', iconSrc: facilityIcon },
      { id: 'create-delivery-point', label: 'Точка поставки', icon: 'tree-delivery-point', iconSrc: deliveryPointIcon },
    ],
  },
  {
    title: 'Трубопроводы',
    // Здесь — ОТДЕЛЬНАЯ кнопка «Логический поток» (передача флюида без
    // физического трубопровода). Карточка «Трубопровод» рендерится ОТДЕЛЬНО
    // (PipelineSettingsPanel) — у неё свой выпадающий список флюида/класса,
    // и она же выбирает инструмент рисования.
    tools: [
      { id: 'create-logical-pipeline', label: 'Логический поток', icon: 'flow-logical' },
    ],
  },
  {
    title: 'Фитинги',
    tools: [
      { id: 'create-tee', label: 'Тройник', icon: 'flow-logical', iconSrc: teeIcon },
      { id: 'create-tap', label: 'Врезка', icon: 'flow-physical', iconSrc: tapIcon },
    ],
  },
  {
    title: 'Территории',
    // Кнопки этой группы — в одну строку (участок + импорт).
    inline: true,
    tools: [
      { id: 'create-licence-area', label: 'Лицензионный участок', icon: 'licence-area' },
      // Дальше — ряд квадратных кнопок: импорт / экспорт / примеры.
      { id: 'import-licence-area', label: '', title: 'Импортировать', icon: 'import', square: true },
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
  /** Флюид новых сегментов (панель «Трубопроводы») */
  fluid?: DrainFluid;
  /** Изменить флюид */
  onFluidChange?: (fluid: DrainFluid) => void;
  /** Класс новых сегментов (панель «Класс трубопровода») */
  pipelineClass?: PipelineClass;
  /** Изменить класс трубопровода */
  onPipelineClassChange?: (pipelineClass: PipelineClass) => void;
  /** Экспорт лицензионных участков в выбранном формате */
  onExportAreas?: (format: AreaExportFormat) => void;
  /** Есть участки для выгрузки (иначе кнопка экспорта неактивна) */
  canExportAreas?: boolean;
  /** Импорт встроенного образца участков по URL (`/samples/…`) */
  onImportSample?: (url: string, areaIndex: number) => void;
  /** «Применить» — включить инструмент «Трубопровод» безусловно (не toggle) */
  onApplyPipelineTool?: () => void;
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
  fluid,
  onFluidChange,
  pipelineClass,
  onPipelineClassChange,
  onExportAreas,
  canExportAreas = false,
  onImportSample,
  onApplyPipelineTool,
}: GraphToolbarProps) {
  const showPipelineSettings = onFluidChange !== undefined || onPipelineClassChange !== undefined;
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
            {/* КАРТОЧКА «Трубопровод» (выпадающий список флюида/класса) —
                идёт ПЕРВОЙ в группе, выше отдельной кнопки «Логический поток». */}
            {group.title === 'Трубопроводы' && showPipelineSettings && fluid !== undefined && pipelineClass !== undefined && (
              <PipelineSettingsPanel
                fluid={fluid}
                onFluidChange={(value) => onFluidChange?.(value)}
                pipelineClass={pipelineClass}
                onPipelineClassChange={(value) => onPipelineClassChange?.(value)}
                onSelectTool={() => onAction?.('create-pipeline')}
                onApplyTool={onApplyPipelineTool}
                active={activeAction === 'create-pipeline'}
              />
            )}
            {/* Основные инструменты группы (не квадратные) — столбиком/в ряд.
                Группа без кнопок их не рисует. */}
            {group.tools.some((tool) => !tool.square) && (
            <div
              className={`graph-toolbar__group-buttons${group.inline ? ' graph-toolbar__group-buttons--inline' : ''}`}
            >
              {group.tools
                .filter((tool) => !tool.square)
                .map((tool) => {
                  const isActive = tool.id === activeAction;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`graph-toolbar__button${isActive ? ' is-active' : ''}`}
                      title={tool.title ?? tool.label}
                      aria-label={tool.title ?? tool.label}
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
                      {tool.label && (
                        <span className="graph-toolbar__label">{tool.label}</span>
                      )}
                      {/* Шеврон справа — как в макете выбора типа элемента */}
                      <AppIcon
                        name="chevron"
                        size={12}
                        className="graph-toolbar__chevron"
                      />
                    </button>
                  );
                })}
            </div>
            )}
            {/* Ряд КВАДРАТНЫХ кнопок-действий (импорт / экспорт / примеры) —
                отдельной строкой НИЖЕ основной кнопки группы. */}
            {(group.tools.some((tool) => tool.square) ||
              group.title === 'Территории') && (
              <div className="graph-toolbar__group-actions">
                {group.tools
                  .filter((tool) => tool.square)
                  .map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      className="graph-toolbar__button graph-toolbar__button--square"
                      title={tool.title ?? tool.label}
                      aria-label={tool.title ?? tool.label}
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
                    </button>
                  ))}
                {/* Меню экспорта и примеров — квадратные кнопки в том же ряду. */}
                {group.title === 'Территории' && onExportAreas && (
                  <AreaExportMenu onExport={onExportAreas} disabled={!canExportAreas} />
                )}
                {group.title === 'Территории' && onImportSample && (
                  <SampleAreasMenu onImportSample={onImportSample} />
                )}
              </div>
            )}
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
