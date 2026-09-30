import { useMemo, useState } from 'react';
import { PanelHeader } from '../../components/panel/PanelHeader';
import { PanelFooterHint } from './PanelFooterHint';
import { ObjectTree } from './ObjectTree';
import { GraphToolbar, type GraphToolActionId } from './GraphToolbar';
import { CollapsibleSection } from '../../components/panel/CollapsibleSection';
import { buildElementGroups } from '../../domain/elementGroups';
import { useMapDrawing } from '../map/mapDrawing';
import type { DrainFluid, PipelineClass } from '../map/drawingTypes';
import type { AreaExportFormat } from '../map/importAreas';
import type { ObjectTreeData } from './types';
import { DisplaySettingsCard } from '../displaySettings/DisplaySettingsCard';
import { DEFAULT_MAP_DISPLAY_SETTINGS } from '../displaySettings/types';
import type { MapDisplaySettings } from '../displaySettings/types';
import type { TreeNodeData } from './types';
import './LeftSidebar.css';

export type LeftSidebarProps = {
  /** Свернуть панель (controlled из App) */
  onCollapse?: () => void;
  /** Выбранный узел дерева (controlled, синхронизирован с инспектором/картой) */
  selectedId?: string | null;
  onSelect?: (node: TreeNodeData) => void;
  /** Открыть плавающее окно диаграммы */
  onOpenDiagram?: (node: TreeNodeData) => void;
  /** Настройки отображения карты (controlled из App) */
  displaySettings?: MapDisplaySettings;
  /** Изменение настроек отображения */
  onDisplaySettingsChange?: (patch: Partial<MapDisplaySettings>) => void;
  /** id скрытых объектов (controlled из App, синхронизируется с картой) */
  hiddenIds?: ReadonlySet<string>;
  /** Переключение видимости объекта (controlled из App) */
  onToggleVisibility?: (node: TreeNodeData, visible: boolean) => void;
  /** Вызов инструмента рисования графа (панель над деревом) */
  onGraphTool?: (action: GraphToolActionId) => void;
  /** Активный инструмент рисования (визуальное выделение кнопки) */
  activeGraphTool?: GraphToolActionId | null;
  /** Есть выделенный элемент — кнопка «Удалить» активна */
  canDelete?: boolean;
  /** Удалить выделенный элемент */
  onDelete?: () => void;
  /** Показывать панель «Проектирование» (режим редактирования) */
  showGraphTools?: boolean;
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
  /** Есть участки для выгрузки */
  canExportAreas?: boolean;
  /** Импорт встроенного образца участков по URL */
  onImportSample?: (url: string, areaIndex: number) => void;
  /** «Применить» в настройках трубопровода — включить инструмент безусловно */
  onApplyPipelineTool?: () => void;
};

/**
 * Левая панель (design.png, этап 4): шапка, дерево объектов, подсказка в подвале.
 * Видимость объектов пока во внутреннем состоянии — подключение к карте на этапе 6.
 */
export function LeftSidebar({
  onCollapse,
  selectedId,
  onSelect,
  onOpenDiagram,
  displaySettings = DEFAULT_MAP_DISPLAY_SETTINGS,
  onDisplaySettingsChange,
  hiddenIds,
  onToggleVisibility,
  onGraphTool,
  activeGraphTool,
  canDelete,
  onDelete,
  showGraphTools = true,
  fluid,
  onFluidChange,
  pipelineClass,
  onPipelineClassChange,
  onExportAreas,
  canExportAreas,
  onImportSample,
  onApplyPipelineTool,
}: LeftSidebarProps) {
  const { pipelines, vertices, segments, taps, renameVertex, renamePipeline, renameSegment, renameTap } =
    useMapDrawing();

  /**
   * Переименование узла дерева (двойной клик): маршрутизируем по виду сущности.
   * Объекты — вершины; трубопроводы — записи; сегменты — рёбра (segments); врезки — taps.
   */
  const handleRename = (node: TreeNodeData, nextLabel: string) => {
    if (node.kind === 'pipeline') renamePipeline(node.id, nextLabel);
    else if (node.kind === 'segment') renameSegment(node.id, nextLabel);
    else if (node.kind === 'node') renameTap(node.id, nextLabel);
    else renameVertex(node.id, nextLabel);
  };

  // Спроектированные элементы раскладываются по группам дерева единым
  // построителем (тот же источник использует вкладка «Объекты»).
  const treeGroups = useMemo<ObjectTreeData[]>(
    () => buildElementGroups({ vertices, pipelines, segments, taps }),
    [pipelines, vertices, segments, taps],
  );
  // Fallback: если видимость не контролируется извне — локальное состояние
  const [localHiddenIds, setLocalHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const effectiveHidden = hiddenIds ?? localHiddenIds;

  const handleToggleVisibility = (node: TreeNodeData, visible: boolean) => {
    if (onToggleVisibility) {
      onToggleVisibility(node, visible);
      return;
    }
    setLocalHiddenIds((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  return (
    <div className="left-sidebar">
      <PanelHeader title="Управление элементами" onCollapse={onCollapse} />
      <div className="left-sidebar__scroll">
        {showGraphTools && (
          <GraphToolbar
            onAction={onGraphTool}
            activeAction={activeGraphTool}
            canDelete={canDelete}
            onDelete={onDelete}
            fluid={fluid}
            onFluidChange={onFluidChange}
            pipelineClass={pipelineClass}
            onPipelineClassChange={onPipelineClassChange}
            onExportAreas={onExportAreas}
            canExportAreas={canExportAreas}
            onImportSample={onImportSample}
            onApplyPipelineTool={onApplyPipelineTool}
          />
        )}
        <div className="left-sidebar__body">
          <CollapsibleSection title="Группы элементов" defaultOpen={false}>
            <ObjectTree
              groups={treeGroups}
              selectedId={selectedId}
              hiddenIds={effectiveHidden}
              onSelect={onSelect}
              onOpenDiagram={onOpenDiagram}
              onToggleVisibility={handleToggleVisibility}
              onRename={handleRename}
            />
          </CollapsibleSection>
        </div>
        {onDisplaySettingsChange && (
          <DisplaySettingsCard settings={displaySettings} onChange={onDisplaySettingsChange} />
        )}
        <PanelFooterHint />
      </div>
    </div>
  );
}


