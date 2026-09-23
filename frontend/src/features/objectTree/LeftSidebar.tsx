import { useMemo, useState } from 'react';
import { PanelHeader } from '../../components/panel/PanelHeader';
import { PanelFooterHint } from './PanelFooterHint';
import { ObjectTree } from './ObjectTree';
import { GraphToolbar, type GraphToolActionId } from './GraphToolbar';
import { CollapsibleSection } from '../../components/panel/CollapsibleSection';
import { mockTreeData } from './mockData';
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
  const { pipelines, vertices, segments, renameVertex, renamePipeline, renameSegment } =
    useMapDrawing();

  /**
   * Переименование узла дерева (двойной клик): маршрутизируем по виду сущности.
   * Объекты — вершины; трубопроводы — записи; сегменты — рёбра (segments).
   */
  const handleRename = (node: TreeNodeData, nextLabel: string) => {
    if (node.kind === 'pipeline') renamePipeline(node.id, nextLabel);
    else if (node.kind === 'segment') renameSegment(node.id, nextLabel);
    else renameVertex(node.id, nextLabel);
  };

  // Спроектированные элементы раскладываются по группам дерева:
  // вершины-объекты (кусты/УПН/точки) и рёбра (трубопроводы).
  const treeGroups = useMemo<ObjectTreeData[]>(() => {
    const groups: ObjectTreeData[] = [...mockTreeData];

    const byKind = (kind: TreeNodeData['kind']) =>
      vertices.filter((v) => v.kind === kind).map((v) => ({
        id: v.id,
        label: v.label,
        kind: v.kind,
      }));

    const wellpads = byKind('wellpad');
    const facilities = byKind('facility');
    const deliveryPoints = byKind('delivery-point');

    if (wellpads.length > 0) {
      groups.push({ id: 'group-wellpads', label: 'Системы сбора', children: wellpads });
    }
    if (facilities.length > 0) {
      groups.push({ id: 'group-facilities', label: 'Объекты подготовки', children: facilities });
    }
    if (deliveryPoints.length > 0) {
      groups.push({ id: 'group-delivery', label: 'Точки поставки', children: deliveryPoints });
    }
    // Трубопроводы БЕЗ сегментов в дерево не попадают: запись существует,
    // только пока у неё есть хотя бы одно ребро (0 сегментов → удаляем из
    // группы элементов).
    const pipelinesWithSegments = pipelines.filter(
      (p) => segmentsOfPipeline(p.id).length > 0,
    );
    if (pipelinesWithSegments.length > 0) {
      groups.push({
        id: 'group-pipelines',
        label: 'Трубопроводы',
        children: pipelinesWithSegments.map((p) => {
          // Сегменты трубопровода — из domain layer (единый источник истины).
          const own = segmentsOfPipeline(p.id);
          return {
            id: p.id,
            label: p.label,
            kind: 'pipeline' as const,
            // Актуальное количество сегментов — считаем по факту (own.length),
            // а НЕ по сохранённому p.segmentCount (он может устареть при
            // удалении/разрезании сегментов).
            subType: segmentCountLabel(own.length),
            // Сегменты трубопровода — дочерние узлы со СВОИМИ именами.
            // Имя закреплено за сегментом (задано при создании/пользователем)
            // и НЕ пересчитывается по позиции — объединение в трубопровод его не меняет.
            // Fallback — только для старых снимков без имени.
            children: own.map((seg) => ({
              id: seg.id,
              label: seg.label || 'Сегмент',
              kind: 'segment' as const,
            })),
          };
        }),
      });
    }
    return groups;

    /** Сегменты, принадлежащие трубопроводу (в устойчивом порядке). */
    function segmentsOfPipeline(pipelineId: string) {
      return segments.filter((s) => s.pipelineId === pipelineId);
    }
  }, [pipelines, vertices, segments]);
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
          <CollapsibleSection title="Группы элементов">
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

/** Подпись количества сегментов трубопровода (с учётом склонения). */
function segmentCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = 'сегментов';
  if (mod10 === 1 && mod100 !== 11) word = 'сегмент';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'сегмента';
  return `${count} ${word}`;
}
