import { useEffect, useRef, useState } from 'react';
import { AppShell, PANEL_WIDTH_LIMITS, SHELL_COLUMNS } from './app/AppShell';
import { ActivityBar } from './app/ActivityBar';
import { LeftSidebar } from './features/objectTree/LeftSidebar';
import { MapViewport } from './features/map/MapViewport';
import { MapDiagramModal } from './features/diagram/MapDiagramModal';
import { TopBar, type ViewMode } from './features/topbar/TopBar';
import type { TreeNodeData } from './features/objectTree/types';
import type { GraphToolActionId } from './features/objectTree/GraphToolbar';
import { findTreeNode } from './features/objectTree/mockData';
import { ParameterPanel } from './features/parameterPanel/ParameterPanel';
import { BottomPanel } from './features/timeRange/BottomPanel';
import { DEFAULT_TIME_RANGE, type TimeRangeState } from './features/timeRange/types';
import { useEntityDetailsQuery } from './api/queries';
import { useUiState } from './state/uiState';
import { useMapDrawing } from './features/map/mapDrawing';
import { fetchProjectSnapshot } from './api/mapSave';
import { parseLicenceAreaGeoJSON } from './features/map/importLicenceArea';
import {
  parseAreasToLngLat,
  downloadAreasFile,
  type AreaExportFormat,
} from './features/map/importAreas';
import type { EntityDetails, SelectedEntity } from './domain/types';
import type { DrawTool, MapVertex } from './features/map/drawingTypes';
import type { PipelineRecord } from './features/map/mapDrawing';

/**
 * Карточка ЛОКАЛЬНОГО (ещё не сохранённого) объекта из domain-состояния.
 * Нужна, чтобы инспектор работал для нарисованных на карте объектов БЕЗ
 * запроса к backend (иначе GET /api/entities/<local-id>/ даёт 404).
 * Возвращает null, если id не найден среди локальных сущностей.
 */
function buildLocalEntityDetails(
  id: string,
  vertices: MapVertex[],
  pipelines: PipelineRecord[],
  segments: Array<{ id: string; label?: string; pipelineId: string | null; fluid: string }> = [],
): EntityDetails | null {
  const segment = segments.find((s) => s.id === id);
  if (segment) {
    return {
      id: segment.id,
      label: segment.label || 'Сегмент',
      kind: 'segment',
      subType: 'Сегмент трубопровода',
      status: 'running',
      licenseArea: '—',
      owner: '—',
      modelStatus: [
        { label: 'Трубопровод', value: segment.pipelineId ? 'в составе' : 'отдельный', ok: !!segment.pipelineId },
      ],
      outgoing: [],
      incoming: [],
    };
  }
  const vertex = vertices.find((v) => v.id === id);
  if (vertex) {
    return {
      id: vertex.id,
      label: vertex.label,
      kind: vertex.kind,
      status: 'running',
      licenseArea: '—',
      owner: '—',
      modelStatus: [
        { label: 'Система сбора', value: 'не сохранена', ok: false },
        { label: 'Профиль добычи', value: 'не задан', ok: false },
        { label: 'Результаты ГР', value: 'отсутствуют', ok: false },
      ],
      outgoing: [],
      incoming: [],
    };
  }
  const pipeline = pipelines.find((p) => p.id === id);
  if (pipeline) {
    // Кол-во сегментов — ПО ФАКТУ из domain layer (не хранится в записи).
    const count = segments.filter((s) => s.pipelineId === pipeline.id).length;
    return {
      id: pipeline.id,
      label: pipeline.label,
      kind: 'pipeline',
      status: 'running',
      licenseArea: '—',
      owner: '—',
      modelStatus: [
        { label: 'Топология', value: `${count} сегментов`, ok: count > 0 },
      ],
      outgoing: [],
      incoming: [],
    };
  }
  return null;
}

/** Сопоставление категории узла дерева доменному kind выбранной сущности. */
function nodeKindToEntityKind(node: TreeNodeData): SelectedEntity['kind'] {
  switch (node.kind) {
    case 'pipeline':
      return 'pipeline';
    case 'segment':
      return 'segment';
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
  // Панель параметров по умолчанию СВЁРНУТА (открывается по кнопке на краю).
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [leftWidth, setLeftWidth] = useState<number>(PANEL_WIDTH_LIMITS.leftMin);
  const [rightWidth, setRightWidth] = useState<number>(SHELL_COLUMNS.right);
  /** Демонстрируемый период — нижняя панель (BottomPanel). */
  const [timeRange, setTimeRange] = useState<TimeRangeState>(DEFAULT_TIME_RANGE);
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
    viewMode,
    setViewMode,
  } = useUiState();

  const {
    tool: drawTool,
    setTool: setDrawTool,
    selections: drawSelections,
    removeSelection,
    undo,
    redo,
    loadSnapshot,
    addImportedArea,
    addImportedAreas,
    areas: drawAreas,
    vertices: drawVertices,
    pipelines: drawPipelines,
    segments: drawSegments,
    exportModel,
    renameVertex,
    renamePipeline,
    renameSegment,
    fluid: drawFluid,
    setFluid: setDrawFluid,
    pipelineClass: drawPipelineClass,
    setPipelineClass: setDrawPipelineClass,
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

  /**
   * Локальная карточка выбранного объекта из domain-состояния (если это
   * нарисованный, ещё не сохранённый объект/трубопровод). Для таких id
   * запрос к backend НЕ отправляем — иначе в консоли 404.
   */
  const localEntity = selectedId
    ? buildLocalEntityDetails(selectedId, drawVertices, drawPipelines, drawSegments)
    : null;

  /** Детали выбранного объекта — domain-state через react-query (Этап 9.3).
      Запрос включается ТОЛЬКО если объекта нет в локальном состоянии. */
  const {
    data: entityDetails,
    isLoading: entityLoading,
    error: entityError,
    refetch: refetchEntity,
  } = useEntityDetailsQuery(localEntity ? null : selectedId);

  const selectedDetails = localEntity ?? entityDetails ?? null;

  /** Переименовать выбранный объект из инспектора (поле «Наименование»). */
  const handleRenameSelected = (nextLabel: string) => {
    const id = selectedEntity?.id;
    if (!id) return;
    if (selectedEntity?.kind === 'pipeline') renamePipeline(id, nextLabel);
    else if (selectedEntity?.kind === 'segment') renameSegment(id, nextLabel);
    else renameVertex(id, nextLabel);
  };

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
    'create-licence-area': 'licence-area',
    // Импорт/экспорт — не режим рисования, а разовые действия (см. handleGraphTool).
    'import-licence-area': 'none',
    'export-areas': 'none',
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
    'licence-area': 'create-licence-area',
  };
  const activeGraphAction: GraphToolActionId | null =
    drawTool === 'none' ? null : DRAW_TOOL_TO_GRAPH_TOOL[drawTool];

  // Повторный клик по уже выбранному элементу — снимает выделение (toggle).
  const handleSelect = (node: TreeNodeData) => {
    if (selectedEntity?.id === node.id) {
      selectEntity(null);
      return;
    }
    selectEntity(node.id, nodeKindToEntityKind(node));
  };
  const handleOpenDiagram = (node: TreeNodeData) => openDiagram(node.id);

  /** Экспорт всех спроектированных участков в файл (JSON / CSV / GeoJSON). */
  const handleExportAreas = (format: AreaExportFormat) => {
    if (drawAreas.length === 0) {
      console.warn('[export] нет лицензионных участков для выгрузки');
      return;
    }
    const fileName = downloadAreasFile(drawAreas, format, 'licence-areas');
    console.info(`[export] сохранён файл: ${fileName}`);
  };

  /** Инструменты создания: клик по карте создаёт вершину или ребро. */
  const handleGraphTool = (action: GraphToolActionId) => {
    // Импорт лицензионного участка из файла — разовое действие (не режим карты).
    if (action === 'import-licence-area') {
      fileInputRef.current?.click();
      return;
    }
    const nextTool = GRAPH_TOOL_TO_DRAW_TOOL[action];
    // Инструмент без режима на карте — заготовка: пока no-op.
    if (nextTool === 'none') return;
    // Повторный клик по активному инструменту выключает режим создания
    setDrawTool(drawTool === nextTool ? 'none' : nextTool);
  };

  /** Смена режима: выход из «Просмотра» сбрасывает активный инструмент. */
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'view') setDrawTool('none');
  };

  const editMode = viewMode === 'edit';

  /** Скрытый input выбора файла — для импорта лицензионного участка. */
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Скрытый input выбора файла — для импорта МОДЕЛИ (JSON). */
  const modelInputRef = useRef<HTMLInputElement>(null);

  /** Экспорт всей модели в JSON-файл (объекты/сегменты/трубопроводы/участки). */
  const handleExportModel = () => {
    const model = exportModel();
    const fileName = 'regional-model.json';
    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.info(`[model] экспортирована модель: ${fileName}`);
  };

  /** Импорт модели из JSON-файла (снимок проекта → domain layer). */
  const handleImportModelFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.facilities)) {
        console.warn('[model] в файле нет модели (ожидается { facilities, nodes, … })');
        return;
      }
      loadSnapshot(parsed);
      setDrawTool('none');
      selectEntity(null);
      console.info('[model] модель импортирована');
    } catch (error) {
      console.error('[model] не удалось прочитать файл модели:', error);
    }
  };

  /**
   * Импорт лицензионных участков из файла.
   *
   * Поддерживаются ДВА сценария:
   *   1. Таблица/CSV с НОРМАЛИЗОВАННЫМИ координатами (как `data.txt`) —
   *      сразу НЕСКОЛЬКО участков (группировка по колонке SVG);
   *   2. GeoJSON (FeatureCollection с полигоном) — один участок (внешний контур).
   *
   * Формат определяется по содержимому файла.
   */
  /** Импортировать участки из ТЕКСТА (файл или образец): авто-формат. */
  const importAreasFromText = (text: string, onlyIndex?: number) => {
    // 1. Таблица/JSON нормализованных координат → один или несколько участков.
    let tableAreas = parseAreasToLngLat(text);
    if (tableAreas && tableAreas.length > 0) {
      // Режим «по одному»: берём только выбранный участок по индексу.
      if (onlyIndex !== undefined) {
        const one = tableAreas[onlyIndex];
        if (!one) {
          console.warn(`[import] участок №${onlyIndex + 1} не найден в файле`);
          return false;
        }
        tableAreas = [one];
      }
      const created = addImportedAreas(tableAreas);
      console.info(`[import] импортировано участков: ${created}`);
      return true;
    }
    // 2. GeoJSON с полигоном → один участок.
    try {
      const geo: unknown = JSON.parse(text);
      const imported = parseLicenceAreaGeoJSON(geo);
      if (imported) {
        addImportedArea(imported);
        return true;
      }
    } catch {
      // не GeoJSON
    }
    console.warn('[import] в файле не найден полигон или таблица участков');
    return false;
  };

  /** Импортировать участок из файла, выбранного в скрытом input. */
  const handleImportFile = async (file: File) => {
    try {
      importAreasFromText(await file.text());
    } catch (error) {
      console.error('[import] не удалось прочитать файл:', error);
    }
  };

  /** Импортировать ОДИН участок из встроенного образца (`/samples/…`). */
  const handleImportSample = async (url: string, areaIndex: number) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Грузим только выбранный участок (не все сразу).
      importAreasFromText(await response.text(), areaIndex);
    } catch (error) {
      console.error('[import] не удалось загрузить образец:', error);
    }
  };

  /**
   * Открыть сохранённый сценарий: загрузить полный снимок проекта из БД
   * и восстановить его в domain layer подсистемы рисования.
   */
  const handleOpenScenario = async (scenarioId: string) => {
    try {
      const snapshot = await fetchProjectSnapshot({ projectId: scenarioId });
      loadSnapshot(snapshot);
      setDrawTool('none');
      selectEntity(null);
    } catch (error) {
      console.error('[scenarios] не удалось открыть сценарий:', error);
    }
  };

  return (
    <div className="app-root">
      {/* Скрытый выбор файла: GeoJSON / таблица (txt) / CSV с участками */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,.txt,.csv,application/geo+json,application/json,text/csv,text/plain"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = ''; // позволить повторный выбор того же файла
        }}
      />
      {/* Скрытый выбор файла для импорта МОДЕЛИ (JSON) */}
      <input
        ref={modelInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportModelFile(file);
          e.target.value = ''; // позволить повторный выбор того же файла
        }}
      />
      <TopBar
        breadcrumbs={[{ label: 'Восточная Сибирь' }, { label: 'Региональный модуль' }]}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        scenarioLabel="Сценарии"
        onOpenScenario={handleOpenScenario}
        onImportModel={() => modelInputRef.current?.click()}
        onExportModel={handleExportModel}
      />
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
            showGraphTools={editMode}
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
            canDelete={editMode && drawSelections.length > 0}
            onDelete={removeSelection}
            fluid={drawFluid}
            onFluidChange={setDrawFluid}
            pipelineClass={drawPipelineClass}
            onPipelineClassChange={setDrawPipelineClass}
            onExportAreas={handleExportAreas}
            canExportAreas={drawAreas.length > 0}
            onImportSample={handleImportSample}
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
          <ParameterPanel
            entity={selectedDetails}
            loading={entityLoading}
            error={entityError}
            onRetry={refetchEntity}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
            onNavigateToRelation={(id) => selectEntity(id, 'facility')}
            onCollapse={() => setRightCollapsed(true)}
            onRename={handleRenameSelected}
          />
        }
        bottom={<BottomPanel value={timeRange} onChange={setTimeRange} />}
      />
    </div>
  );
}

export default App;
