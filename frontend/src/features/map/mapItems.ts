import type { Edge, Node, Options } from 'vis-network';
import { mockMapEdges, mockMapNodes, type MapEdgeData } from './mapData';
import {
  EDGE_ARROWS,
  EDGE_LABEL_COLOR,
  EDGE_SELECT_WIDTH,
  EDGE_WIDTH,
  getEdgeColor,
  getFluidColor,
  getMarkerColor,
  getPipelineClassStyle,
} from './mapColors';
import {
  drawVertexNodeId,
  isBoxVertex,
  FITTING_RADIUS,
  TAP_RADIUS,
  type DrawVertex,
  type DrawnSegment,
  type MapFitting,
  type MapTap,
  type MapVertex,
} from './drawingTypes';
import type { EntityKind } from '../../domain/types';

/**
 * Преобразование доменных данных карты (mapData.ts) в vis-network формат.
 * Отделено от компонента, чтобы MapViewport занимался только координацией.
 */

/** Построение vis-узлов из доменных объектов карты. */
export function buildNodes(showLabels: boolean): Node[] {
  return mockMapNodes.map((n) => ({
    id: n.id,
    label: showLabels ? n.label : '',
    x: n.x,
    y: n.y,
    shape: 'dot',
    size: 14,
    color: getMarkerColor(n.kind),
    borderWidth: 3,
    font: { color: '#E6ECF8', size: 13, face: 'Inter, sans-serif' },
  }));
}

/** Построение vis-рёбер из доменных трубопроводов. */
export function buildEdges(showLabels: boolean, directed: boolean): Edge[] {
  return mockMapEdges.map((e: MapEdgeData) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    label: showLabels ? e.flowLabel : '',
    // Выделение — тем же цветом, но толще (не светлым): color.highlight = цвет,
    // selectionWidth увеличивает толщину выделенного ребра.
    color: {
      color: getFluidColor(e.fluid),
      width: EDGE_WIDTH,
      highlight: getFluidColor(e.fluid),
    },
    selectionWidth: EDGE_SELECT_WIDTH,
    font: { color: EDGE_LABEL_COLOR, size: 11, strokeWidth: 0, align: 'top' },
    // Направление потока: from → to (только для ориентированного графа)
    arrows: directed ? EDGE_ARROWS : undefined,
  }));
}

/** Видимые данные сети: скрытые узлы и их инцидентные рёбра исключаются. */
export function getVisibleData(hiddenNodeIds: ReadonlySet<string>) {
  const visibleNodeIds = mockMapNodes
    .map((n) => n.id)
    .filter((id) => !hiddenNodeIds.has(id));
  const visibleNodeSet = new Set(visibleNodeIds);
  const visibleEdges = mockMapEdges.filter(
    (e) => visibleNodeSet.has(e.from) && visibleNodeSet.has(e.to),
  );
  return { visibleNodeIds, visibleEdges };
}

/** Доменный kind сущности по id узла карты (для selectedEntity). */
export function getMapNodeEntityKind(id: string): EntityKind | undefined {
  const node = mockMapNodes.find((n) => n.id === id);
  if (!node) return undefined;
  return node.kind === 'wellpad' ? 'wellpad' : 'facility';
}

/**
 * Канонический id vis-узла для вершины ребра. Должен совпадать у узла и у
 * ребра (from/to), иначе vis не может соединить ребро с узлом.
 *
 * Стык к тройнику/врезке: у конца ребра СОХРАНЯЕТСЯ своя вершина (уникальный vid
 * → отдельный узел поверх сущности) — её видно и можно перетащить/отсоединить.
 * Только стык к объекту графа — общий узел объекта.
 */
export function drawVertexVisId(v: DrawVertex): string {
  if (v.type === 'node') return v.nodeId;
  return drawVertexNodeId(v);
}

/** Ссылочные вершины: их vis-узел создаётся отдельными билдерами, не здесь. */
function isReferenceVertex(v: DrawVertex): boolean {
  return v.type === 'node';
}

/** vis-узел (точка) для СВОБОДНОЙ вершины сегмента. */
function drawVertexToNode(v: DrawVertex, color: string): Node {
  return {
    id: drawVertexVisId(v),
    x: v.x,
    y: v.y,
    shape: 'dot',
    size: 4,
    // Заливка и контур — как у родительского ребра (цвет по флюиду).
    color: { background: color, border: color },
    borderWidth: 2,
    physics: false,
    // Любую вершину ребра можно тащить: чтобы отсоединить от куста,
    // её достаточно утащить за пределы области соединения (см. dragEnd).
    fixed: false,
  };
}

/**
 * vis-узлы для вершин всех сегментов. Ссылочные вершины (объект/тройник/врезка)
 * пропускаются — их узлы создают buildVertexNodes/buildFittingNodes/buildTapNodes.
 * Цвет вершины наследуется от ребра (флюид), чтобы совпадать с рисунком ребра.
 */
export function buildDrawingNodes(segments: DrawnSegment[]): Node[] {
  const byId = new Map<string, Node>();
  for (const seg of segments) {
    const color = getFluidColor(seg.fluid);
    for (const v of [seg.from, seg.to]) {
      if (isReferenceVertex(v)) continue;
      const node = drawVertexToNode(v, color);
      byId.set(String(node.id), node);
    }
  }
  return Array.from(byId.values());
}

/** vis-рёбра для нарисованных сегментов. */
export function buildDrawingEdges(segments: DrawnSegment[], directed: boolean): Edge[] {
  return segments.map((seg) => {
    const classStyle = getPipelineClassStyle(seg.pipelineClass);
    // Логический поток — тёмно-серый, остальные классы — цвет флюида.
    const edgeColor = getEdgeColor(seg.fluid, seg.pipelineClass);
    return {
      id: seg.id,
      from: drawVertexVisId(seg.from),
      to: drawVertexVisId(seg.to),
      // Цвет — по классу/флюиду, толщина/штрих — по классу трубопровода.
      // Выделение — тем же цветом, но толще (UX: без смены цвета на светлый)
      color: {
        color: edgeColor,
        width: classStyle.width,
        highlight: edgeColor,
      },
      selectionWidth: EDGE_SELECT_WIDTH,
      // Логический поток — пунктир (как в макете «Класс трубопровода»).
      dashes: classStyle.dash ? true : false,
      font: { color: EDGE_LABEL_COLOR, size: 11, strokeWidth: 0, align: 'top' },
      // Ориентированный граф: стрелка направления от начала ребра к концу.
      arrows: directed ? EDGE_ARROWS : undefined,
    };
  });
}

/** vis-узлы для серых вершин-тройников. */
export function buildFittingNodes(fittings: MapFitting[], showLabels: boolean): Node[] {
  return fittings.map((f) => ({
    id: `tee-${f.id}`,
    label: showLabels ? f.label : '',
    x: f.x,
    y: f.y,
    shape: 'dot',
    size: FITTING_RADIUS,
    color: { background: '#94a3b8', border: '#64748b' },
    borderWidth: 2,
    fixed: false,
    font: { color: '#cbd5e1', size: 12, face: 'Inter, sans-serif' },
  }));
}

/** vis-узлы для врезок (светло-синие точки на рёбрах). */
export function buildTapNodes(taps: MapTap[], showLabels: boolean): Node[] {
  return taps.map((t) => ({
    id: `tap-${t.id}`,
    label: showLabels ? t.label : '',
    x: t.x,
    y: t.y,
    shape: 'dot',
    size: TAP_RADIUS,
    color: { background: '#7dd3fc', border: '#38bdf8' },
    borderWidth: 2,
    fixed: false,
    font: { color: '#bae6fd', size: 11, face: 'Inter, sans-serif' },
  }));
}

/**
 * vis-узлы для спроектированных вершин-объектов.
 * Прямоугольные кусты рисуются отдельным DOM-слоем (VertexBoxes), а не как узлы.
 */
export function buildVertexNodes(vertices: MapVertex[], showLabels: boolean): Node[] {
  return vertices
    .filter((v) => !isBoxVertex(v.kind))
    .map((v) => ({
      id: v.id,
      label: showLabels ? v.label : '',
      x: v.x,
      y: v.y,
      shape: 'dot',
      size: 14,
      color: getMarkerColor(v.kind),
      borderWidth: 3,
      fixed: false,
      font: { color: '#E6ECF8', size: 13, face: 'Inter, sans-serif' },
    }));
}

/** Базовые опции сети: физика выключена — координаты фиксированные. */
export const NETWORK_OPTIONS: Options = {
  // Контейнер карты теперь на весь экран и НЕ меняется при drag разделителей
  // панелей, поэтому autoResize реагирует только на реальный resize окна.
  autoResize: true,
  physics: { enabled: false },
  // Прямые рёбра без сглаженных/изогнутых траекторий vis-network.
  edges: { smooth: false },
  interaction: {
    hover: true,
    multiselect: false,
    selectConnectedEdges: false,
    // Зум отключаем штатный и делаем свой на wheel
    // (чтобы колесо меняло только масштаб, без смещения к курсору).
    zoomView: false,
    // Панорамирование выключено: своё панорамирование — на Ctrl+ЛКМ.
    dragView: false,
  },
};
