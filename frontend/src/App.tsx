import { useEffect, useState } from 'react';
import { AppShell, PANEL_WIDTH_LIMITS } from './app/AppShell';
import { ActivityBar } from './app/ActivityBar';
import { LeftSidebar } from './features/objectTree/LeftSidebar';
import { MapViewport } from './features/map/MapViewport';
import { MapDiagramModal } from './features/diagram/MapDiagramModal';
import type { TreeNodeData } from './features/objectTree/types';
import type { GraphToolActionId } from './features/objectTree/GraphToolbar';
import { findTreeNode } from './features/objectTree/mockData';
import { InspectorPanel } from './features/inspector/InspectorPanel';
import { useEntityDetailsQuery } from './api/queries';
import { useUiState } from './state/uiState';
import { useMapDrawing } from './features/map/mapDrawing';
import type { SelectedEntity } from './domain/types';
import type { DrawTool } from './features/map/drawingTypes';

/** Сопоставление категории узла дерева доменному kind выбранной сущности. */
function nodeKindToEntityKind(node: TreeNodeData): SelectedEntity['kind'] {
  switch (node.kind) {
    case 'pipeline':
      return 'pipeline';
    case 'wellpad':
      return 'wellpad';
    case 'delivery-point':
    case 'facility':
    default:
      return 'facility';
  }
}
function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState<number>(PANEL_WIDTH_LIMITS.leftMin);
  const [rightWidth, setRightWidth] = useState<number>(PANEL_WIDTH_LIMITS.min);
  const {
    activeModule,
    setActiveModule,
    selectedEntity,
    selectEntity,
    setInspectorTab,
    hiddenIds,
    toggleVisibility,
    inspectorTab,
    diagramEntityId,
    openDiagram,
    closeDiagram,
    diagramConfig,
    setDiagramConfig,
    mapDisplaySettings,
    patchMapDisplaySettings,
    devMode,
    toggleDevMode,
  } = useUiState();

  const {
    tool: drawTool,
    setTool: setDrawTool,
    selections: drawSelections,
    removeSelection,
    undo,
    redo,
  } = useMapDrawing();

  // Удаление выделенных элементов клавишей Delete (когда есть выделение).
  useEffect(() => {
    if (drawSelections.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      // Не перехватываем, если пользователь печатает в поле ввода.
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      e.preventDefault();
      removeSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawSelections.length, removeSelection]);

  // Undo/redo действий проектирования: Ctrl+Z — отменить, Ctrl+Shift+Z / Ctrl+Y — повторить.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const selectedId = selectedEntity?.id ?? null;

  /** Р”РµС‚Р°Р»Рё РІС‹Р±СЂР°РЅРЅРѕРіРѕ РѕР±СЉРµРєС‚Р° вЂ” domain-state С‡РµСЂРµР· react-query (Р­С‚Р°Рї 9.3). */
  const {
    data: entityDetails,
    isLoading: entityLoading,
    error: entityError,
    refetch: refetchEntity,
  } = useEntityDetailsQuery(selectedId);

  const selectedDetails = entityDetails ?? null;

  /**
   * Соответствие «кнопка инструмента → режим создания на карте».
   * 'none' — инструмент пока не имеет режима на карте (заготовка).
   */
  const GRAPH_TOOL_TO_DRAW_TOOL: Record<GraphToolActionId, DrawTool> = {
    'create-wellpad': 'wellpad',
    'create-facility': 'facility',
    'create-delivery-point': 'delivery-point',
    'create-pipeline-segment': 'segment',
    'create-pipeline': 'pipeline',
    'create-tap': 'tap',
    'create-tee': 'tee',
  };

  /** Обратное соответствие: режим создания → активная кнопка панели. */
  const DRAW_TOOL_TO_GRAPH_TOOL: Record<Exclude<DrawTool, 'none'>, GraphToolActionId> = {
    wellpad: 'create-wellpad',
    facility: 'create-facility',
    'delivery-point': 'create-delivery-point',
    segment: 'create-pipeline-segment',
    pipeline: 'create-pipeline',
    tap: 'create-tap',
    tee: 'create-tee',
  };
  const activeGraphAction: GraphToolActionId | null =
    drawTool === 'none' ? null : DRAW_TOOL_TO_GRAPH_TOOL[drawTool];

  const handleSelect = (node: TreeNodeData) =>
    selectEntity(node.id, nodeKindToEntityKind(node));
  const handleOpenDiagram = (node: TreeNodeData) => openDiagram(node.id);

  /** Инструменты создания: клик по карте создаёт вершину или ребро. */
  const handleGraphTool = (action: GraphToolActionId) => {
    const nextTool = GRAPH_TOOL_TO_DRAW_TOOL[action];
    // Инструмент без режима на карте — заготовка (врезка/тройник): пока no-op.
    if (nextTool === 'none') return;
    // Повторный клик по активному инструменту выключает режим создания
    setDrawTool(drawTool === nextTool ? 'none' : nextTool);
  };

  return (
    <AppShell
      leftCollapsed={leftCollapsed}
      rightCollapsed={rightCollapsed}
      leftWidth={leftWidth}
      rightWidth={rightWidth}
      onLeftWidthChange={setLeftWidth}
      onRightWidthChange={setRightWidth}
      onToggleLeft={() => setLeftCollapsed((v) => !v)}
      onToggleRight={() => setRightCollapsed((v) => !v)}
      activity={
        <ActivityBar
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          devMode={devMode}
          onToggleDevMode={toggleDevMode}
        />
      }
      left={
        <LeftSidebar
          onCollapse={() => setLeftCollapsed(true)}
          selectedId={selectedId}
          onSelect={handleSelect}
          onOpenDiagram={handleOpenDiagram}
          displaySettings={mapDisplaySettings}
          onDisplaySettingsChange={patchMapDisplaySettings}
          hiddenIds={hiddenIds}
          onToggleVisibility={(node, visible) => toggleVisibility(node.id, visible)}
          onGraphTool={handleGraphTool}
          activeGraphTool={activeGraphAction}
          canDelete={drawSelections.length > 0}
          onDelete={removeSelection}
        />
      }
      center={
        <MapViewport
          displaySettings={mapDisplaySettings}
          hiddenNodeIds={hiddenIds}
          selectedId={selectedId}
          onSelect={(id, kind) => selectEntity(id, kind)}
          devMode={devMode}
        >
          <MapDiagramModal
            isOpen={diagramEntityId !== null}
            entityName={findTreeNode(diagramEntityId ?? '')?.label ?? ''}
            config={diagramConfig}
            onChange={setDiagramConfig}
            onClose={closeDiagram}
          />
        </MapViewport>
      }
      right={
        <InspectorPanel
          entity={selectedDetails}
          loading={entityLoading}
          error={entityError}
          onRetry={refetchEntity}
          activeTab={inspectorTab}
          onTabChange={setInspectorTab}
          onNavigateToRelation={(id) => selectEntity(id, 'facility')}
          onCollapse={() => setRightCollapsed(true)}
        />
      }
    />
  );
}

export default App;
