/**
 * Снап концов рёбер при рисовании на ЧИСТОЙ гео-карте (Вариант 2, без vis-network).
 *
 * Все координаты — мировые единицы графа (метры), они же соответствуют
 * гео-координатам через graphPointToLngLat, поэтому расстояния между ними —
 * это расстояния в метрах (корректный «гео-снап»).
 *
 * Логика зеркалит прежний snapToVertex/resolveDropVertex из MapViewport
 * (Вариант 1), но без обращения к vis: позиции берутся прямо из модели.
 */

import {
  CONNECT_RADIUS,
  POINT_CONNECT_RADIUS,
  VERTEX_SNAP_RADIUS,
  distanceToContour,
  drawVertexNodeId,
  nearestBorderPoint,
  type DrawVertex,
  type DrawnSegment,
  type MapFitting,
  type MapTap,
  type MapVertex,
} from './drawingTypes';

/** Счётчик уникальных vid для «висячих» концов ребёр (см. ниже). */
let vertexSeq = 0;
function nextVertexVid(): string {
  vertexSeq += 1;
  return `sv${vertexSeq}`;
}

/** Геометрия графа, доступная снапу (все координаты — мировые, м). */
export type SnapGeometry = {
  /** Прямоугольные объекты (кусты/УПН/точки поставки) */
  boxes: MapVertex[];
  /** Уже нарисованные сегменты (их концы — кандидаты на стык) */
  segments: DrawnSegment[];
  /** Тройники */
  fittings: MapFitting[];
  /** Врезки */
  taps: MapTap[];
};

/**
 * Снап конца рисуемого ребра к ближайшей вершине по «области соединения».
 *
 * Приоритет — по расстоянию до контура: круг вокруг точечной вершины,
 * периметр прямоугольника для площадных объектов. Кандидаты:
 *  1) вершины уже нарисованных рёбер (радиус VERTEX_SNAP_RADIUS);
 *  2) врезки; 3) тройники; 4) границы площадных объектов (CONNECT_RADIUS).
 * Если ничего рядом нет — свободная точка в месте клика.
 */
export function snapToVertex(
  world: { x: number; y: number },
  geo: SnapGeometry,
): DrawVertex {
  let best: DrawVertex | null = null;
  let bestDist = Infinity;

  /** Учесть кандидата, если он в своей зоне и ближе всех предыдущих. */
  const consider = (d: number, limit: number, make: () => DrawVertex) => {
    if (d <= limit && d < bestDist) {
      bestDist = d;
      best = make();
    }
  };

  // 1. Вершины уже нарисованных рёбер (зона стыка вершин уменьшена).
  // У каждого конца СВОЙ vid, иначе несколько концов слились бы в одну точку.
  for (const seg of geo.segments) {
    for (const v of [seg.from, seg.to]) {
      const d = distanceToContour(world, { kind: 'point', x: v.x, y: v.y });
      consider(d, VERTEX_SNAP_RADIUS, () => ({
        type: 'vertex',
        vid: nextVertexVid(),
        x: v.x,
        y: v.y,
        vertexId: v.vid,
      }));
    }
  }

  // 2. Врезки — к ним подключается трубопровод (крупный радиус — мелкая цель).
  for (const t of geo.taps) {
    const d = distanceToContour(world, { kind: 'point', x: t.x, y: t.y });
    consider(d, POINT_CONNECT_RADIUS, () => ({
      type: 'tap',
      vid: `tapv-${t.id}`,
      x: t.x,
      y: t.y,
      tapId: t.id,
    }));
  }

  // 3. Тройники — к ним подключаются только рёбра (крупный радиус).
  for (const f of geo.fittings) {
    const d = distanceToContour(world, { kind: 'point', x: f.x, y: f.y });
    consider(d, POINT_CONNECT_RADIUS, () => ({
      type: 'fitting',
      vid: nextVertexVid(),
      x: f.x,
      y: f.y,
      fittingId: f.id,
    }));
  }

  // 4. Площадные объекты (контур — периметр прямоугольника).
  for (const b of geo.boxes) {
    const d = distanceToContour(world, {
      kind: 'box',
      x: b.x,
      y: b.y,
      w: b.w ?? 0,
      h: b.h ?? 0,
    });
    consider(d, CONNECT_RADIUS, () => {
      const bp = nearestBorderPoint(world, { x: b.x, y: b.y, w: b.w ?? 0, h: b.h ?? 0 });
      return {
        type: 'box',
        vid: nextVertexVid(),
        x: bp.x,
        y: bp.y,
        boxId: b.id,
        lx: bp.lx,
        ly: bp.ly,
      };
    });
  }

  return best ?? { type: 'free', vid: nextVertexVid(), x: world.x, y: world.y };
}

/**
 * Итоговое определение вершины ребра после перетаскивания (Вариант 2).
 * Приоритет зон: 1) граница площадного объекта; 2) вершина другого ребра;
 * 3) врезка; 4) тройник; иначе — свободная точка.
 *
 * @param selfVid vid перетаскиваемой вершины — исключаем её саму (не липнет к себе).
 */
export function resolveDropVertex(
  world: { x: number; y: number },
  geo: SnapGeometry,
  selfVid: string,
  /** Сегмент, конец которого тянут — его СВОИ концы исключаем (не липнуть к себе). */
  excludeSegId?: string,
): DrawVertex {
  let best: DrawVertex | null = null;
  let bestDist = Infinity;

  for (const b of geo.boxes) {
    const d = distanceToContour(world, {
      kind: 'box',
      x: b.x,
      y: b.y,
      w: b.w ?? 0,
      h: b.h ?? 0,
    });
    if (d <= CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      const bp = nearestBorderPoint(world, { x: b.x, y: b.y, w: b.w ?? 0, h: b.h ?? 0 });
      best = { type: 'box', vid: '', x: bp.x, y: bp.y, boxId: b.id, lx: bp.lx, ly: bp.ly };
    }
  }

  for (const seg of geo.segments) {
    // Не прилипаем к концам того же сегмента, который тянем (в т.ч. к своему концу).
    if (excludeSegId !== undefined && seg.id === excludeSegId) continue;
    for (const v of [seg.from, seg.to]) {
      if (drawVertexNodeId(v) === selfVid) continue; // не к самому себе
      const d = distanceToContour(world, { kind: 'point', x: v.x, y: v.y });
      if (d <= VERTEX_SNAP_RADIUS && d < bestDist) {
        bestDist = d;
        best = { type: 'vertex', vid: v.vid, x: v.x, y: v.y, vertexId: v.vid };
      }
    }
  }

  for (const t of geo.taps) {
    const d = distanceToContour(world, { kind: 'point', x: t.x, y: t.y });
    if (d <= POINT_CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      best = { type: 'tap', vid: `tapv-${t.id}`, x: t.x, y: t.y, tapId: t.id };
    }
  }

  for (const f of geo.fittings) {
    const d = distanceToContour(world, { kind: 'point', x: f.x, y: f.y });
    if (d <= POINT_CONNECT_RADIUS && d < bestDist) {
      bestDist = d;
      best = { type: 'fitting', vid: nextVertexVid(), x: f.x, y: f.y, fittingId: f.id };
    }
  }

  return best ?? { type: 'free', vid: '', x: world.x, y: world.y };
}

/** Проекция точки на отрезок → параметр t ∈ [0..1] (для врезки). */
export function projectOnSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}
