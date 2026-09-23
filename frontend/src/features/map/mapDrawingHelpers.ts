/**
 * Чистые вспомогательные функции и типы подсистемы рисования графа.
 * Вынесены из mapDrawing.tsx (рефакторинг) — без React и без побочных эффектов,
 * кроме счётчика уникальных id (nextId).
 */
import { lngLatToGraphPoint } from './geo';
import { newUid } from './drawingTypes';
import type {
  DrawVertex,
  DrawnSegment,
  MapFitting,
  MapTap,
  MapVertex,
} from './drawingTypes';

/**
 * Спроектированный трубопровод (единица группы «Трубопроводы» в дереве).
 *
 * НЕ хранит количество сегментов: оно ВЫВОДИТСЯ из списка сегментов
 * (`DrawnSegment.pipelineId`) — единый источник истины, чтобы счётчик
 * не расходился с реальностью при удалении/разрезании сегментов.
 */
export type PipelineRecord = {
  id: string;
  label: string;
};

/** Входной снимок сценария для loadSnapshot (согласован с backend ProjectSnapshot). */
export type ProjectSnapshotInput = {
  facilities: Array<{
    id: string;
    /** Уникальный id сущности (в старых снимках может отсутствовать) */
    uid?: string;
    name: string;
    kind: string;
    lat: number;
    lng: number;
    width_m?: number;
    height_m?: number;
  }>;
  nodes: Array<{
    id: string;
    /** Уникальный id сущности (в старых снимках может отсутствовать) */
    uid?: string;
    name: string;
    kind: 'vertex' | 'tee' | 'tap';
    lat: number;
    lng: number;
    facility_id?: string | null;
    tap_edge_id?: string | null;
    tap_t?: number | null;
    bound_tap_id?: string | null;
    bound_fitting_id?: string | null;
  }>;
  segments: Array<{
    id: string;
    /** Уникальный id сущности (в старых снимках может отсутствовать) */
    uid?: string;
    name: string;
    start_node_id: string;
    end_node_id: string;
    fluid: string;
    pipeline_class?: string;
  }>;
  pipelines: Array<{
    id: string;
    name: string;
    fluid: string;
    pipeline_class?: string;
    segment_ids: string[];
  }>;
  licence_areas: Array<{ id: string; uid?: string; name: string; polygon: Array<[number, number]> }>;
};

/** Снимок состояния графа для undo/redo. */
export type GraphSnapshot = {
  segments: DrawnSegment[];
  pipelines: PipelineRecord[];
  vertices: MapVertex[];
  fittings: MapFitting[];
  taps: MapTap[];
};

/** Максимальная глубина истории (кол-во шагов). */
export const HISTORY_LIMIT = 50;

let seq = 0;
/** Сгенерировать уникальный id с префиксом (например 'seg', 'tap'). */
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/** Вершины совпадают (одна и та же точка) — сегмент-петля запрещён. */
export function sameVertex(a: DrawVertex, b: DrawVertex): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
}

/** Извлечь id узла из vid вида `snap-<nodeId>` (или null). */
export function nodeIdFromVid(v: DrawVertex): string | null {
  return v.vid.startsWith('snap-') ? v.vid.slice('snap-'.length) : null;
}

/**
 * Проставить типу конца ребра привязку к врезке/тройнику по данным узла снимка.
 * Нужно, чтобы после загрузки сегмент снова был подключён к врезке/тройнику.
 */
export function bindEndByNode(
  v: DrawVertex,
  node: ProjectSnapshotInput['nodes'][number] | undefined,
): DrawVertex {
  if (!node) return v;
  if (node.bound_tap_id) {
    return { type: 'tap', vid: v.vid, x: v.x, y: v.y, tapId: node.bound_tap_id };
  }
  if (node.bound_fitting_id) {
    return { type: 'fitting', vid: v.vid, x: v.x, y: v.y, fittingId: node.bound_fitting_id };
  }
  return v;
}

/**
 * Восстановить DrawVertex (конец ребра) из узла снимка БД.
 *  - `tap`  → вершина, привязанная к врезке (создаём/переиспользуем MapTap);
 *  - `tee`  → вершина, привязанная к тройнику (MapFitting);
 *  - `vertex` + facility_id → вершина на границе объекта (type 'box');
 *  - иначе → свободная точка.
 * Возвращает null, если узел не найден (битые данные).
 */
export function nodeToDrawVertex(
  node: ProjectSnapshotInput['nodes'][number] | undefined,
  verticesById: Map<string, MapVertex>,
  fittingsById: Map<string, MapFitting>,
  tapsById: Map<string, MapTap>,
): DrawVertex | null {
  if (!node) return null;
  const world = lngLatToGraphPoint(node.lng, node.lat);
  const vid = `snap-${node.id}`;

  if (node.kind === 'tap') {
    if (!tapsById.has(node.id)) {
      tapsById.set(node.id, {
        id: node.id,
        // uid из снимка; старый файл без uid — генерируем новый.
        uid: node.uid ?? newUid(),
        label: node.name,
        x: world.x,
        y: world.y,
        lng: node.lng,
        lat: node.lat,
        // Восстанавливаем ребро-носитель и позицию t из снимка.
        edgeId: node.tap_edge_id ?? '',
        t: node.tap_t ?? 0.5,
      });
    }
    return { type: 'tap', vid, x: world.x, y: world.y, tapId: node.id };
  }

  if (node.kind === 'tee') {
    if (!fittingsById.has(node.id)) {
      fittingsById.set(node.id, {
        id: node.id,
        uid: node.uid ?? newUid(),
        label: node.name,
        x: world.x,
        y: world.y,
        lng: node.lng,
        lat: node.lat,
      });
    }
    return { type: 'fitting', vid, x: world.x, y: world.y, fittingId: node.id };
  }

  // Обычная вершина: если привязана к объекту — как стык к его границе.
  if (node.facility_id && verticesById.has(node.facility_id)) {
    return { type: 'box', vid, x: world.x, y: world.y, boxId: node.facility_id, lx: 0, ly: 0 };
  }
  return { type: 'free', vid, x: world.x, y: world.y };
}
