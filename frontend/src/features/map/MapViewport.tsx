import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Network, Node, Options } from 'vis-network';
import { useVisNetwork } from './useVisNetwork';
import {
  buildDrawingEdges,
  buildDrawingNodes,
  buildEdges,
  buildFittingNodes,
  buildNodes,
  buildTapNodes,
  buildVertexNodes,
  getMapNodeEntityKind,
  getVisibleData,
  NETWORK_OPTIONS,
} from './mapItems';
import {
  AREA_CLOSE_RADIUS,
  CONNECT_RADIUS,
  MIN_AREA_POINTS,
  distanceToContour,
  drawVertexNodeId,
  isBoxVertex,
  isVertexTool,
  isEdgeTool,
  nearestBorderPoint,
  TAP_VERTEX_RADIUS,
  VERTEX_SNAP_RADIUS,
  type DrawVertex,
  type DrawnSegment,
  type EdgeEnds,
  type MapFitting,
  type MapTap,
  type MapVertex,
} from './drawingTypes';
import { useMapDrawing, type MapSelection } from './mapDrawing';
import { VertexBoxes } from './VertexBoxes';
import { FlowAnimation } from './FlowAnimation';
import { GhostPreview } from './GhostPreview';
import { BasemapTiles } from './BasemapTiles';
import { GeoMapOnly } from './GeoMapOnly';
import { GeoGraphLayer } from './GeoGraphLayer';
import { SelectionActionsBar } from './SelectionActionsBar';
import { GeoGhostPreview } from './GeoGhostPreview';
import { GeoFlowAnimation } from './GeoFlowAnimation';
import { lngLatToGraphPoint, screenToGraphPoint } from './geo';
import {
  projectOnSegment as projectOnSegmentGeo,
  resolveDropVertex as resolveDropVertexGeo,
  snapToVertex as snapToVertexGeo,
} from './snap';
import type { MapDisplaySettings } from '../displaySettings/types';
import type { EntityKind } from '../../domain/types';
import { EdgeDataBadges } from './EdgeDataBadges';
import './MapViewport.css';

/** ВРЕМЕННЫЙ флаг: показать чистую карту (тайлы) без vis-network. */
const MAP_ONLY = true;

/** Полезные поля события click от vis-network. */
type ClickParams = {
  nodes?: string[];
  edges?: string[];
  pointer?: { DOM: { x: number; y: number } };
};

/** Счётчики — для стабильных УНИКАЛЬНЫХ vid (у каждого ребра своя вершина). */
let freeVertexSeq = 0;
let boxVertexSeq = 0;

/** Параметр t ∈ [0..1] — проекция точки на отрезок (для врезки). */
function projectOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return 0.5;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

/** Уникальный vid для вершины-стыка к объекту (свой у каждого ребра). */
function nextBoxVid(): string {
  boxVertexSeq += 1;
  return `bv${boxVertexSeq}`;
}

/**
 * Снап конца ребра к отдельно стоящей вершине по «области соединения».
 *
 * У каждой вершины есть прозрачная зона ВОКРУГ контура (радиус CONNECT_RADIUS):
 * круг вокруг точки-объекта/вершины ребра, рамка вокруг периметра куста.
 * Если клик попадает в эту зону, конец ребра связывается с этой вершиной
 * (а не создаёт свободную точку). Среди подходящих вершин выбирается та,
 * к чьему контуру клик ближе всего.
 */
function snapToVertex(
  world: { x: number; y: number },
  geo: {
    networkNodes: Node[];
    drawingSegments: DrawnSegment[];
    boxes: MapVertex[];
    fittings: MapFitting[];
    taps: MapTap[];
  },
  net: Network,
): DrawVertex {
  let best: DrawVertex | null = null;
  let bestDist = Infinity;

  const consider = (d: number, make: () => DrawVertex) => {
    if (d <= CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      best = make();
    }
  };

  // 1 Точечные объекты графа (узлы карты)
  for (const n of geo.networkNodes) {
    const id = String(n.id);
    const pos = net.getPositions([id])[id];
    const p = pos ?? { x: Number(n.x ?? 0), y: Number(n.y ?? 0) };
    const d = distanceToContour(world, { kind: 'point', x: p.x, y: p.y });
    consider(d, () => ({ type: 'node', vid: `node-${id}`, x: p.x, y: p.y, nodeId: id }));
  }

  // 2. Вершины уже нарисованных сегментов (точечные). Зона присоединения вершин
  // ребёр друг к другу уменьшена (VERTEX_SNAP_RADIUS).
  // ВАЖНО: конец получает СВОЙ уникальный vid (а vertexId указывает на цель),
  // иначе vis сольёт вершины в один узел и их нельзя будет рассоединить.
  for (const seg of geo.drawingSegments) {
    for (const v of [seg.from, seg.to]) {
      const d = distanceToContour(world, { kind: 'point', x: v.x, y: v.y });
      if (d <= VERTEX_SNAP_RADIUS) {
        consider(d, () => ({ type: 'vertex', vid: nextBoxVid(), x: v.x, y: v.y, vertexId: v.vid }));
      }
    }
  }

  // 3. Точки врезок — к ним подключается трубопровод
  for (const t of geo.taps) {
    const d = distanceToContour(world, { kind: 'point', x: t.x, y: t.y });
    consider(d, () => ({ type: 'tap' as const, vid: `tapv-${t.id}`, x: t.x, y: t.y, tapId: t.id }));
  }

  // 4. Серые вершины-тройники (точечные) — к ним подключаются только рёбра
  for (const f of geo.fittings) {
    const d = distanceToContour(world, { kind: 'point', x: f.x, y: f.y });
    consider(d, () => ({
      type: 'fitting' as const,
      // У каждого конца ребра — СВОЯ вершина поверх тройника (чтобы её было видно
      // и можно было перетащить); привязка — через fittingId.
      vid: nextBoxVid(),
      x: f.x,
      y: f.y,
      fittingId: f.id,
    }));
  }

  // 4. Площадные объекты: клик внутри объекта или рядом с границей —
  //    контакт фиксируется на КОНТУРЕ (ближайшая точка края), не внутри.
  for (const b of geo.boxes) {
    const box = { x: b.x, y: b.y, w: b.w ?? 0, h: b.h ?? 0 };
    const d = distanceToContour(world, { kind: 'box', ...box });
    consider(d, () => {
      const bp = nearestBorderPoint(world, box);
      return {
        type: 'box' as const,
        // У каждого ребра — СВОЯ вершина на границе объекта (уникальный vid),
        // иначе несколько рёбер к одному объекту «схлопнулись» бы в одну точку.
        vid: nextBoxVid(),
        x: bp.x,
        y: bp.y,
        boxId: b.id,
        lx: bp.lx,
        ly: bp.ly,
      };
    });
  }

  return best ?? { type: 'free', vid: `f${++freeVertexSeq}`, x: world.x, y: world.y };
}

/**
 * Определить итоговое определение вершины ребра после перетаскивания.
 * Приоритет областей соединения:
 *  1) граница объекта (куст/УПН/точка) → type 'box';
 *  2) вершина (конец) другого ребра → type 'vertex' (общая точка, стык рёбер);
 *  3) иначе — свободная точка type 'free'.
 *
 * @param selfVisId vis-id перетаскиваемой вершины — исключаем её саму,
 *   чтобы она не «прилипала» к собственному концу.
 */
function resolveDropVertex(
  world: { x: number; y: number },
  boxes: MapVertex[],
  segments: DrawnSegment[],
  fittings: MapFitting[],
  taps: MapTap[],
  selfVisId: string,
): DrawVertex {
  let best: DrawVertex | null = null;
  let bestDist = Infinity;

  // 1) Объекты (прямоугольники) — приоритетнее стыка к ребру.
  //    Бросок внутрь объекта — точка всё равно встаёт на КОНТУР (край).
  for (const b of boxes) {
    const box = { x: b.x, y: b.y, w: b.w ?? 0, h: b.h ?? 0 };
    const d = distanceToContour(world, { kind: 'box', ...box });
    if (d <= CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      const bp = nearestBorderPoint(world, box);
      best = {
        type: 'box',
        vid: '',
        x: bp.x,
        y: bp.y,
        boxId: b.id,
        lx: bp.lx,
        ly: bp.ly,
      };
    }
  }

  // 2) Вершины (концы) других рёбер — притягиваемся к ним и становимся общей
  // точкой. Зона присоединения вершин друг к другу уменьшена (VERTEX_SNAP_RADIUS).
  for (const seg of segments) {
    for (const v of [seg.from, seg.to]) {
      if (drawVertexNodeId(v) === selfVisId) continue; // не к самому себе
      const d = distanceToContour(world, { kind: 'point', x: v.x, y: v.y });
      if (d <= VERTEX_SNAP_RADIUS && d < bestDist) {
        bestDist = d;
        best = { type: 'vertex', vid: v.vid, x: v.x, y: v.y, vertexId: v.vid };
      }
    }
  }

  // 3) Точки врезок — трубопровод может подключаться к врезке.
  for (const t of taps) {
    const d = distanceToContour(world, { kind: 'point', x: t.x, y: t.y });
    if (d <= CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      best = { type: 'tap', vid: `tapv-${t.id}`, x: t.x, y: t.y, tapId: t.id };
    }
  }

  // 4) Серые вершины-тройники — тоже допускают подключение ребра.
  for (const f of fittings) {
    const d = distanceToContour(world, { kind: 'point', x: f.x, y: f.y });
    if (d <= CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      best = { type: 'fitting', vid: nextBoxVid(), x: f.x, y: f.y, fittingId: f.id };
    }
  }

  return best ?? { type: 'free', vid: '', x: world.x, y: world.y };
}

export type MapViewportProps = {
  displaySettings: MapDisplaySettings;
  /** id скрытых узлов (из visibilityMap дерева) */
  hiddenNodeIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string | null, kind?: EntityKind) => void;
  /** Оверлеи поверх карты (плавающая модалка диаграммы) */
  children?: ReactNode;
  /** Режим разработчика (dev-оверлеи: координаты и т.п.) */
  devMode?: boolean;
};

/**
 * Центральный картографический холст (Этап 6, README 6.1–6.4, 6.6).
 * Рендерит узлы-объекты и рёбра-трубопроводы через vis-network;
 * синхронизирует видимость дерева, подписи и выбор узла.
 */
export function MapViewport({
  displaySettings,
  hiddenNodeIds,
  selectedId,
  onSelect,
  children,
  devMode = false,
}: MapViewportProps) {
  const { showLabels } = displaySettings;
  const directedGraph = displaySettings.directedGraph;
  const {
    tool,
    setTool,
    segments,
    draft,
    placePoint,
    finishPipeline,
    cancelDrawing,
    moveVertex,
    replaceVertex,
    vertices,
    addVertex,
    setVertexBox,
    fittings,
    addTee,
    taps,
    addTap,
    setTapT,
    reprojectTaps,
    setSegmentEnds,
    replaceSegmentEnds,
    mergeSegments,
    scaleArea,
    rotateArea,
    fluid,
    pipelineClass,
    areas,
    areaDraft,
    addAreaPoint,
    closeArea,
    cancelAreaDraft,
    moveAreaPoint,
    moveArea,
    selections,
    setSelections,
    toggleSelection,
    selectInWorldPolygon,
    beginAction,
  } = useMapDrawing();
  const beginActionRef = useRef(beginAction);
  beginActionRef.current = beginAction;
  const setToolRef = useRef(setTool);
  setToolRef.current = setTool;
  const selectInWorldPolygonRef = useRef(selectInWorldPolygon);
  selectInWorldPolygonRef.current = selectInWorldPolygon;
  const setSelectionsRef = useRef(setSelections);
  setSelectionsRef.current = setSelections;
  // onSelect — снятие выделения в дереве/инспекторе (клик по пустому месту).
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const toggleSelectionRef = useRef(toggleSelection);
  toggleSelectionRef.current = toggleSelection;
  // Зажат ли Shift (для мультивыбора)
  const shiftRef = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const setTapTRef = useRef(setTapT);
  setTapTRef.current = setTapT;
  const tapsRef = useRef(taps);
  tapsRef.current = taps;
  // Стартовые позиции выделенных не-объектов при групповом переносе
  const groupDragRef = useRef<{ id: string; x: number; y: number }[] | null>(null);
  const drawingSegmentsRef = useRef<DrawnSegment[]>([]);
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;
  const fittingsRef = useRef(fittings);
  fittingsRef.current = fittings;
  const replaceVertexRef = useRef(replaceVertex);
  replaceVertexRef.current = replaceVertex;
  const isDrawing = tool !== 'none';
  const addVertexRef = useRef(addVertex);
  addVertexRef.current = addVertex;
  const addTeeRef = useRef(addTee);
  addTeeRef.current = addTee;
  const addTapRef = useRef(addTap);
  addTapRef.current = addTap;
  const addAreaPointRef = useRef(addAreaPoint);
  addAreaPointRef.current = addAreaPoint;
  const closeAreaRef = useRef(closeArea);
  closeAreaRef.current = closeArea;
  const areaDraftRef = useRef(areaDraft);
  areaDraftRef.current = areaDraft;
  const cancelAreaDraftRef = useRef(cancelAreaDraft);
  cancelAreaDraftRef.current = cancelAreaDraft;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const placePointRef = useRef(placePoint);
  placePointRef.current = placePoint;
  const finishPipelineRef = useRef(finishPipeline);
  finishPipelineRef.current = finishPipeline;
  // id куста под курсором (для подсветки цели снапа)
  const [snapBoxId, setSnapBoxId] = useState<string | null>(null);
  // Камера чистой карты (GeoMapOnly) — для оверлея графа в гео-координатах
  const [geoCamera, setGeoCamera] = useState<{
    originX: number;
    originY: number;
    zoom: number;
    w: number;
    h: number;
  } | null>(null);
  // Курсор над чистой картой (экранные px) — для «призрака» создаваемого элемента
  const [geoCursor, setGeoCursor] = useState<{ x: number; y: number } | null>(null);
  // Идёт перетаскивание вершины (для показа областей соединения)
  // Выбранное ребро (для режима врезки): id vis-ребра */
  const selectedEdgeRef = useRef<string | null>(null);
  const moveVertexRef = useRef(moveVertex);
  moveVertexRef.current = moveVertex;

  const nodes = useMemo(() => buildNodes(showLabels), [showLabels]);
  const edges = useMemo(() => buildEdges(showLabels, directedGraph), [showLabels, directedGraph]);
  const { visibleNodeIds, visibleEdges } = useMemo(
    () => getVisibleData(hiddenNodeIds),
    [hiddenNodeIds],
  );
  const visibleNodeSet = useMemo(() => new Set(visibleNodeIds), [visibleNodeIds]);
  const networkNodes = useMemo(
    () => nodes.filter((n) => visibleNodeSet.has(String(n.id))),
    [nodes, visibleNodeSet],
  );
  const networkEdgeIds = useMemo(() => new Set(visibleEdges.map((e) => e.id)), [visibleEdges]);
  const networkEdges = useMemo(
    () => edges.filter((e) => networkEdgeIds.has(String(e.id))),
    [edges, networkEdgeIds],
  );

  // Сегменты рисования: завершённые + уже построенные сегменты черновика.
  // Дедупликация по id — на переходный кадр коммита черновика один и тот же
  // сегмент может оказаться и в segments, и в draft; дубли id ломают vis DataSet.
  const drawingSegments = useMemo<DrawnSegment[]>(() => {
    const byId = new Map<string, DrawnSegment>();
    for (const s of [...segments, ...draft.segments]) byId.set(s.id, s);
    return Array.from(byId.values());
  }, [segments, draft.segments]);
  drawingSegmentsRef.current = drawingSegments;

  // Подсветка выбранного в дереве: объединяем с внутренним выделением.
  const highlightedVertexIds = useMemo(() => {
    const ids = new Set(selections.filter((s) => s.kind === 'vertex').map((s) => s.id));
    if (selectedId && vertices.some((v) => v.id === selectedId)) ids.add(selectedId);
    return Array.from(ids);
  }, [selections, selectedId, vertices]);
  const highlightedSegmentIds = useMemo(() => {
    const ids = new Set(selections.filter((s) => s.kind === 'segment').map((s) => s.id));
    if (selectedId) {
      for (const s of drawingSegments) {
        // Выделен ОДИН сегмент (из дерева/инспектора) — подсвечиваем его.
        // Выделен трубопровод — подсвечиваем все его сегменты.
        if (s.id === selectedId || s.pipelineId === selectedId) ids.add(s.id);
      }
    }
    return Array.from(ids);
  }, [selections, selectedId, drawingSegments]);

  const drawingNodes = useMemo(() => buildDrawingNodes(drawingSegments), [drawingSegments]);
  const drawingEdges = useMemo(
    () => buildDrawingEdges(drawingSegments, directedGraph),
    [drawingSegments, directedGraph],
  );

  // Спроектированные вершины-объекты (кусты/УПН/точки)
  const vertexNodes = useMemo(
    () => buildVertexNodes(vertices, showLabels),
    [vertices, showLabels],
  );
  // Тройники (серые вершины) и врезки (светло-синие точки)
  const fittingNodes = useMemo(
    () => buildFittingNodes(fittings, showLabels),
    [fittings, showLabels],
  );
  const tapNodes = useMemo(() => buildTapNodes(taps, showLabels), [taps, showLabels]);

  // Полный набор vis-элементов: объекты + вершины + фитинги + врезки + рёбра.
  // Дедупликация по id — vis DataSet бросает ошибку на дубликат id.
  const allNodes = useMemo(() => {
    const byId = new Map<string, Node>();
    for (const n of [
      ...networkNodes,
      ...drawingNodes,
      ...vertexNodes,
      ...fittingNodes,
      ...tapNodes,
    ]) {
      byId.set(String(n.id), n);
    }
    return Array.from(byId.values());
  }, [networkNodes, drawingNodes, vertexNodes, fittingNodes, tapNodes]);
  const allEdges = useMemo(() => {
    const byId = new Map<string, (typeof networkEdges)[number]>();
    for (const e of [...networkEdges, ...drawingEdges]) byId.set(String(e.id), e);
    return Array.from(byId.values());
  }, [networkEdges, drawingEdges]);

  const options = useMemo<Options>(() => ({ ...NETWORK_OPTIONS }), []);

  // Реф сети создаём до хука, чтобы обработчик клика мог читать его актуально
  const networkRef = useRef<Network | null>(null);
  const clickContextRef = useRef({
    tool,
    draft,
    isDrawing,
    placePoint,
    finishPipeline,
    onSelect,
    addVertex: addVertexRef,
    addTee: addTeeRef,
    addTap: addTapRef,
    selectedEdge: selectedEdgeRef,
    setSelections: setSelectionsRef,
    toggleSelection: toggleSelectionRef,
    setTool: setToolRef,
    clearSelection: () => setSelectionsRef.current([]),
    applySelection: (item: MapSelection) => {
      if (shiftRef.current) toggleSelectionRef.current(item);
      else setSelectionsRef.current([item]);
    },
  });
  clickContextRef.current = {
    tool,
    draft,
    isDrawing,
    placePoint,
    finishPipeline,
    onSelect,
    addVertex: addVertexRef,
    addTee: addTeeRef,
    addTap: addTapRef,
    selectedEdge: selectedEdgeRef,
    setSelections: setSelectionsRef,
    toggleSelection: toggleSelectionRef,
    setTool: setToolRef,
    clearSelection: () => setSelectionsRef.current([]),
    applySelection: (item: MapSelection) => {
      if (shiftRef.current) toggleSelectionRef.current(item);
      else setSelectionsRef.current([item]);
    },
  };
  // Прямоугольные вершины (кусты) — цели снапа рёбер
  const boxes = useMemo(() => vertices.filter((v) => isBoxVertex(v.kind)), [vertices]);
  const geometryRef = useRef({ networkNodes, drawingSegments, boxes, fittings, taps });
  geometryRef.current = { networkNodes, drawingSegments, boxes, fittings, taps };

  /**
   * Мировые концы ребра по его id: либо нарисованный сегмент (from/to — DrawVertex),
   * либо ребро графа (from/to — vis-узлы, позиции берём из сети).
   */
  const resolveEdgeEndpoints = useCallback(
    (edgeId: string): EdgeEnds | null => {
      const seg = drawingSegments.find((s) => s.id === edgeId);
      if (seg) {
        return { from: { x: seg.from.x, y: seg.from.y }, to: { x: seg.to.x, y: seg.to.y } };
      }
      const edge = allEdges.find((e) => String(e.id) === edgeId);
      const net = networkRef.current;
      if (!edge || !net) return null;
      const pos = net.getPositions([String(edge.from), String(edge.to)]);
      const a = pos[String(edge.from)];
      const b = pos[String(edge.to)];
      if (!a || !b) return null;
      const res: EdgeEnds = { from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } };
      return res;
    },
    [drawingSegments, allEdges],
  );
  const resolveEdgeEndpointsRef = useRef(resolveEdgeEndpoints);
  resolveEdgeEndpointsRef.current = resolveEdgeEndpoints;
  const reprojectTapsRef = useRef(reprojectTaps);
  reprojectTapsRef.current = reprojectTaps;

  // Пересчёт позиций врезок при перемещении/изменении их рёбер
  useEffect(() => {
    reprojectTapsRef.current((edgeId, t) => {
      const ends = resolveEdgeEndpointsRef.current(edgeId);
      if (!ends) return null;
      return {
        x: ends.from.x + (ends.to.x - ends.from.x) * t,
        y: ends.from.y + (ends.to.y - ends.from.y) * t,
      };
    });
  }, [drawingSegments, vertices, fittings, allEdges]);

  const events = useMemo(
    () => ({
      click: (params: unknown) => {
        const p = params as ClickParams;
        const ctx = clickContextRef.current;
        const net = networkRef.current;
        // Режим создания устройства: клик задаёт точку элемента
        if (ctx.isDrawing && p.pointer && net) {
          const world = net.DOMtoCanvas({ x: p.pointer.DOM.x, y: p.pointer.DOM.y });
          // Создание вершины-объекта (куст/УПН/точка) — в точку клика, без снапа.
          // После создания — сразу выходим из режима (одно нажатие = один объект).
          if (isVertexTool(ctx.tool)) {
            ctx.addVertex.current(ctx.tool, world.x, world.y);
            ctx.setTool.current('none');
            return;
          }
          // Тройник (серая вершина) — свободная точка в месте клика
          if (ctx.tool === 'tee') {
            ctx.addTee.current(world.x, world.y);
            return;
          }
          // Врезка — на ВЫБРАННОМ ребре: вычисляем t проекцией клика на ребро
          if (ctx.tool === 'tap') {
            const edgeId = ctx.selectedEdge.current;
            if (edgeId) {
              const ends = resolveEdgeEndpointsRef.current(edgeId);
              const t = ends ? projectOnSegment(world, ends.from, ends.to) : 0.5;
              const px = ends ? ends.from.x + (ends.to.x - ends.from.x) * t : world.x;
              const py = ends ? ends.from.y + (ends.to.y - ends.from.y) * t : world.y;
              ctx.addTap.current(edgeId, px, py);
            }
            return;
          }
          // Создание ребра (сегмент/трубопровод): клик задаёт конец/начало
          const vertex = snapToVertex(world, geometryRef.current, net);
          if (ctx.tool === 'pipeline' && vertex.type !== 'free' && ctx.draft.start) {
            // Стыковка последнего сегмента к вершине завершает полилинию
            ctx.finishPipeline(vertex);
            // Завершили создание трубопровода — выходим из режима
            ctx.setTool.current('none');
          } else {
            ctx.placePoint(vertex);
          }
          return;
        }
        const id = p.nodes && p.nodes.length > 0 ? p.nodes[0] : null;
        const shift = ctx.applySelection;
        // Клик по тройнику/врезке — выделяем для удаления
        if (id && id.startsWith('tee-')) {
          shift({ kind: 'fitting', id: id.slice('tee-'.length) });
          return;
        }
        if (id && id.startsWith('tap-')) {
          shift({ kind: 'tap', id: id.slice('tap-'.length) });
          return;
        }
        // Клик по свободной вершине ребра (drawv-*) — выделяем её
        if (id && id.startsWith('drawv-')) {
          shift({ kind: 'edgeVertex', id });
          return;
        }
        const clickedEdge = p.edges && p.edges.length > 0 ? String(p.edges[0]) : null;
        // Клик по ребру — выделяем его для удаления (Shift — мультивыбор)
        if (clickedEdge) {
          shift({ kind: 'segment', id: clickedEdge });
          // Синхронизация: выбор сегмента на карте → дерево + инспектор.
          ctx.onSelect(clickedEdge, 'segment');
          return;
        }
        if (!id) {
          // Клик по пустому месту (ни узла, ни ребра) — снять выделение
          ctx.clearSelection();
        }
        ctx.onSelect(id, id ? getMapNodeEntityKind(id) : undefined);
      },
      // Начало перетаскивания vis-узла (вершина ребра/тройник/врезка) —
      // один снимок истории на всё действие.
      dragStart: () => beginActionRef.current(),
      select: (params: unknown) => {
        // Запоминаем выбранное ребро (для режима врезки). Выделение для удаления
        // ведём отдельно в click (там доступен Shift).
        const p = params as { edges?: string[]; nodes?: string[] };
        selectedEdgeRef.current =
          p.edges && p.edges.length > 0 ? String(p.edges[0]) : null;
      },
      dragEnd: (params: unknown) => {
        // Правило 1: после перетаскивания вершины сохраняем её координаты
        // в модели (переносим в мировые координаты карты).
        const p = params as { nodes?: string[] };
        const net = networkRef.current;
        if (!net || !p.nodes) return;
        for (const visId of p.nodes) {
          const dom = net.getPositions([visId])[visId];
          if (!dom) continue;
          // Врезка (tap-*): двигается ТОЛЬКО вдоль своего ребра, не выходя за его концы.
          if (visId.startsWith('tap-')) {
            const tapId = visId.slice('tap-'.length);
            const tap = tapsRef.current.find((t) => t.id === tapId);
            if (tap) {
              const ends = resolveEdgeEndpointsRef.current(tap.edgeId);
              if (ends) {
                const t = projectOnSegment({ x: dom.x, y: dom.y }, ends.from, ends.to);
                setTapTRef.current(tapId, t, ends);
              }
            }
            continue;
          }
          // Вершины рёбер (drawv-*) — перепривязка к объекту/вершине/тройнику.
          if (visId.startsWith('drawv-')) {
            const bound = resolveDropVertex(
              { x: dom.x, y: dom.y },
              geometryRef.current.boxes,
              geometryRef.current.drawingSegments,
              geometryRef.current.fittings,
              geometryRef.current.taps,
              visId,
            );
            replaceVertexRef.current(visId, bound);
          } else {
            moveVertexRef.current(visId, dom.x, dom.y);
          }
        }
      },
    }),
    [networkRef],
  );

  const { containerRef } = useVisNetwork({
    nodes: allNodes,
    edges: allEdges,
    options,
    events,
    networkRef,
  });

  // --- Колесо мыши: только ЗУМ (без смещения к курсору) ---
  // Штатный зум vis сдвигает карту к позиции курсора. Мы отключаем его
  // (interaction.zoomView: false) и меняем только масштаб, удерживая центр вида.
  useEffect(() => {
    if (MAP_ONLY) return; // Вариант 2: зум/пан — на GeoMapOnly
    const el = containerRef.current;
    const MIN = 0.1;
    const MAX = 5;
    const STEP = 0.1; // шаг изменения масштаба за один «тик» колеса
    const onWheel = (e: WheelEvent) => {
      const net = networkRef.current;
      if (!net) return;
      // Гасим событие до vis, чтобы его обработчик не подмешал панорамирование.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const scale0 = net.getScale();
      const view0 = net.getViewPosition();

      // Мировая точка, которая сейчас находится в ЦЕНТРЕ экрана:
      //   world = view0 (vis хранит центр вида в viewPosition)
      // Хотим, чтобы она осталась в центре и после зумирования — иначе нет.
      const centerWorld = { x: view0.x, y: view0.y };

      const dir = e.deltaY < 0 ? 1 : -1;
      const scale1 = Math.max(MIN, Math.min(MAX, scale0 * (1 + dir * STEP)));

      // Привязка NONE: масштаб меняем без анимации, позицию центра держим той же.
      net.moveTo({ scale: scale1, position: centerWorld, animation: false });

      // Проверка/коррекция: если после смены масштаба центр уехал — досылаем view.
      const view1 = net.getViewPosition();
      if (Math.abs(view1.x - centerWorld.x) > 1e-6 || Math.abs(view1.y - centerWorld.y) > 1e-6) {
        net.moveTo({ position: centerWorld, scale: scale1, animation: false });
      }
    };
    // document-capture: гарантированно раньше ЛЮБОГО обработчика vis (в т.ч. на window/document)
    const onDocWheel = (e: WheelEvent) => {
      const host = el as HTMLElement | null;
      if (!host) return;
      const r = host.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) onWheel(e);
    };
    document.addEventListener('wheel', onDocWheel, { passive: false, capture: true });
    return () =>
      document.removeEventListener('wheel', onDocWheel, { capture: true } as EventListenerOptions);
  }, [containerRef, networkRef]);

  // --- Ctrl + ЛКМ: панорамирование карты (штатный dragView выключен) ---
  useEffect(() => {
    if (MAP_ONLY) return; // Вариант 2: vis-поле не используется
    const el = containerRef.current;
    if (!el) return;
    let panStart: { x: number; y: number; viewX: number; viewY: number } | null = null;

    const onDown = (e: PointerEvent) => {
      const net = networkRef.current;
      if (!net) return;
      if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const view = net.getViewPosition();
      panStart = { x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const net = networkRef.current;
      if (!net || !panStart) return;
      const scale = net.getScale();
      const dx = (e.clientX - panStart.x) / scale;
      const dy = (e.clientY - panStart.y) / scale;
      net.moveTo({
        position: { x: panStart.viewX - dx, y: panStart.viewY - dy },
        scale,
        animation: false,
      });
    };
    const onUp = () => {
      panStart = null;
    };

    el.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
  }, [containerRef, networkRef]);

  // --- Shift + ЛКМ: лассо-выделение произвольной формы ---
  const [lasso, setLasso] = useState<{ x: number; y: number }[] | null>(null);
  /**
   * Идёт лассо-жест (Shift+ЛКМ). Нужен, чтобы клик-обработчик НЕ снимал
   * выделение на pointerup после лассо (Shift мог быть отпущен раньше).
   */
  const lassoGestureRef = useRef(false);
  useEffect(() => {
    if (MAP_ONLY) return; // Вариант 2: лассо — в GeoGraphLayer
    const el = containerRef.current;
    const net = networkRef.current;
    if (!el || !net) return;
    const host = () => (containerRef.current as HTMLElement).getBoundingClientRect();
    let path: { x: number; y: number }[] | null = null;

    const down = (e: PointerEvent) => {
      // Лассо только при зажатом Shift и ЛКМ (и не в режиме инструмента)
      if (!e.shiftKey || e.button !== 0 || isDrawing) return;
      // Гасим событие ДО vis-network, чтобы он не начал свой прямоугольный выбор
      e.stopPropagation();
      e.stopImmediatePropagation();
      const r = host();
      path = [{ x: e.clientX - r.left, y: e.clientY - r.top }];
      setLasso(path);
    };
    const move = (e: PointerEvent) => {
      if (!path) return;
      e.stopPropagation();
      const r = host();
      path.push({ x: e.clientX - r.left, y: e.clientY - r.top });
      setLasso([...path]);
    };
    const up = () => {
      const pts = path;
      path = null;
      setLasso(null);
      if (!pts || pts.length < 3) return; // короткий жест — не лассо
      const world = pts.map((p) => {
        const w = net.DOMtoCanvas({ x: p.x, y: p.y });
        return { x: w.x, y: w.y };
      });
      selectInWorldPolygonRef.current(world);
    };
    // Слушаем в capture-фазе, чтобы перехватить Shift+drag раньше canvas vis-network
    el.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
    };
  }, [containerRef, networkRef, isDrawing]);

  // --- Предпросмотр («призрак») создаваемого объекта под курсором ---
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  // Режимы, для которых показываем призрак (объекты и рёбра, кроме удаления)
  const ghostTool =
    isVertexTool(tool) || isEdgeTool(tool) || tool === 'tee' || tool === 'tap';
  useEffect(() => {
    if (MAP_ONLY) return; // Вариант 2: призрак — GeoGhostPreview
    const el = containerRef.current;
    const net = networkRef.current;
    if (!el || !net || !ghostTool) {
      setGhost(null);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const w = net.DOMtoCanvas({ x: e.clientX - r.left, y: e.clientY - r.top });
      setGhost({ x: w.x, y: w.y });
    };
    const onLeave = () => setGhost(null);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [containerRef, networkRef, ghostTool]);

  // Правило 1: правая кнопка мыши выходит из режима создания трубопровода/сегмента.
  useEffect(() => {
    if (MAP_ONLY) return; // Вариант 2: ПКМ обрабатывается отдельным эффектом
    const el = containerRef.current;
    if (!el || !isDrawing) return;
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      cancelDrawing();
    };
    el.addEventListener('contextmenu', onContextMenu);
    return () => el.removeEventListener('contextmenu', onContextMenu);
  }, [isDrawing, cancelDrawing, containerRef]);

  // Подсветка куста — цели снапа — при наведении в режиме рисования рёбер.
  const isEdgeDrawing = isEdgeTool(tool);
  useEffect(() => {
    if (MAP_ONLY) return; // Вариант 2: подсветка снапа — в отдельном эффекте ниже
    if (!isEdgeDrawing) {
      setSnapBoxId(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const net = networkRef.current;
      const boxEl = el.getBoundingClientRect();
      if (!net) return;
      const world = net.DOMtoCanvas({ x: e.clientX - boxEl.left, y: e.clientY - boxEl.top });
      let target: string | null = null;
      let best = CONNECT_RADIUS;
      for (const b of geometryRef.current.boxes) {
        const d = distanceToContour(world, { kind: 'box', x: b.x, y: b.y, w: b.w ?? 0, h: b.h ?? 0 });
        if (d <= best) {
          best = d;
          target = b.id;
        }
      }
      setSnapBoxId(target);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, [isEdgeDrawing, containerRef]);

  // Подсветка цели снапа на ЧИСТОЙ карте (Вариант 2): по движению курсора
  // ищем ближайший объект, чья область соединения захватывает точку.
  useEffect(() => {
    if (!MAP_ONLY) return;
    if (!isEdgeDrawing || !geoCursor || !geoCamera) {
      setSnapBoxId(null);
      return;
    }
    const world = screenToGraphPoint(geoCursor, geoCamera);
    let target: string | null = null;
    let best = CONNECT_RADIUS;
    for (const b of vertices.filter((v) => isBoxVertex(v.kind))) {
      const d = distanceToContour(world, { kind: 'box', x: b.x, y: b.y, w: b.w ?? 0, h: b.h ?? 0 });
      if (d <= best) {
        best = d;
        target = b.id;
      }
    }
    setSnapBoxId(target);
  }, [isEdgeDrawing, geoCursor, geoCamera, vertices]);

  // Управляемое выделение извне (выбор в дереве → подсветка на карте)
  // Только для vis-режима: в Варианте 2 узла в vis может не быть (RangeError).
  useEffect(() => {
    if (MAP_ONLY) return;
    const net = networkRef.current;
    if (!net) return;
    const current = net.getSelectedNodes();
    if (selectedId) {
      if (!current.includes(selectedId)) net.selectNodes([selectedId]);
    } else if (current.length) {
      net.unselectAll();
    }
  }, [selectedId, networkRef]);

  // Подсветка выделенных (для удаления) рёбер на карте (только vis-режим)
  useEffect(() => {
    if (MAP_ONLY) return;
    const net = networkRef.current;
    if (!net) return;
    const segIds = new Set(selections.filter((s) => s.kind === 'segment').map((s) => s.id));
    // Выделение из ДЕРЕВА: сегмент (id) или трубопровод (все его сегменты).
    if (selectedId) {
      for (const s of drawingSegments) {
        if (s.id === selectedId || s.pipelineId === selectedId) segIds.add(s.id);
      }
    }
    const ids = Array.from(segIds);
    if (ids.length === 0) return;
    const current = net.getSelectedEdges();
    const toAdd = ids.filter((id) => !current.includes(id));
    if (toAdd.length) net.selectEdges(toAdd);
  }, [selections, selectedId, drawingSegments, networkRef]);

  // Клик по чистой карте (GeoMapOnly): создание объекта/тройника/врезки
  // в гео-координатах точки. Мировые координаты = смещение от MAP_CENTER (м).
  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      // После лассо-жеста (Shift+ЛКМ) клик игнорируем: это был выбор,
      // а не создание точки/снятие выделения (Shift мог быть отпущен раньше).
      if (lassoGestureRef.current) {
        lassoGestureRef.current = false;
        return;
      }
      if (tool === 'none') {
        // Обычный режим: клик по пустому месту карты снимает выделение
        // (и на карте — selections, и в дереве/инспекторе — selectedEntity).
        setSelectionsRef.current([]);
        onSelectRef.current(null);
        return;
      }
      const world = lngLatToGraphPoint(lng, lat);
      if (isVertexTool(tool)) {
        // Множественное создание: режим НЕ закрывается — можно поставить ещё
        // объекты. Выход из режима — ПКМ (см. эффект cancelDrawing ниже).
        addVertexRef.current(tool, world.x, world.y);
        return;
      }
      if (tool === 'tee') {
        addTeeRef.current(world.x, world.y);
        return;
      }
      if (tool === 'licence-area') {
        const pts = areaDraftRef.current;
        // Клик по первой вершине (при >= MIN_AREA_POINTS) — замыкаем полигон.
        const first = pts[0];
        if (
          first &&
          pts.length >= MIN_AREA_POINTS &&
          Math.hypot(world.x - first.x, world.y - first.y) <= AREA_CLOSE_RADIUS
        ) {
          closeAreaRef.current();
          return;
        }
        addAreaPointRef.current(world.x, world.y);
        return;
      }
      // Рисование рёбер (трубопровод/логический поток): снап конца к объектам/вершинам.
      if (isEdgeTool(tool)) {
        const vertex = snapToVertexGeo(world, {
          boxes: geometryRef.current.boxes,
          segments: geometryRef.current.drawingSegments,
          fittings: geometryRef.current.fittings,
          taps: geometryRef.current.taps,
        });
        if (isEdgeTool(tool) && vertex.type !== 'free' && draftRef.current.start) {
          // Стыковка последнего сегмента к вершине завершает полилинию
          finishPipelineRef.current(vertex);
          setToolRef.current('none');
        } else {
          placePointRef.current(vertex);
        }
        return;
      }
      // Врезка ставится ТОЛЬКО кликом по ребру (см. GeoGraphLayer.onSegmentPress).
      // Клик по пустому месту в этом режиме врезку не создаёт (иначе была бы
      // двойная постановка и разрез сегмента не выполнялся бы).
    },
    [tool],
  );

  // Правило 1 (Вариант 2): ПКМ по чистой карте завершает создание
  // трубопровода/сегмента (как было с vis). Уже построенные сегменты сохраняются.
  useEffect(() => {
    if (!MAP_ONLY || !isDrawing) return;
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // В режиме участка ПКМ сбрасывает незамкнутый черновик и выходит из режима.
      if (tool === 'licence-area') cancelAreaDraftRef.current();
      cancelDrawing();
    };
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, [isDrawing, cancelDrawing, tool]);

  // Групповой перенос: двигаем вместе с объектами и выделенные не-объекты
  // (вершины рёбер / тройники / врезки).
  const startGroupDrag = useCallback(() => {
    groupDragRef.current = selectionsRef.current
      .map((s) => {
        if (s.kind === 'edgeVertex') {
          for (const seg of drawingSegmentsRef.current) {
            if (drawVertexNodeId(seg.from) === s.id) return { id: s.id, x: seg.from.x, y: seg.from.y };
            if (drawVertexNodeId(seg.to) === s.id) return { id: s.id, x: seg.to.x, y: seg.to.y };
          }
          return null;
        }
        if (s.kind === 'fitting') {
          const f = fittingsRef.current.find((it) => it.id === s.id);
          return f ? { id: `tee-${s.id}`, x: f.x, y: f.y } : null;
        }
        if (s.kind === 'tap') {
          const t = tapsRef.current.find((it) => it.id === s.id);
          return t ? { id: `tap-${s.id}`, x: t.x, y: t.y } : null;
        }
        return null;
      })
      .filter((x): x is { id: string; x: number; y: number } => !!x);
  }, []);
  const applyGroupDrag = useCallback((dx: number, dy: number) => {
    for (const g of groupDragRef.current ?? []) {
      if (g.id.startsWith('tap-')) {
        // Врезка двигается только по своему ребру — обновляем параметр t
        const tapId = g.id.slice('tap-'.length);
        const tap = tapsRef.current.find((t) => t.id === tapId);
        if (tap) {
          const ends = resolveEdgeEndpointsRef.current(tap.edgeId);
          if (ends) {
            const t = projectOnSegment({ x: g.x + dx, y: g.y + dy }, ends.from, ends.to);
            setTapTRef.current(tapId, t, ends);
          }
        }
      } else {
        moveVertexRef.current(g.id, g.x + dx, g.y + dy);
      }
    }
  }, []);
  const endGroupDrag = useCallback(() => {
    groupDragRef.current = null;
  }, []);

  // Число выделенных сегментов — для контекстной панели над картой.
  const selectedSegmentCount = selections.filter((s) => s.kind === 'segment').length;

  return (
    <div className="map-viewport" data-basemap={displaySettings.basemap} data-drawing={isDrawing ? tool : undefined}>
      {/* Контекстная панель действий над выделением (над картой, сверху) */}
      <SelectionActionsBar
        segmentCount={selectedSegmentCount}
        onMergeIntoPipeline={() => {
          const ids = selections.filter((s) => s.kind === 'segment').map((s) => s.id);
          mergeSegments(ids);
        }}
      />
      {/* ВРЕМЕННО: демонстрация ЧИСТОЙ карты (тайлы) без vis-network.
         Чтобы вернуть граф — переключите MAP_ONLY в false. */}
      {MAP_ONLY && (
        <GeoMapOnly
          basemap={displaySettings.basemap}
          devMode={devMode}
          onCamera={setGeoCamera}
          onMapClick={handleMapClick}
          onCursorMove={setGeoCursor}
            panEnabled={tool === 'none'}
            // Камера НЕ переносится при выделении объекта (ни в дереве, ни на
            // карте) — пользователь сам управляет видом. Проп focus не передаём.
          >
          <GeoFlowAnimation
            segments={drawingSegments}
            camera={geoCamera}
            enabled={displaySettings.flowAnimation}
          />
          <GeoGraphLayer
            camera={geoCamera}
            vertices={vertices}
            fittings={fittings}
            taps={taps}
            segments={drawingSegments}
            areas={displaySettings.showLicenceAreas ? areas : []}
            areaDraft={displaySettings.showLicenceAreas ? areaDraft : []}
            selectedAreaIds={selections.filter((s) => s.kind === 'area').map((s) => s.id)}
            onAreaScale={scaleArea}
            onAreaRotate={rotateArea}
            onSelectArea={(id, withShift) =>
              withShift
                ? toggleSelection({ kind: 'area', id })
                : setSelections([{ kind: 'area', id }])
            }
            onAreaPointMove={(areaId, index, x, y) => moveAreaPoint(areaId, index, x, y)}
            onAreaMove={(areaId, dx, dy) => moveArea(areaId, dx, dy)}
            selectedIds={highlightedVertexIds}
            selectedSegmentIds={highlightedSegmentIds}
            selectedTapIds={selections.filter((s) => s.kind === 'tap').map((s) => s.id)}
            selectedFittingIds={selections.filter((s) => s.kind === 'fitting').map((s) => s.id)}
            onSelectFitting={(id, withShift) =>
              withShift
                ? toggleSelection({ kind: 'fitting', id })
                : setSelections([{ kind: 'fitting', id }])
            }
            snapTargetId={snapBoxId}
            tapMode={tool === 'tap'}
            // Режим СОЗДАНИЯ: клик по существующим элементам не выделяет их,
            // а служит точкой присоединения (снапа). Сама врезка — не «создание»,
            // её клик по ребру обрабатывается отдельно (tapMode).
            drawingMode={isDrawing && tool !== 'tap'}
            onSegmentPress={(edgeId, world) => {
              const seg = drawingSegments.find((s) => s.id === edgeId);
              if (!seg) return;
              const a = { x: seg.from.x, y: seg.from.y };
              const b = { x: seg.to.x, y: seg.to.y };
              // Клик РЯДОМ С КОНЦОМ ребра (в пределах TAP_VERTEX_RADIUS) —
              // врезка ставится НА ВЕРШИНУ: сегмент не режется, врезка просто
              // фиксируется в этой точке (t = 0 или 1).
              const nearFrom = Math.hypot(world.x - a.x, world.y - a.y) <= TAP_VERTEX_RADIUS;
              const nearTo = Math.hypot(world.x - b.x, world.y - b.y) <= TAP_VERTEX_RADIUS;
              if (nearFrom || nearTo) {
                const vx = nearFrom ? a.x : b.x;
                const vy = nearFrom ? a.y : b.y;
                addTap(edgeId, vx, vy, true);
                return;
              }
              // Иначе — обычный разрез ребра в точке клика.
              const t = projectOnSegmentGeo(world, a, b);
              addTap(edgeId, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
            }}
            onSelect={(id, withShift) => {
              if (withShift) {
                toggleSelection({ kind: 'vertex', id });
                return;
              }
              setSelections([{ kind: 'vertex', id }]);
              // Синхронизация: выбор объекта на карте → дерево + инспектор.
              // VertexKind 'delivery-point' в доменной модели — это EntityKind 'facility'.
              const v = vertices.find((it) => it.id === id);
              if (v) onSelect(id, v.kind === 'delivery-point' ? 'facility' : v.kind);
            }}
            onSelectSegment={(id, withShift) => {
              if (withShift) {
                toggleSelection({ kind: 'segment', id });
                return;
              }
              setSelections([{ kind: 'segment', id }]);
              // Синхронизация: выбор сегмента на карте → дерево + инспектор.
              onSelect(id, 'segment');
            }}
            onClearSelection={() => setSelections([])}
            onLasso={(poly) => selectInWorldPolygon(poly)}
            onLassoStart={() => {
              lassoGestureRef.current = true;
            }}
            onBeginAction={beginAction}
            onMove={(id, x, y) => moveVertex(id, x, y)}
            onMoveFitting={(id, x, y) => moveVertex(`tee-${id}`, x, y)}
            onEndsMove={(ends, x, y) => setSegmentEnds(ends, x, y)}
            onEndsDrop={(ends, x, y) => {
              // Резолвим ближайшую цель снапа; если рядом никого нет — все концы
              // группы становятся СВОБОДНЫМИ (стык отсоединяется).
              const bound = resolveDropVertexGeo(
                { x, y },
                {
                  boxes: vertices.filter((v) => isBoxVertex(v.kind)),
                  // Исключаем все тянутые сегменты из целей снапа (не липнуть к себе).
                  segments: drawingSegments.filter((s) => !ends.some((e) => e.segId === s.id)),
                  fittings,
                  taps,
                },
                '',
              );
              replaceSegmentEnds(ends, bound);
            }}
            onSelectTap={(id, withShift) =>
              withShift
                ? toggleSelection({ kind: 'tap', id })
                : setSelections([{ kind: 'tap', id }])
            }
            directed={displaySettings.directedGraph}
            showJoints={displaySettings.showEdgeJoints}
            showLabels={showLabels}
            onResize={(id, box) => setVertexBox(id, box)}
          />
          {/* Призрак создаваемого элемента под курсором */}
          <GeoGhostPreview
            tool={tool}
            cursor={geoCursor}
            camera={geoCamera}
            draft={draft}
            fluid={fluid}
            pipelineClass={pipelineClass}
          />
        </GeoMapOnly>
      )}
      {/* Растровая подложка (тайлы OSM / спутниковые снимки) — под графом */}
      {!MAP_ONLY && (
        <BasemapTiles networkRef={networkRef} basemap={displaySettings.basemap} />
      )}
      <div ref={containerRef} className="map-viewport__canvas" hidden={MAP_ONLY} />
      {/* Vis-слои: только в Варианте 1 (MAP_ONLY=false). В Варианте 2 их роль
         выполняют GeoGraphLayer / GeoFlowAnimation / GeoGhostPreview. */}
      {!MAP_ONLY && (
        <>
          <VertexBoxes
            networkRef={networkRef}
            vertices={vertices}
            onMove={(id, x, y) => moveVertex(id, x, y)}
            onResize={(id, box) => setVertexBox(id, box)}
            highlightId={snapBoxId}
            showLabels={showLabels}
            selectedIds={selections.filter((s) => s.kind === 'vertex').map((s) => s.id)}
            onSelect={(id, withShift) =>
              withShift
                ? toggleSelection({ kind: 'vertex', id })
                : setSelections([{ kind: 'vertex', id }])
            }
            onClearSelection={() => setSelections([])}
            onBeginAction={beginAction}
            onGroupDragStart={startGroupDrag}
            onGroupDrag={applyGroupDrag}
            onGroupDragEnd={endGroupDrag}
          />
          <FlowAnimation
            networkRef={networkRef}
            edges={allEdges}
            enabled={displaySettings.flowAnimation}
          />
          <EdgeDataBadges networkRef={networkRef} edges={visibleEdges} visible={showLabels} />
          {/* Предпросмотр создаваемого объекта/ребра под курсором (ghost) */}
          <GhostPreview tool={tool} ghost={ghost} draft={draft} networkRef={networkRef} />
        </>
      )}
      {/* Лассо выделения произвольной формы (Shift+ЛКМ) */}
      {lasso && lasso.length > 1 && (
        <svg className="map-viewport__lasso" aria-hidden="true">
          <polyline
            points={lasso.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="rgba(0,102,204,0.12)"
            stroke="#0066cc"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </svg>
      )}
      {children}
    </div>
  );
}
