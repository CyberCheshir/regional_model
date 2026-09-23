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

export type DrainFluid = 'oil' | 'gas' | 'product';

/**
 * Класс трубопровода — определяет стиль линии (толщина/штрих) на карте.
 * Ортогонален флюиду: цвет задаётся флюидом, форма — классом.
 * Соответствует панели «Класс трубопровода» в интерфейсе проектирования.
 */
export type PipelineClass = 'field' | 'interfield' | 'trunk' | 'logical';

/** Подписи и порядок классов трубопровода (для UI-списка). */
export const PIPELINE_CLASS_ORDER: readonly PipelineClass[] = [
  'field',
  'interfield',
  'trunk',
  'logical',
];

/** Человекочитаемые подписи классов трубопровода. */
export const PIPELINE_CLASS_LABEL: Record<PipelineClass, string> = {
  field: 'Промысловый',
  interfield: 'Межпромысловый',
  trunk: 'Магистральный',
  logical: 'Логический поток',
};

/**
 * Проверка/приведение значения из API/снимка к PipelineClass.
 * Неизвестное значение → 'field' (промысловый по умолчанию).
 */
export function toPipelineClass(value: unknown): PipelineClass {
  return value === 'interfield' || value === 'trunk' || value === 'logical'
    ? value
    : 'field';
}

/**
 * Проверка/приведение значения из API/снимка к DrainFluid.
 * «Вода» (старое значение) отображается на «Продукт» — модель UI их не различает.
 */
export function toDrainFluid(value: unknown): DrainFluid {
  return value === 'gas' || value === 'product' ? value : 'oil';
}

/**
 * Уникальный идентификатор сущности, генерируемый при СОЗДАНИИ.
 * UUID v4 — не показывается пользователю (нет в UI: ни в дереве, ни в
 * инспекторе, ни в подписях карты). Нужен для однозначного сопоставления
 * объектов между сессиями, снимками и БД.
 */
export type EntityUid = string;

/** Сгенерировать uid (UUID v4; с запасным вариантом для старых браузеров). */
export function newUid(): EntityUid {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback: RFC4122-подобная строка из случайных байтов.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // версия 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // вариант
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Спроектированный сегмент трубопровода (ребро). */
export type DrawnSegment = {
  id: string;
  /** Уникальный id сущности (скрыт от пользователя) */
  uid: EntityUid;
  from: DrawVertex;
  to: DrawVertex;
  /** Логическая принадлежность сегмента трубопроводу (полилинии) */
  pipelineId: string | null;
  fluid: DrainFluid;
  /** Класс трубопровода (стиль линии на карте) */
  pipelineClass: PipelineClass;
  /** Имя сегмента (в дереве). Не задано — авто «Сегмент N» по порядку в трубе. */
  label?: string;
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
  /** Уникальный id сущности (скрыт от пользователя) */
  uid: EntityUid;
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
  /** Уникальный id сущности (скрыт от пользователя) */
  uid: EntityUid;
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

/**
 * Радиус снапа конца ребра к ТОЧЕЧНОЙ цели (врезка/тройник), в мировых метрах.
 * Увеличен в 10 раз относительно исходного (было 24) — по требованию.
 */
export const POINT_CONNECT_RADIUS = 24 * 10;

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
  /** Уникальный id сущности (скрыт от пользователя) */
  uid: EntityUid;
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

/**
 * Размеры площадных объектов по умолчанию при создании (мировые координаты, МЕТРЫ).
 * Увеличены в 67 раз относительно исходных (140×100 и т.п.) — по требованию.
 */
export const DEFAULT_VERTEX_SIZE: Record<VertexKind, { w: number; h: number }> = {
  wellpad: { w: 140 * 67, h: 100 * 67 },
  facility: { w: 120 * 67, h: 90 * 67 },
  'delivery-point': { w: 100 * 67, h: 80 * 67 },
};

/** Минимальный размер прямоугольника вершины при ресайзе, px. */
export const MIN_BOX_SIZE = 40;

/**
 * Область соединения: прозрачная зона ВОКРУГ контура вершины.
 * Если конец рисуемого ребра попадает в эту зону, вершина ребра
 * связывается с этой отдельно стоящей вершиной.
 * Радиус одинаков для всех вершин (в мировых координатах).
 */
export const CONNECT_RADIUS = 24 * 10;

/** Радиус точечной вершины (маркера) в мировых координатах. */
export const POINT_VERTEX_RADIUS = 14;

/**
 * Область присоединения вершин рёбер ДРУГ К ДРУГУ. Намеренно ОЧЕНЬ маленькая
 * (в 30 раз меньше общей области соединения, ≈0.8 м): вершины стыкуются только
 * при практически точном попадании — чтобы конец ребра было легко отсоединить
 * и он не «прилипал» к соседним концам.
 */
// Радиус стыка вершин рёбер: базовое CONNECT_RADIUS/3 (≈80 м при CONNECT_RADIUS=240),
// уменьшено в 10 раз — теперь (CONNECT_RADIUS/3)*2 (≈160 м при CONNECT_RADIUS=240).
export const VERTEX_SNAP_RADIUS = (CONNECT_RADIUS / 3) * 2;

/**
 * Радиус «врезка на вершине»: клик по ребру в пределах этого расстояния
 * от его КОНЦА считается установкой врезки НА ВЕРШИНУ трубопровода —
 * сегмент при этом НЕ разрезается (в отличие от врезки на теле ребра).
 */
export const TAP_VERTEX_RADIUS = VERTEX_SNAP_RADIUS;

/**
 * Вершина — площадной (прямоугольный) объект?
 * Все спроектированные объекты (куст, объект подготовки, точка поставки)
 * рисуются прямоугольниками с ресайзом/перемещением за стороны и углы.
 */
export function isBoxVertex(kind: VertexKind): boolean {
  return kind === 'wellpad' || kind === 'facility' || kind === 'delivery-point';
}

/**
 * Активный инструмент на карте: рёбра, вершины-объекты, тройник, врезка,
 * лицензионный участок (замкнутый полигон территории).
 */
export type DrawTool =
  | 'none'
  | 'pipeline'
  /** Логический поток: ребро без физ. трубы (класс `logical`). */
  | 'logical-pipeline'
  | 'tee'
  | 'tap'
  | 'licence-area'
  | VertexKind;

/** Инструменты создания вершин-объектов. */
const VERTEX_TOOLS: readonly VertexKind[] = ['wellpad', 'facility', 'delivery-point'];

/**
 * Инструменты рисования РЁБЕР (полилиний): обычный трубопровод и
 * «логический поток» (то же рисование, но класс ребра — `logical`).
 */
export function isEdgeTool(tool: DrawTool): boolean {
  return tool === 'pipeline' || tool === 'logical-pipeline';
}

/** Проверка: инструмент создаёт вершину-объект. */
export function isVertexTool(tool: DrawTool): tool is VertexKind {
  return (VERTEX_TOOLS as readonly string[]).includes(tool);
}

/** Названия для авто-имён вершин. */
export const VERTEX_LABEL: Record<VertexKind, string> = {
  wellpad: 'Система сбора',
  facility: 'Объект подготовки',
  'delivery-point': 'Точка поставки',
};

/**
 * Лицензионный участок — замкнутый полигон территории (минимум 3 вершины).
 * Вершины — в мировых единицах (м); для API/экспорта дублируются в lng/lat.
 */
export type LicenceArea = {
  id: string;
  /** Уникальный id сущности (скрыт от пользователя) */
  uid: EntityUid;
  label: string;
  /** Вершины полигона (мировые координаты, м) */
  points: { x: number; y: number }[];
  /** Гео-координаты вершин (для API/экспорта) */
  lngLat: { lng: number; lat: number }[];
};

/** Минимум вершин для замыкания полигона участка. */
export const MIN_AREA_POINTS = 3;

/** Радиус (м), в пределах которого клик по первой вершине замыкает полигон. */
export const AREA_CLOSE_RADIUS = 30;

/** Черновик полилинии «трубопровод» (в процессе построения). */
export type PipelineDraft = {
  /** Точка начала будущей полилинии */
  start: DrawVertex | null;
  /** Последняя поставленная вершина (конец последнего сегмента) */
  last: DrawVertex | null;
  /** Уже построенные сегменты черновика */
  segments: DrawnSegment[];
  /** Класс трубопровода для создаваемой полилинии */
  pipelineClass: PipelineClass;
};

/** Пустой черновик полилинии «трубопровод». */
export const EMPTY_DRAFT: PipelineDraft = {
  start: null,
  last: null,
  segments: [],
  pipelineClass: 'field',
};
