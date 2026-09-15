import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { graphPointToLngLat } from './geo';
import { graphToGeoJSON, type GraphGeoJSON } from './graphExport';
import {
  DEFAULT_VERTEX_SIZE,
  type EdgeEnds,
  drawVertexNodeId,
  pointInPolygon,
  isBoxVertex,
  VERTEX_LABEL,
  type DrawTool,
  type DrawVertex,
  type DrawnSegment,
  type DrainFluid,
  type MapFitting,
  type MapTap,
  type MapVertex,
  type PipelineDraft,
  type VertexKind,
} from './drawingTypes';

/**
 * Состояние подсистемы рисования графа (отделено от uiState и domain-state).
 * Хранит: активный инструмент, завершённые сегменты и черновик полилинии.
 *
 * Логика «клик → вершина» живёт в обработчиках (MapViewport), здесь —
 * только состояние и примитивные операции над ним.
 */

type MapDrawingState = {
  /** Активный инструмент рисования (none — обычный режим) */
  tool: DrawTool;
  /** Выбрать инструмент; сброс черновика при смене */
  setTool: (tool: DrawTool) => void;
  /** Выйти из режима рисования (правило 1: ПКМ завершает создание) */
  cancelDrawing: () => void;

  /** Завершённые сегменты (нарисованные рёбра) */
  segments: DrawnSegment[];
  /** Черновик полилинии «трубопровод» */
  draft: PipelineDraft;

  /** Спроектированные трубопроводы (для дерева объектов) */
  pipelines: PipelineRecord[];
  /** Спроектированные вершины-объекты (кусты, объекты подготовки, точки) */
  vertices: MapVertex[];
  /** Добавить вершину-объект в точке карты (режим создания вершин) */
  addVertex: (kind: VertexKind, x: number, y: number) => void;
  /** Спроектированные тройники (серые вершины-фитинги) */
  fittings: MapFitting[];
  /** Добавить тройник в точке карты */
  addTee: (x: number, y: number) => void;
  /** Спроектированные врезки (светло-синие точки на рёбрах) */
  taps: MapTap[];
  /** Добавить врезку на ребро (edgeId) в точке (world), t — позиция вдоль ребра */
  addTap: (edgeId: string, x: number, y: number, t: number) => void;
  /** Переместить врезку вдоль её ребра (t ∈ [0..1]) */
  setTapT: (id: string, t: number, ends: EdgeEnds) => void;
  /** Пересчитать координаты врезок по резолверу концов их рёбер */
  reprojectTaps: (resolve: (edgeId: string, t: number) => { x: number; y: number } | null) => void;
  /** Изменить положение вершины (перетаскивание) */
  setVertexPosition: (id: string, x: number, y: number) => void;
  /** Изменить размеры прямоугольной вершины (ресайз куста) */
  setVertexSize: (id: string, w: number, h: number) => void;
  /** Изменить и позицию, и размеры куста за один шаг (ресайз за угол) */
  setVertexBox: (id: string, box: { x: number; y: number; w: number; h: number }) => void;

  /** Флюид для новых сегментов (по умолчанию — нефть) */
  fluid: DrainFluid;
  setFluid: (fluid: DrainFluid) => void;

  /** Поставить точку (начало/конец) в режиме рисования. */
  placePoint: (vertex: DrawVertex) => void;

  /**
   * Завершить полилинию «трубопровод»: пристыковать последний сегмент
   * к вершине (узел/вершина ребра), перенести черновик в segments и сбросить.
   */
  finishPipeline: (dock: DrawVertex) => void;

  /**
   * Переместить все вершины, отрисованные под данным vis-узлом, в новую
   * мировую точку (правило 1: перетаскивание вершин).
   */
  moveVertex: (visNodeId: string, x: number, y: number) => void;

  /**
   * Заменить конец ребра (по vis-id вершины) новым определением вершины —
   * например, после перетаскивания свободной точки в область соединения куста
   * она становится стыком к границей куста (или наоборот — освобождается).
   */
  replaceVertex: (visNodeId: string, next: DrawVertex) => void;

  /** Текущее выделение на карте (множество: объекты / рёбра / тройники / врезки) */
  selections: MapSelection[];
  /** Установить выделение (пустой массив — снять) */
  setSelections: (selections: MapSelection[]) => void;
  /** Добавить/убрать элемент в выделении (Shift+клик) */
  toggleSelection: (selection: MapSelection) => void;
  /** Есть ли элемент в текущем выделении */
  isSelected: (selection: MapSelection) => boolean;
  /** Удалить все выделенные элементы (и зависимые от них) */
  removeSelection: () => void;
  /**
   * Добавить в выделение все элементы, попавшие в произвольный мировой полигон
   * (лассо выделения формы). Возвращает число добавленных.
   */
  selectInWorldPolygon: (poly: ReadonlyArray<{ x: number; y: number }>) => number;

  /** Можно ли отменить последнее действие (undo) */
  canUndo: boolean;
  /** Можно ли повторить отменённое действие (redo) */
  canRedo: boolean;
  /** Отменить последнее действие проектирования */
  undo: () => void;
  /** Повторить отменённое действие */
  redo: () => void;
  /**
   * Начать действие с несколькими обновлениями (drag/resize): один снимок
   * истории на всё действие. Вызывается на pointerdown.
   */
  beginAction: () => void;

  /** Выгрузить спроектированный граф в GeoJSON (lng/lat) для API/экспорта. */
  exportGeoJSON: () => GraphGeoJSON;
};

/** Выделенный элемент подсистемы проектирования. */
export type MapSelection =
  | { kind: 'vertex'; id: string }
  | { kind: 'segment'; id: string }
  | { kind: 'fitting'; id: string }
  | { kind: 'tap'; id: string }
  /** Свободная вершина ребра (vis-узел drawv-*) — её тоже можно переносить */
  | { kind: 'edgeVertex'; id: string };

/** Спроектированный трубопровод (единица группы «Трубопроводы» в дереве). */
export type PipelineRecord = {
  id: string;
  label: string;
  /** Кол-во сегментов в трубопроводе (1 — одиночный сегмент) */
  segmentCount: number;
};

/** Вершины совпадают (одна и та же точка) — сегмент-петля запрещён. */
function sameVertex(a: DrawVertex, b: DrawVertex): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
}

const EMPTY_DRAFT: PipelineDraft = { start: null, last: null, segments: [] };

/** Снимок состояния графа для undo/redo. */
type GraphSnapshot = {
  segments: DrawnSegment[];
  pipelines: PipelineRecord[];
  vertices: MapVertex[];
  fittings: MapFitting[];
  taps: MapTap[];
};

/** Максимальная глубина истории (кол-во шагов). */
const HISTORY_LIMIT = 50;

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

const MapDrawingContext = createContext<MapDrawingState | null>(null);

export function MapDrawingProvider({ children }: { children: ReactNode }) {
  const [tool, setToolState] = useState<DrawTool>('none');
  const [segments, setSegments] = useState<DrawnSegment[]>([]);
  const [draft, setDraft] = useState<PipelineDraft>(EMPTY_DRAFT);
  const [pipelines, setPipelines] = useState<PipelineRecord[]>([]);
  const [vertices, setVertices] = useState<MapVertex[]>([]);
  const [fittings, setFittings] = useState<MapFitting[]>([]);
  const [taps, setTaps] = useState<MapTap[]>([]);
  const [selections, setSelections] = useState<MapSelection[]>([]);
  const [fluid, setFluid] = useState<DrainFluid>('oil');
  // История действий проектирования (undo/redo)
  const historyRef = useRef<GraphSnapshot[]>([]);
  const futureRef = useRef<GraphSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pipelineSeqRef = useRef(0);
  const teeSeqRef = useRef(0);
  const tapSeqRef = useRef(0);
  // Счётчики авто-имён по типам вершин
  const vertexSeqRef = useRef<Record<VertexKind, number>>({
    wellpad: 0,
    facility: 0,
    'delivery-point': 0,
  });

  // Актуальные значения для обработчиков (без пере-создания колбэков)
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const fluidRef = useRef(fluid);
  fluidRef.current = fluid;
  const verticesRef = useRef(vertices);
  verticesRef.current = vertices;
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;
  const pipelinesRef = useRef(pipelines);
  pipelinesRef.current = pipelines;

  /** Снимок текущего состояния графа. */
  const snapshotNow = useCallback((): GraphSnapshot => ({
    segments: segmentsRef.current,
    pipelines: pipelinesRef.current,
    vertices: verticesRef.current,
    fittings: fittingsRef.current,
    taps: tapsRef.current,
  }), []);

  /** Применить снимок (восстановление состояния графа). */
  const applySnapshot = useCallback((snap: GraphSnapshot) => {
    setSegments(snap.segments);
    setPipelines(snap.pipelines);
    setVertices(snap.vertices);
    setFittings(snap.fittings);
    setTaps(snap.taps);
    setDraft(EMPTY_DRAFT);
    setSelections([]);
  }, []);

  /**
   * Сохранить текущее состояние в историю ПЕРЕД действием (одно действие = один шаг).
   * Вызывается в начале мутирующих операций.
   */
  const pushHistory = useCallback(() => {
    const hist = historyRef.current;
    hist.push(snapshotNow());
    if (hist.length > HISTORY_LIMIT) hist.shift();
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [snapshotNow]);

  const undo = useCallback(() => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const snap = hist.pop() as GraphSnapshot;
    futureRef.current.push(snapshotNow());
    applySnapshot(snap);
    setCanUndo(hist.length > 0);
    setCanRedo(true);
  }, [applySnapshot, snapshotNow]);

  const redo = useCallback(() => {
    const fut = futureRef.current;
    if (fut.length === 0) return;
    const snap = fut.pop() as GraphSnapshot;
    historyRef.current.push(snapshotNow());
    applySnapshot(snap);
    setCanUndo(true);
    setCanRedo(fut.length > 0);
  }, [applySnapshot, snapshotNow]);

  /** Начать многошаговое действие (drag/resize) — один снимок истории. */
  const beginAction = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  /** Выгрузка графа в GeoJSON (lng/lat) для API/экспорта. */
  const exportGeoJSON = useCallback(
    () =>
      graphToGeoJSON({
        vertices: verticesRef.current,
        fittings: fittingsRef.current,
        taps: tapsRef.current,
        segments: segmentsRef.current,
      }),
    [],
  );
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const fittingsRef = useRef(fittings);
  fittingsRef.current = fittings;
  const tapsRef = useRef(taps);
  tapsRef.current = taps;

  /** Добавить трубопровод в список группы дерева (правило 3). */
  const registerPipeline = useCallback((id: string, segmentCount: number) => {
    setPipelines((cur) => {
      if (cur.some((p) => p.id === id)) return cur;
      return [...cur, { id, label: `Трубопровод ${cur.length + 1}`, segmentCount }];
    });
  }, []);

  /**
   * Зафиксировать уже построенные сегменты черновика (при завершении/выходе из
   * режима «трубопровод»): переносит их в segments и регистрирует трубопровод.
   */
  const commitDraft = useCallback(() => {
    const prev = draftRef.current;
    if (prev.segments.length > 0) {
      const pipelineId =
        prev.segments[0].pipelineId ?? `pipe-${(pipelineSeqRef.current += 1)}`;
      setSegments((cur) => [...cur, ...prev.segments]);
      registerPipeline(pipelineId, prev.segments.length);
    }
    setDraft(EMPTY_DRAFT);
  }, [registerPipeline]);

  const setTool = useCallback(
    (next: DrawTool) => {
      // Выход из режима: уже построенные сегменты полилинии СОХРАНЯЮТСЯ
      // (и клик по той же кнопке, и смена инструмента).
      commitDraft();
      setToolState(next);
    },
    [commitDraft],
  );

  /** Добавить тройник (серую вершину) в точке карты. */
  const addTee = useCallback((x: number, y: number) => {
    pushHistory();
    teeSeqRef.current += 1;
    const geo = graphPointToLngLat(x, y);
    const fitting: MapFitting = {
      id: nextId('tee'),
      label: `Тройник ${teeSeqRef.current}`,
      x,
      y,
      lng: geo.lng,
      lat: geo.lat,
    };
    setFittings((cur) => [...cur, fitting]);
  }, [pushHistory]);

  /**
   * Добавить врезку на ребро. Привязка: edgeId + t (позиция вдоль ребра 0..1);
   * x/y — уже спроецированная на ребро точка (пересчитывается при движении ребра).
   */
  const addTap = useCallback((edgeId: string, x: number, y: number, t: number) => {
    pushHistory();
    tapSeqRef.current += 1;
    const geoTap = graphPointToLngLat(x, y);
    const tap: MapTap = {
      id: nextId('tap'),
      label: `Врезка ${tapSeqRef.current}`,
      x,
      y,
      lng: geoTap.lng,
      lat: geoTap.lat,
      edgeId,
      t,
    };
    setTaps((cur) => [...cur, tap]);
  }, [pushHistory]);

  /** Проецировать вершины рёбер, привязанные к врезке, в её новую точку. */
  const projectTapBoundVertices = useCallback((tapId: string, x: number, y: number) => {
    const move = (v: DrawVertex): DrawVertex =>
      v.type === 'tap' && v.tapId === tapId ? { ...v, x, y } : v;
    setSegments((cur) =>
      cur.map((s) => ({ ...s, from: move(s.from), to: move(s.to) })),
    );
    setDraft((cur) => ({
      ...cur,
      start: cur.start ? move(cur.start) : cur.start,
      last: cur.last ? move(cur.last) : cur.last,
      segments: cur.segments.map((s) => ({ ...s, from: move(s.from), to: move(s.to) })),
    }));
  }, []);

  /**
   * Переместить врезку вдоль её ребра: задать t ∈ [0..1] и пересчитать x/y
   * по текущим концам ребра (резолвер концов даёт вызывающая сторона).
   */
  const setTapT = useCallback(
    (id: string, t: number, ends: EdgeEnds) => {
      const tt = Math.max(0, Math.min(1, t));
      const nx = ends.from.x + (ends.to.x - ends.from.x) * tt;
      const ny = ends.from.y + (ends.to.y - ends.from.y) * tt;
      const geo = graphPointToLngLat(nx, ny);
      setTaps((cur) =>
        cur.map((tap) =>
          tap.id === id
            ? { ...tap, t: tt, x: nx, y: ny, lng: geo.lng, lat: geo.lat }
            : tap,
        ),
      );
      // Рёбра, подключённые к врезке, следуют за ней
      projectTapBoundVertices(id, nx, ny);
    },
    [projectTapBoundVertices],
  );

  /** Пересчитать мировые координаты врезок (при перемещении концов их рёбер). */
  const reprojectTaps = useCallback(
    (resolve: (edgeId: string, t: number) => { x: number; y: number } | null) => {
      // Вычисляем новые позиции СНАРУЖИ updater'а (нельзя вызывать setState внутри
      // updater — это ломает рендер/приводит к циклам обновлений).
      const cur = tapsRef.current;
      const next: typeof cur = [];
      let changed = false;
      for (const tap of cur) {
        const p = resolve(tap.edgeId, tap.t);
        if (!p || (p.x === tap.x && p.y === tap.y)) {
          next.push(tap);
          continue;
        }
        changed = true;
        // Рёбра, подключённые к врезке, следуют за ней
        projectTapBoundVertices(tap.id, p.x, p.y);
        const g = graphPointToLngLat(p.x, p.y);
        next.push({ ...tap, x: p.x, y: p.y, lng: g.lng, lat: g.lat });
      }
      if (changed) setTaps(next);
    },
    [projectTapBoundVertices],
  );

  /** Добавить вершину-объект в точке клика (авто-имя с нумерацией). */
  const addVertex = useCallback((kind: VertexKind, x: number, y: number) => {
    pushHistory();
    vertexSeqRef.current[kind] += 1;
    const n = vertexSeqRef.current[kind];
    const geoVertex = graphPointToLngLat(x, y);
    const vertex: MapVertex = {
      id: nextId(kind),
      kind,
      label: `${VERTEX_LABEL[kind]} ${n}`,
      x,
      y,
      lng: geoVertex.lng,
      lat: geoVertex.lat,
      ...(isBoxVertex(kind) ? { ...DEFAULT_VERTEX_SIZE[kind] } : {}),
    };
    setVertices((cur) => [...cur, vertex]);
  }, [pushHistory]);

  /**
   * Изменить куст (позиция/размер) и пересчитать все привязанные к его
   * границе вершины рёбер (тип 'box') в новом положении.
   */
  const commitBox = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number }) => {
      const geo = graphPointToLngLat(box.x, box.y);
      setVertices((cur) =>
        cur.map((v) => (v.id === id ? { ...v, ...box, lng: geo.lng, lat: geo.lat } : v)),
      );
      const project = (v: DrawVertex): DrawVertex => {
        if (v.type !== 'box' || v.boxId !== id) return v;
        return { ...v, x: box.x + v.lx * box.w, y: box.y + v.ly * box.h };
      };
      setSegments((cur) =>
        cur.map((s) => ({ ...s, from: project(s.from), to: project(s.to) })),
      );
      setDraft((cur) => ({
        ...cur,
        start: cur.start ? project(cur.start) : cur.start,
        last: cur.last ? project(cur.last) : cur.last,
        segments: cur.segments.map((s) => ({ ...s, from: project(s.from), to: project(s.to) })),
      }));
    },
    [],
  );

  /** Переместить вершину-объект (перетаскивание за тело). */
  const setVertexPosition = useCallback(
    (id: string, x: number, y: number) => {
      const v = verticesRef.current.find((it) => it.id === id);
      commitBox(id, { x, y, w: v?.w ?? 0, h: v?.h ?? 0 });
    },
    [commitBox],
  );

  /** Изменить размеры прямоугольной вершины (ресайз за сторону). */
  const setVertexSize = useCallback(
    (id: string, w: number, h: number) => {
      const v = verticesRef.current.find((it) => it.id === id);
      commitBox(id, { x: v?.x ?? 0, y: v?.y ?? 0, w, h });
    },
    [commitBox],
  );

  /** Изменить позицию и размеры куста за один шаг (ресайз за угол). */
  const setVertexBox = useCallback(
    (id: string, box: { x: number; y: number; w: number; h: number }) => {
      commitBox(id, box);
    },
    [commitBox],
  );

  /**
   * Выход из режима создания (ПКМ). Уже построенные сегменты полилинии
   * СОХРАНЯЮТСЯ (обрывается только создание следующего сегмента).
   */
  const cancelDrawing = useCallback(() => {
    commitDraft();
    setToolState('none');
  }, [commitDraft]);

  const finishPipeline = useCallback(
    (dock: DrawVertex) => {
      const prev = draftRef.current;
      const last = prev.last;
      const selfLoop = last ? sameVertex(last, dock) : false;
      // Правило 2: петлю не создаём, НО клик по последней вершине трактуем как
      // завершение полилинии — уже построенные сегменты СОХРАНЯЕМ.
      if (prev.start && prev.segments.length > 0) {
        const pipelineId =
          prev.segments[0].pipelineId ?? `pipe-${(pipelineSeqRef.current += 1)}`;
        const all: DrawnSegment[] =
          selfLoop || !last
            ? prev.segments
            : [
                ...prev.segments,
                {
                  id: nextId('seg'),
                  from: last,
                  to: dock,
                  pipelineId,
                  fluid: fluidRef.current,
                },
              ];
        setSegments((cur) => [...cur, ...all]);
        // Правило 3: полилиния становится одной записью в группе «Трубопроводы»
        registerPipeline(pipelineId, all.length);
      }
      setDraft(EMPTY_DRAFT);
    },
    [registerPipeline],
  );

  /** Перетаскивание вершины: обновляем координаты всех концов с этим vis-id. */
  const moveVertex = useCallback(
    (visNodeId: string, x: number, y: number) => {
      // Кус том (прямоугольник): перемещаем через commitBox, чтобы
      // привязанные к его границе вершины рёбер пересчитались.
      const vertex = verticesRef.current.find((v) => v.id === visNodeId);
      if (vertex && isBoxVertex(vertex.kind)) {
        commitBox(visNodeId, { x, y, w: vertex.w ?? 0, h: vertex.h ?? 0 });
        return;
      }
      // Тройник (vis-узел 'tee-<id>'): перемещаем сам тройник; присоединённые
      // концы рёбер следуют за ним (отсоединяются вручную — перетаскиванием
      // самой вершины ребра, см. ветку drawv-* в dragEnd/resolveDropVertex).
      if (visNodeId.startsWith('tee-')) {
        const fittingId = visNodeId.slice('tee-'.length);
        const geo = graphPointToLngLat(x, y);
        setFittings((cur) =>
          cur.map((f) => (f.id === fittingId ? { ...f, x, y, lng: geo.lng, lat: geo.lat } : f)),
        );
        const moveBound = (v: DrawVertex): DrawVertex =>
          v.type === 'fitting' && v.fittingId === fittingId ? { ...v, x, y } : v;
        setSegments((cur) =>
          cur.map((s) => ({ ...s, from: moveBound(s.from), to: moveBound(s.to) })),
        );
        setDraft((cur) => ({
          ...cur,
          start: cur.start ? moveBound(cur.start) : cur.start,
          last: cur.last ? moveBound(cur.last) : cur.last,
          segments: cur.segments.map((s) => ({ ...s, from: moveBound(s.from), to: moveBound(s.to) })),
        }));
        return;
      }
      const move = (v: DrawVertex): DrawVertex =>
        drawVertexNodeId(v) === visNodeId ? { ...v, x, y } : v;
      setSegments((cur) =>
        cur.map((s) => ({ ...s, from: move(s.from), to: move(s.to) })),
      );
      setDraft((cur) => ({
        ...cur,
        start: cur.start ? move(cur.start) : cur.start,
        last: cur.last ? move(cur.last) : cur.last,
        segments: cur.segments.map((s) => ({ ...s, from: move(s.from), to: move(s.to) })),
      }));
      // Точечные вершины-объекты перетаскиваются по своему id
      setVertices((cur) => cur.map((v) => (v.id === visNodeId ? { ...v, x, y } : v)));
    },
    [commitBox],
  );

  /** Заменить конец ребра новым определением вершины (перепривязка при drop). */
  const replaceVertex = useCallback((visNodeId: string, next: DrawVertex) => {
    const swap = (v: DrawVertex): DrawVertex =>
      drawVertexNodeId(v) === visNodeId ? { ...next, vid: v.vid } : v;
    setSegments((cur) =>
      cur.map((s) => ({ ...s, from: swap(s.from), to: swap(s.to) })),
    );
    setDraft((cur) => ({
      ...cur,
      start: cur.start ? swap(cur.start) : cur.start,
      last: cur.last ? swap(cur.last) : cur.last,
      segments: cur.segments.map((s) => ({ ...s, from: swap(s.from), to: swap(s.to) })),
    }));
  }, []);

  /** Отсоединить от сегментов все концы с заданным условием (→ свободная точка). */
  const detachSegments = useCallback((shouldDetach: (v: DrawVertex) => boolean) => {
    const free = (v: DrawVertex): DrawVertex =>
      shouldDetach(v) ? { type: 'free', vid: v.vid, x: v.x, y: v.y } : v;
    setSegments((cur) =>
      cur.map((s) => ({ ...s, from: free(s.from), to: free(s.to) })),
    );
  }, []);

  /** Удалить все выделенные элементы и связанные с ними данные. */
  const removeSelection = useCallback(() => {
    const sel = selectionsRef.current;
    if (sel.length === 0) return;
    pushHistory();
    const vertexIds = new Set(sel.filter((s) => s.kind === 'vertex').map((s) => s.id));
    const segmentIds = new Set(sel.filter((s) => s.kind === 'segment').map((s) => s.id));
    const fittingIds = new Set(sel.filter((s) => s.kind === 'fitting').map((s) => s.id));
    const tapIds = new Set(sel.filter((s) => s.kind === 'tap').map((s) => s.id));
    const edgeVertexIds = new Set(
      sel.filter((s) => s.kind === 'edgeVertex').map((s) => s.id),
    );

    if (vertexIds.size > 0) {
      setVertices((cur) => cur.filter((v) => !vertexIds.has(v.id)));
    }
    if (fittingIds.size > 0) {
      setFittings((cur) => cur.filter((f) => !fittingIds.has(f.id)));
    }
    if (tapIds.size > 0) {
      setTaps((cur) => cur.filter((t) => !tapIds.has(t.id)));
    }
    // Врезки, лежащие на удаляемых рёбрах, тоже удаляем.
    if (segmentIds.size > 0) {
      setTaps((cur) => cur.filter((t) => !segmentIds.has(t.edgeId)));
      setSegments((cur) => cur.filter((s) => !segmentIds.has(s.id)));
    }
    // Удаляемые вершины рёбер: убираем инцидентные им сегменты.
    if (edgeVertexIds.size > 0) {
      setSegments((cur) =>
        cur.filter(
          (s) =>
            !edgeVertexIds.has(drawVertexNodeId(s.from)) &&
            !edgeVertexIds.has(drawVertexNodeId(s.to)),
        ),
      );
    }
    // Концы рёбер, привязанные к удалённым сущностям, отвязываем.
    if (vertexIds.size || fittingIds.size || tapIds.size) {
      detachSegments(
        (v) =>
          (v.type === 'box' && vertexIds.has(v.boxId)) ||
          (v.type === 'fitting' && fittingIds.has(v.fittingId)) ||
          (v.type === 'tap' && tapIds.has(v.tapId)),
      );
    }
    setSelections([]);
  }, [detachSegments, pushHistory]);

  /** Ключ элемента для сравнения в выделении. */
  const selKey = (s: MapSelection) => `${s.kind}:${s.id}`;

  /** Добавить/убрать элемент в наборе выделенных (Shift+клик). */
  const toggleSelection = useCallback((item: MapSelection) => {
    setSelections((cur) => {
      const key = `${item.kind}:${item.id}`;
      const exists = cur.some((s) => `${s.kind}:${s.id}` === key);
      return exists ? cur.filter((s) => `${s.kind}:${s.id}` !== key) : [...cur, item];
    });
  }, []);

  /** Есть ли элемент в текущем выделении. */
  const isSelected = useCallback(
    (item: MapSelection) => selectionsRef.current.some((s) => selKey(s) === selKey(item)),
    [],
  );

  /** Добавить в выделение всё, что попалo в произвольный полигон (лассо). */
  const selectInWorldPolygon = useCallback(
    (poly: ReadonlyArray<{ x: number; y: number }>) => {
      const inside = (x: number, y: number) => pointInPolygon({ x, y }, poly);
      const found: MapSelection[] = [];
      for (const v of verticesRef.current) {
        if (inside(v.x, v.y)) found.push({ kind: 'vertex', id: v.id });
      }
      for (const f of fittingsRef.current) {
        if (inside(f.x, f.y)) found.push({ kind: 'fitting', id: f.id });
      }
      for (const t of tapsRef.current) {
        if (inside(t.x, t.y)) found.push({ kind: 'tap', id: t.id });
      }
      for (const s of segmentsRef.current) {
        // ребро — если хотя бы один конец внутри лассо
        if (inside(s.from.x, s.from.y) || inside(s.to.x, s.to.y)) {
          found.push({ kind: 'segment', id: s.id });
        }
        // Свободные/связанные вершины рёбер — тоже выделяются лассо
        for (const v of [s.from, s.to]) {
          if (inside(v.x, v.y)) {
            found.push({ kind: 'edgeVertex', id: drawVertexNodeId(v) });
          }
        }
      }
      if (found.length === 0) return 0;
      setSelections((cur) => {
        const seen = new Set(cur.map((s) => `${s.kind}:${s.id}`));
        const next = [...cur];
        for (const item of found) {
          const key = `${item.kind}:${item.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            next.push(item);
          }
        }
        return next;
      });
      return found.length;
    },
    [],
  );

  const placePoint = useCallback(
    (vertex: DrawVertex) => {
      if (tool === 'segment') {
        // Одиночный сегмент: первая точка — начало, вторая — конец.
        const prev = draftRef.current;
        if (!prev.start) {
          pushHistory(); // начало действия — один шаг undo на весь сегмент
          setDraft({ start: vertex, last: null, segments: [] });
          return;
        }
        // Правило 2: петля из одной точки запрещена — клик игнорируем,
        // начало остаётся, пользователь выбирает другую точку.
        if (sameVertex(prev.start, vertex)) return;
        const segment: DrawnSegment = {
          id: nextId('seg'),
          from: prev.start,
          to: vertex,
          pipelineId: null,
          fluid: fluidRef.current,
        };
        setSegments((all) => [...all, segment]);
        // Правило 3: одиночный сегмент — тоже запись в «Трубопроводах».
        registerPipeline(`pipe-${(pipelineSeqRef.current += 1)}`, 1);
        setDraft(EMPTY_DRAFT);
        return;
      }
      if (tool === 'pipeline') {
        // Полилиния: каждая следующая точка продолжает цепочку.
        const prev = draftRef.current;
        if (!prev.start) {
          pushHistory(); // начало полилинии — один шаг undo на всю полилинию
          setDraft({ start: vertex, last: vertex, segments: [] });
          return;
        }
        const last = prev.last ?? prev.start;
        // Правило 2: сегмент не может замыкаться на ту же вершину.
        if (sameVertex(last, vertex)) return;
        const pipelineId =
          prev.segments[0]?.pipelineId ?? `pipe-${(pipelineSeqRef.current += 1)}`;
        const segment: DrawnSegment = {
          id: nextId('seg'),
          from: last,
          to: vertex,
          pipelineId,
          fluid: fluidRef.current,
        };
        setDraft({
          start: prev.start,
          last: vertex,
          segments: [...prev.segments, segment],
        });
      }
    },
    [tool, registerPipeline, pushHistory],
  );

  const value = useMemo<MapDrawingState>(
    () => ({
      tool,
      setTool,
      cancelDrawing,
      segments,
      draft,
      pipelines,
      vertices,
      addVertex,
      fittings,
      addTee,
      taps,
      addTap,
      setTapT,
      reprojectTaps,
      setVertexPosition,
      setVertexSize,
      setVertexBox,
      fluid,
      setFluid,
      placePoint,
      finishPipeline,
      moveVertex,
      replaceVertex,
      selections,
      setSelections,
      toggleSelection,
      isSelected,
      removeSelection,
      selectInWorldPolygon,
      canUndo,
      canRedo,
      undo,
      redo,
      beginAction,
      exportGeoJSON,
    }),
    [
      tool,
      setTool,
      cancelDrawing,
      segments,
      draft,
      pipelines,
      vertices,
      addVertex,
      fittings,
      addTee,
      taps,
      addTap,
      setTapT,
      reprojectTaps,
      setVertexPosition,
      setVertexSize,
      setVertexBox,
      fluid,
      placePoint,
      finishPipeline,
      moveVertex,
      replaceVertex,
      selections,
      toggleSelection,
      isSelected,
      removeSelection,
      selectInWorldPolygon,
      canUndo,
      canRedo,
      undo,
      redo,
      beginAction,
      exportGeoJSON,
    ],
  );

  return <MapDrawingContext.Provider value={value}>{children}</MapDrawingContext.Provider>;
}

/** Доступ к состоянию рисования. */
/* eslint-disable-next-line react-refresh/only-export-components -- контекст и хук логически одно целое */
export function useMapDrawing(): MapDrawingState {
  const ctx = useContext(MapDrawingContext);
  if (ctx === null) {
    throw new Error('useMapDrawing должен вызываться внутри <MapDrawingProvider>');
  }
  return ctx;
}
