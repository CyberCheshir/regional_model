import type {
  DrawnSegment,
  DrawVertex,
  LicenceArea,
  MapTap,
  MapVertex,
} from '../features/map/drawingTypes';
import type { PipelineRecord } from '../features/map/mapDrawingHelpers';
import { graphPointToLngLat } from '../features/map/geo';

/**
 * Сохранение нарисованного графа в backend (POST /api/map/save/).
 *
 * Backend (services/graph_import.py) принимает снимок проекта и атомарно
 * заменяет содержимое: объекты, узлы (концы рёбер/тройники/врезки), сегменты,
 * трубопроводы, лицензионные участки. Локальные id связывают сущности между
 * собой внутри одного запроса.
 */

export type MapSavePayload = {
  /** Имя сценария (проекта) — для сохранения под конкретным именем */
  project_name?: string;
  facilities: Array<{
    id: string;
    name: string;
    kind: string;
    lat: number;
    lng: number;
    width_m?: number;
    height_m?: number;
    angle_deg?: number;
    status?: string;
    license_area?: string;
    owner?: string;
  }>;
  nodes: Array<{
    id: string;
    name: string;
    kind: 'vertex' | 'tee' | 'tap';
    lat: number;
    lng: number;
    /** Объект, на границе которого лежит узел (для 'box'-стыков) */
    facility_id?: string | null;
    /** Врезка: id ребра (сегмента), НА КОТОРОМ она расположена */
    tap_edge_id?: string | null;
    /** Врезка: позиция вдоль ребра t ∈ [0..1] */
    tap_t?: number | null;
    /** Конец ребра, подключённый К врезке: id врезки */
    bound_tap_id?: string | null;
    /** Конец ребра, подключённый К тройнику: id тройника */
    bound_fitting_id?: string | null;
  }>;
  segments: Array<{
    id: string;
    name: string;
    start_node_id: string;
    end_node_id: string;
    fluid: string;
    /** Класс трубопровода (стиль линии): field|interfield|trunk|logical */
    pipeline_class: string;
  }>;
  pipelines: Array<{
    id: string;
    name: string;
    fluid: string;
    pipeline_class: string;
    segment_ids: string[];
  }>;
  licence_areas: Array<{
    id: string;
    name: string;
    polygon: Array<[number, number]>;
  }>;
};

export type MapSaveInput = {
  vertices: MapVertex[];
  segments: DrawnSegment[];
  pipelines: PipelineRecord[];
  areas: LicenceArea[];
  /** Врезки: координаты + привязка к ребру (edgeId, t) */
  taps?: MapTap[];
  /** Имя сценария (проекта): по нему бэкенд создаёт/переиспользует проект */
  projectName?: string;
};

/** Локальный id узла для конца ребра — стабилен для одного снимка. */
function nodeKey(v: DrawVertex): string {
  return v.vid || `anon-${v.x.toFixed(3)}-${v.y.toFixed(3)}`;
}

/**
 * Убрать дубли записей по полю id (оставляем первую). Циклическая передача не
 * важна — сохраняем порядок первых вхождений.
 */
function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/**
 * Собрать payload сохранения из состояния подсистемы рисования.
 *
 * Каждый конец ребра становится узлом (vertex/tee/tap). Если конец привязан к
 * объекту (type 'box'), узел получает facility_id и координаты вершины ребра.
 */
export function buildSavePayload(input: MapSaveInput): MapSavePayload {
  const { vertices, segments, areas, taps = [] } = input;
  // Защита от дублей: id уникальны в рамках проекта (иначе на бэкенде упадёт
  // unique-constraint по external_key). Дедуплицируем объекты и сегменты по id.
  const pipelines = dedupeById(input.pipelines);
  const uniqVertices = dedupeById(vertices);
  const uniqSegments = dedupeById(segments);

  const facilities: MapSavePayload['facilities'] = uniqVertices.map((v) => ({
    id: v.id,
    name: v.label,
    kind: v.kind,
    lat: v.lat,
    lng: v.lng,
    ...(v.w !== undefined ? { width_m: v.w } : {}),
    ...(v.h !== undefined ? { height_m: v.h } : {}),
    status: 'running',
  }));

  // Узлы: один узел на каждый конец каждого ребра (по vid).
  const nodesByKey = new Map<string, MapSavePayload['nodes'][number]>();
  const addNode = (v: DrawVertex) => {
    const key = nodeKey(v);
    if (nodesByKey.has(key)) return;
    const geo = graphPointToLngLat(v.x, v.y);
    const kind: 'vertex' | 'tee' | 'tap' =
      v.type === 'tap' ? 'tap' : v.type === 'fitting' ? 'tee' : 'vertex';
    // Врезка: сохраняем её координаты, привязку к ребру (edgeId) и параметр t.
    const tapMeta =
      v.type === 'tap'
        ? (() => {
            const tap = taps.find((it) => it.id === v.tapId);
            return { tap_edge_id: tap?.edgeId ?? null, tap_t: tap?.t ?? null };
          })()
        : {};
    nodesByKey.set(key, {
      id: key,
      name: `${kind === 'tee' ? 'Тройник' : kind === 'tap' ? 'Врезка' : 'Узел'} ${nodesByKey.size + 1}`,
      kind,
      lat: geo.lat,
      lng: geo.lng,
      facility_id: v.type === 'box' ? v.boxId : null,
      // Конец ребра, пристыкованный к врезке/тройнику — запоминаем, к кому именно.
      bound_tap_id: v.type === 'tap' ? v.tapId : null,
      bound_fitting_id: v.type === 'fitting' ? v.fittingId : null,
      ...tapMeta,
    });
  };

  const saveSegments: MapSavePayload['segments'] = [];
  uniqSegments.forEach((s) => {
    addNode(s.from);
    addNode(s.to);
    saveSegments.push({
      id: s.id,
      // Имя сегмента — СВОЁ (закреплено при создании/пользователем). НЕ выводим
      // имя из позиции: иначе объединение/переупорядочивание ломало бы имена.
      name: s.label || 'Сегмент',
      start_node_id: nodeKey(s.from),
      end_node_id: nodeKey(s.to),
      fluid: s.fluid,
      pipeline_class: s.pipelineClass,
    });
  });

  const savePipelines: MapSavePayload['pipelines'] = pipelines.map((p) => ({
    id: p.id,
    name: p.label,
    fluid: 'oil',
    // Класс берём от первого сегмента полилинии (все сегменты создаются одним классом).
    pipeline_class:
      uniqSegments.find((s) => s.pipelineId === p.id)?.pipelineClass ?? 'field',
    segment_ids: uniqSegments.filter((s) => s.pipelineId === p.id).map((s) => s.id),
  })).filter((p) => p.segment_ids.length > 0);

  const saveAreas: MapSavePayload['licence_areas'] = areas.map((a) => ({
    id: a.id,
    name: a.label,
    polygon: a.lngLat.map((g) => [g.lng, g.lat] as [number, number]),
  }));

  return {
    ...(input.projectName ? { project_name: input.projectName } : {}),
    facilities,
    nodes: Array.from(nodesByKey.values()),
    segments: saveSegments,
    pipelines: savePipelines,
    licence_areas: saveAreas,
  };
}

export type MapSaveResult = {
  project_id: string;
  project_name?: string;
  counts: Record<string, number>;
};

/** Краткая запись сценария (проекта) для меню «Сценарии». */
export type ScenarioSummary = {
  id: string;
  name: string;
  slug: string;
  updated_at?: string;
};

/** DELETE /api/projects/<id>/ — удалить сценарий (каскадно его содержимое). */
export async function deleteScenario(scenarioId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(scenarioId)}/`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });
  // 204 No Content — успех; 404 — уже удалён (считаем успехом).
  if (!response.ok && response.status !== 404) {
    throw new Error(`Не удалось удалить сценарий: HTTP ${response.status}`);
  }
}

/** GET /api/projects/ — список сохранённых сценариев. */
export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const response = await fetch('/api/projects/', {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Не удалось получить список сценариев: HTTP ${response.status}`);
  }
  return (await response.json()) as ScenarioSummary[];
}

/** Снимок проекта с бэкенда (для загрузки в domain layer). */
export type ProjectSnapshot = {
  project: { id: string; name: string; slug: string };
  facilities: Array<{
    id: string; name: string; kind: string; lat: number; lng: number;
    width_m?: number; height_m?: number; angle_deg?: number;
  }>;
  nodes: Array<{
    id: string; name: string; kind: 'vertex' | 'tee' | 'tap';
    lat: number; lng: number; facility_id?: string | null;
    /** Врезка: ребро-носитель и позиция t */
    tap_edge_id?: string | null;
    tap_t?: number | null;
    /** Конец ребра, подключённый к врезке/тройнику */
    bound_tap_id?: string | null;
    bound_fitting_id?: string | null;
  }>;
  segments: Array<{
    id: string; name: string; start_node_id: string; end_node_id: string;
    fluid: string; pipeline_class?: string;
  }>;
  pipelines: Array<{
    id: string; name: string; fluid: string; pipeline_class?: string; segment_ids: string[];
  }>;
  licence_areas: Array<{ id: string; name: string; polygon: Array<[number, number]> }>;
  counts: Record<string, number>;
};

/** GET /api/map/load/?project_id=… (или project_name) — снимок проекта. */
export async function fetchProjectSnapshot(params: {
  projectId?: string;
  projectName?: string;
}): Promise<ProjectSnapshot> {
  const query = new URLSearchParams();
  if (params.projectId) query.set('project_id', params.projectId);
  if (params.projectName) query.set('project_name', params.projectName);
  const response = await fetch(`/api/map/load/?${query.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // не JSON — оставляем код
    }
    throw new Error(`Не удалось загрузить сценарий: ${detail}`);
  }
  return (await response.json()) as ProjectSnapshot;
}

/** POST /api/map/save/ — сохранить граф. Бросает при неуспехе. */
export async function saveMapGraph(payload: MapSavePayload): Promise<MapSaveResult> {
  const response = await fetch('/api/map/save/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // тело не JSON — оставляем код
    }
    throw new Error(`Не удалось сохранить граф: ${detail}`);
  }
  return (await response.json()) as MapSaveResult;
}
