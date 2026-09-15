/**
 * Модель проектируемых элементов графа (режим рисования).
 *
 * Сегмент — ребро с началом и концом в мировых координатах карты.
 * Концы могут быть НЕ привязаны к объектам (свободные точки) либо
 * пристыкованы к вершине-объекту (узлу) или к концу другого ребра.
 *
 * Трубопровод — полилиния из последовательных сегментов: конец одного
 * сегмента является началом следующего (общая вершина).
 */

/** Ссылка на вершину: свободная точка или стык к объекту/вершине/границе куста. */
export type DrawVertex =
  | { type: 'free'; vid: string; x: number; y: number }
  /** Пристыковано к узлу карты (id объекта) */
  | { type: 'node'; vid: string; x: number; y: number; nodeId: string }
  /** Пристыковано к вершине существующего сегмента (общая точка) */
  | { type: 'vertex'; vid: string; x: number; y: number; vertexId: string }
  /**
   * Пристыковано к границе прямоугольного куста.
   * lx/ly — относительное смещение от центра в долях от w/h (граница: |lx| или |ly| = 0.5).
   * Мировые x/y пересчитываются при перемещении/ресайзе куста.
   */
  | { type: 'box'; vid: string; x: number; y: number; boxId: string; lx: number; ly: number }
  /** Пристыковано к серой вершине-тройнику */
  | { type: 'fitting'; vid: string; x: number; y: number; fittingId: string }
  /** Пристыковано к точке врезки (tapId) — к врезке подключается трубопровод */
  | { type: 'tap'; vid: string; x: number; y: number; tapId: string }
  /**
   * Врезка: точка НА теле ребра (edgeId) в параметре t ∈ [0..1].
   * Мировая точка пересчитывается по концам ребра.
   */
  | { type: 'edge'; vid: string; x: number; y: number; edgeId: string; t: number };

/** Мировая точка вершины-стыка к кусту по его текущему положению/размеру. */
export function boxVertexWorld(
  vertex: Extract<DrawVertex, { type: 'box' }>,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number } {
  return { x: box.x + vertex.lx * box.w, y: box.y + vertex.ly * box.h };
}

/**
 * Расстояние от мировой точки до КОНТУРА вершины (0 — на контуре, <0 — внутри).
 * Для точечной вершины контур — окружность радиуса POINT_VERTEX_RADIUS,
 * для прямоугольника — периметр прямоугольника.
 */
export function distanceToContour(
  world: { x: number; y: number },
  shape:
    | { kind: 'point'; x: number; y: number }
    | { kind: 'box'; x: number; y: number; w: number; h: number },
): number {
  if (shape.kind === 'point') {
    return Math.hypot(world.x - shape.x, world.y - shape.y) - POINT_VERTEX_RADIUS;
  }
  const dx = Math.abs(world.x - shape.x) - shape.w / 2;
  const dy = Math.abs(world.y - shape.y) - shape.h / 2;
  if (dx <= 0 && dy <= 0) {
    // Внутри прямоугольника — отрицательное расстояние до контура
    return Math.max(dx, dy);
  }
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

/** Попадает ли точка в область соединения вершины. */
export function inConnectArea(
  world: { x: number; y: number },
  shape:
    | { kind: 'point'; x: number; y: number }
    | { kind: 'box'; x: number; y: number; w: number; h: number },
): boolean {
  return distanceToContour(world, shape) <= CONNECT_RADIUS;
}

/** Прямоугольник (центр + размеры) в мировых координатах. */
export type WorldBox = { x: number; y: number; w: number; h: number };

/** Мировые концы ребра (from/to). */
export type EdgeEnds = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/**
 * Попадает ли точка в произвольный полигон (луч-кастинг).
 * Используется для лассо-выделения произвольной формы.
 */
export function pointInPolygon(
  p: { x: number; y: number },
  poly: ReadonlyArray<{ x: number; y: number }>,
): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Ближайшая точка на границе прямоугольника куста к заданной мировой точке.
 * Возвращает относительные координаты (lx/ly є [-0.5, 0.5]) и расстояние.
 */
export function nearestBorderPoint(
  world: { x: number; y: number },
  box: WorldBox,
): { lx: number; ly: number; x: number; y: number; dist: number } {
  const halfW = box.w / 2;
  const halfH = box.h / 2;
  // Локальные координаты относительно центра куста
  let dx = world.x - box.x;
  let dy = world.y - box.y;
  // Грань, к которой ближе всего: масштабируем к квадрату и clamp на границу
  const rx = dx / halfW; // >1 — вне по X
  const ry = dy / halfH; // >1 — вне по Y
  if (Math.abs(rx) >= Math.abs(ry)) {
    dx = Math.sign(rx || 1) * halfW;
    dy = Math.max(-halfH, Math.min(halfH, dy));
  } else {
    dy = Math.sign(ry || 1) * halfH;
    dx = Math.max(-halfW, Math.min(halfW, dx));
  }
  const px = box.x + dx;
  const py = box.y + dy;
  return {
    lx: dx / box.w,
    ly: dy / box.h,
    x: px,
    y: py,
    dist: Math.hypot(px - world.x, py - world.y),
  };
}

export type DrainFluid = 'oil' | 'gas' | 'water';

/** Спроектированный сегмент трубопровода (ребро). */
export type DrawnSegment = {
  id: string;
  from: DrawVertex;
  to: DrawVertex;
  /** Логическая принадлежность сегмента трубопроводу (полилинии) */
  pipelineId: string | null;
  fluid: DrainFluid;
};

/**
 * Стабильный id vis-узла для вершины сегмента (НЕ зависит от координат,
 * чтобы перетаскивание не меняло идентичность вершины).
 */
export function drawVertexNodeId(v: DrawVertex): string {
  return `drawv-${v.vid}`;
}

/**
 * Тройник — серая вершина-фитинг на карте. К нему могут подключаться
 * ТОЛЬКО вершины рёбер (не площадные объекты). Свободная точка.
 */
export type MapFitting = {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Географические координаты (для API/экспорта) */
  lng: number;
  lat: number;
};

/**
 * Врезка — точка на существующем ребре (трубопроводе), светлее вершин рёбер.
 * Хранит привязку к ребру (edgeId) и параметр t ∈ [0..1] вдоль него,
 * чтобы пересчитываться при перемещении концов ребра.
 */
export type MapTap = {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Географические координаты (для API/экспорта) */
  lng: number;
  lat: number;
  edgeId: string;
  /** Позиция вдоль ребра от from (0) к to (1) */
  t: number;
};

/** Радиус серой вершины-тройника (мировые координаты). */
export const FITTING_RADIUS = 9;

/** Радиус точки врезки (мировые координаты). */
export const TAP_RADIUS = 5;

/** Категория создаваемой вершины-объекта (без трубопроводов). */
export type VertexKind = 'wellpad' | 'facility' | 'delivery-point';

/**
 * Спроектированная вершина-объект (куст / объект подготовки / точка поставки).
 * Координаты центра — в мировых координатах карты.
 * Куст — прямоугольный (площадной) объект, поэтому несёт размеры w/h;
 * точечные объекты (УПН/точка поставки) размеров не имеют.
 */
export type MapVertex = {
  id: string;
  kind: VertexKind;
  label: string;
  x: number;
  y: number;
  /** Географические координаты центра (для API/экспорта) */
  lng: number;
  lat: number;
  /** Ширина прямоугольника (только для wellpad) */
  w?: number;
  /** Высота прямоугольника (только для wellpad) */
  h?: number;
};

/** Размеры площадных объектов по умолчанию при создании (мировые координаты), px. */
export const DEFAULT_VERTEX_SIZE: Record<VertexKind, { w: number; h: number }> = {
  wellpad: { w: 140, h: 100 },
  facility: { w: 120, h: 90 },
  'delivery-point': { w: 100, h: 80 },
};

/** Размер куста по умолчанию (для совместимости с существующими вызовами). */
export const DEFAULT_WELLPAD_SIZE = DEFAULT_VERTEX_SIZE.wellpad;

/** Минимальный размер прямоугольника вершины при ресайзе, px. */
export const MIN_BOX_SIZE = 40;

/**
 * Область соединения: прозрачная зона ВОКРУГ контура вершины.
 * Если конец рисуемого ребра попадает в эту зону, вершина ребра
 * связывается с этой отдельно стоящей вершиной.
 * Радиус одинаков для всех вершин (в мировых координатах).
 */
export const CONNECT_RADIUS = 24;

/** Радиус точечной вершины (маркера) в мировых координатах. */
export const POINT_VERTEX_RADIUS = 14;

/**
 * Область присоединения вершин рёбер ДРУГ К ДРУГУ (в 3 раза меньше общей
 * области соединения) — чтобы вершины сливались только при близком клике.
 */
export const VERTEX_SNAP_RADIUS = CONNECT_RADIUS / 3;

/**
 * Вершина — площадной (прямоугольный) объект?
 * Все спроектированные объекты (куст, объект подготовки, точка поставки)
 * рисуются прямоугольниками с ресайзом/перемещением за стороны и углы.
 */
export function isBoxVertex(kind: VertexKind): boolean {
  return kind === 'wellpad' || kind === 'facility' || kind === 'delivery-point';
}

/** Активный инструмент на карте: рёбра, вершины-объекты, тройник, врезка. */
export type DrawTool = 'none' | 'segment' | 'pipeline' | 'tee' | 'tap' | VertexKind;

/** Инструменты создания вершин-объектов. */
const VERTEX_TOOLS: readonly VertexKind[] = ['wellpad', 'facility', 'delivery-point'];

/** Проверка: инструмент создаёт вершину-объект. */
export function isVertexTool(tool: DrawTool): tool is VertexKind {
  return (VERTEX_TOOLS as readonly string[]).includes(tool);
}

/** Названия для авто-имён вершин. */
export const VERTEX_LABEL: Record<VertexKind, string> = {
  wellpad: 'Куст',
  facility: 'Объект подготовки',
  'delivery-point': 'Точка поставки',
};

/** Черновик полилинии «трубопровод» (в процессе построения). */
export type PipelineDraft = {
  /** Точка начала будущей полилинии */
  start: DrawVertex | null;
  /** Последняя поставленная вершина (конец последнего сегмента) */
  last: DrawVertex | null;
  /** Уже построенные сегменты черновика */
  segments: DrawnSegment[];
};
