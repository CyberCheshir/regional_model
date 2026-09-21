import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { graphPointToLngLat, lngLatToGraphPoint } from './geo';
import { healRemovedTaps } from './healSplits';
import {
  HISTORY_LIMIT,
  bindEndByNode,
  nextId,
  nodeIdFromVid,
  nodeToDrawVertex,
  sameVertex,
  type GraphSnapshot,
  type PipelineRecord,
  type ProjectSnapshotInput,
} from './mapDrawingHelpers';

// Ре-экспорт для существующих потребителей (сохранённый публичный API модуля).
export type { PipelineRecord, ProjectSnapshotInput };
import { splitSegmentByTap } from './splitSegmentByTap';
import { graphToGeoJSON, type GraphGeoJSON } from './graphExport';
import { buildSavePayload, type MapSavePayload } from '../../api/mapSave';
import {
  DEFAULT_VERTEX_SIZE,
  EMPTY_DRAFT,
  MIN_AREA_POINTS,
  toDrainFluid,
  toPipelineClass,
  type EdgeEnds,
  drawVertexNodeId,
  pointInPolygon,
  isBoxVertex,
  VERTEX_LABEL,
  type DrawTool,
  type DrawVertex,
  type DrawnSegment,
  type DrainFluid,
  type PipelineClass,
  type LicenceArea,
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
  /** Добавить врезку на ребро (edgeId) в точке (x, y) */
  addTap: (edgeId: string, x: number, y: number) => void;
  /**
   * Переместить врезку вдоль её ребра (t ∈ [0..1]). Привязанные к врезке
   * вершины рёбер следуют за ней (в т.ч. при перетаскивании вдоль ребра).
   */
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
  /** Класс трубопровода для новых сегментов (по умолчанию — промысловый) */
  pipelineClass: PipelineClass;
  setPipelineClass: (pipelineClass: PipelineClass) => void;

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
   * Переместить КОНКРЕТНЫЙ конец сегмента (сторона from/to) в новую мировую
   * точку. В отличие от moveVertex, работает точечно по сегменту — нужно для
   * стыков, у которых несколько концов делят один vid (врезка/тройник).
   */
  setSegmentEnd: (segId: string, side: 'from' | 'to', x: number, y: number) => void;

  /** Переместить ГРУПУ концов (слипшийся стык) в одну мировую точку. */
  setSegmentEnds: (
    ends: ReadonlyArray<{ segId: string; side: 'from' | 'to' }>,
    x: number,
    y: number,
  ) => void;

  /** Заменить ГРУПУ концов одним определением вершины (перепривязка/отсоединение). */
  replaceSegmentEnds: (
    ends: ReadonlyArray<{ segId: string; side: 'from' | 'to' }>,
    next: DrawVertex,
  ) => void;

  /**
   * Заменить КОНКРЕТНЫЙ конец сегмента новым определением вершины (при отпускании
   * перетаскиваемого конца): перепривязка к цели снапа или отсоединение (free).
   * Сохраняет vid исходного конца.
   */
  replaceSegmentEnd: (
    segId: string,
    side: 'from' | 'to',
    next: DrawVertex,
  ) => void;

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

  /** Спроектированные лицензионные участки (замкнутые полигоны) */
  areas: LicenceArea[];
  /** Черновик полигона участка: уже поставленные вершины (пустой — нет черновика) */
  areaDraft: { x: number; y: number }[];
  /**
   * Добавить вершину к черновику полигона участка. Возвращает true, если точка
   * является первой вершиной (можно использовать для подсказок UI).
   */
  addAreaPoint: (x: number, y: number) => void;
  /**
   * Замкнуть полигон участка: если вершин >= MIN_AREA_POINTS — создаётся участок
   * с авто-именем, черновик сбрасывается.
   */
  closeArea: () => void;
  /** Сбросить черновик полигона участка (без создания). */
  cancelAreaDraft: () => void;

  /**
   * Объединить выбранные сегменты в один трубопровод (общий pipelineId,
   * одна запись в дереве). Возвращает id нового трубопровода или null.
   */
  mergeSegments: (segmentIds: readonly string[]) => string | null;

  /** Переместить вершину полигона участка (индекс) в мировую точку. */
  moveAreaPoint: (areaId: string, pointIndex: number, x: number, y: number) => void;
  /** Переместить участок целиком на дельту (dx, dy) в мировых единицах. */
  moveArea: (areaId: string, dx: number, dy: number) => void;
  /**
   * ПРОПОРЦИОНАЛЬНО масштабировать участок относительно точки-якоря.
   * @param areaId id участка
   * @param scale  множитель (1 = без изменений); применяется по обеим осям
   * @param anchorX,anchorY неподвижная точка в мировых координатах (обычно —
   *        противоположный углу ресайза угол bbox)
   */
  scaleArea: (
    areaId: string,
    scale: number,
    anchorX: number,
    anchorY: number,
  ) => void;
  /**
   * ПОВЕРНУТЬ участок вокруг точки (ox, oy) на угол deltaRad (радианы).
   * Абсолютный поворот из исходного снимка — читайте angle от начала жеста.
   */
  rotateArea: (
    areaId: string,
    deltaRad: number,
    ox: number,
    oy: number,
  ) => void;
  /**
   * Создать участок из импортированного полигона (lng/lat).
   * @param polygon минимум 3 точки в WGS-84
   * @param name    имя участка (по умолчанию — авто)
   */
  addImportedArea: (polygon: Array<{ lng: number; lat: number }>, name?: string) => void;

  /**
   * Создать СРАЗУ несколько участков (импорт файла): один шаг истории на всю партию.
   * @param areas массив { name, points: [{lng,lat}] } (>=3 точки каждый)
   * @returns сколько участков реально создано
   */
  addImportedAreas: (
    areas: Array<{ name: string; points: Array<{ lng: number; lat: number }> }>,
  ) => number;

  /**
   * Переименовать вершину-объект (куст/УПН/точку поставки).
   * Пустое/пробельное имя игнорируется. Один шаг истории.
   */
  renameVertex: (id: string, label: string) => void;
  /** Переименовать трубопровод (запись в дереве). */
  renamePipeline: (id: string, label: string) => void;
  /** Переименовать тройник. */
  renameFitting: (id: string, label: string) => void;
  /** Переименовать врезку. */
  renameTap: (id: string, label: string) => void;
  /** Переименовать лицензионный участок. */
  renameArea: (id: string, label: string) => void;
  /** Переименовать сегмент трубопровода. */
  renameSegment: (id: string, label: string) => void;

  /**
   * Заменить текущую модель снимком, загруженным из БД (сценарий).
   * Принимает упрощённое представление (объекты/узлы/сегменты/трубопроводы/участки),
   * восстанавливает координаты графа из lng/lat и наполняет domain layer.
   */
  loadSnapshot: (snapshot: ProjectSnapshotInput) => void;

  /** Выгрузить спроектированный граф в GeoJSON (lng/lat) для API/экспорта. */
  exportGeoJSON: () => GraphGeoJSON;

  /**
   * Экспорт ВСЕЙ модели в формате снимка проекта (JSON): объекты, узлы,
   * сегменты, трубопроводы, лицензионные участки. Совместим с loadSnapshot().
   */
  exportModel: () => MapSavePayload;
};

/** Выделенный элемент подсистемы проектирования. */
export type MapSelection =
  | { kind: 'vertex'; id: string }
  | { kind: 'segment'; id: string }
  | { kind: 'fitting'; id: string }
  | { kind: 'tap'; id: string }
  /** Свободная вершина ребра (vis-узел drawv-*) — её тоже можно переносить */
  | { kind: 'edgeVertex'; id: string }
  /** Лицензионный участок (замкнутый полигон) */
  | { kind: 'area'; id: string };

const MapDrawingContext = createContext<MapDrawingState | null>(null);

export function MapDrawingProvider({ children }: { children: ReactNode }) {
  const [tool, setToolState] = useState<DrawTool>('none');
  const [segments, setSegments] = useState<DrawnSegment[]>([]);
  const [draft, setDraft] = useState<PipelineDraft>(EMPTY_DRAFT);
  const [pipelines, setPipelines] = useState<PipelineRecord[]>([]);
  const [vertices, setVertices] = useState<MapVertex[]>([]);
  const [fittings, setFittings] = useState<MapFitting[]>([]);
  const [taps, setTaps] = useState<MapTap[]>([]);
  const [areas, setAreas] = useState<LicenceArea[]>([]);
  const [areaDraft, setAreaDraft] = useState<{ x: number; y: number }[]>([]);
  const [selections, setSelections] = useState<MapSelection[]>([]);
  const [fluid, setFluid] = useState<DrainFluid>('oil');
  const [pipelineClass, setPipelineClass] = useState<PipelineClass>('field');
  // История действий проектирования (undo/redo)
  const historyRef = useRef<GraphSnapshot[]>([]);
  const futureRef = useRef<GraphSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const pipelineSeqRef = useRef(0);
  const teeSeqRef = useRef(0);
  const tapSeqRef = useRef(0);
  // Счётчик для уникальных vid концов, создаваемых при разрезании врезкой.
  const segmentSeqRef = useRef(0);
  const splitSegmentByTapRef = useRef(splitSegmentByTap);
  splitSegmentByTapRef.current = splitSegmentByTap;
  const areaSeqRef = useRef(0);
  // Счётчик авто-имён СЕГМЕНТОВ («Сегмент 1», «Сегмент 2», …).
  // Имя закрепляется за сегментом ПРИ СОЗДАНИИ и потом не меняется сам (только
  // пользователем) — объединение/разбиение в трубопровод имя не перезаписывает.
  const segmentNameSeqRef = useRef(0);
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
  const pipelineClassRef = useRef(pipelineClass);
  pipelineClassRef.current = pipelineClass;
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

  /**
   * Экспорт ВСЕЙ модели в формате снимка проекта (JSON). Переиспользует тот же
   * преобразователь, что и сохранение в БД (buildSavePayload), поэтому экспорт
   * и импорт полностью совместимы с loadSnapshot().
   */
  const exportModel = useCallback(
    (): MapSavePayload =>
      buildSavePayload({
        vertices: verticesRef.current,
        segments: segmentsRef.current,
        pipelines: pipelinesRef.current,
        areas: areasRef.current,
        taps: tapsRef.current,
      }),
    [],
  );
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const fittingsRef = useRef(fittings);
  fittingsRef.current = fittings;
  const tapsRef = useRef(taps);
  tapsRef.current = taps;
  const areaDraftRef = useRef(areaDraft);
  areaDraftRef.current = areaDraft;
  const areasRef = useRef(areas);
  areasRef.current = areas;

  /** Добавить трубопровод в список группы дерева (правило 3). */
  const registerPipeline = useCallback((id: string) => {
    setPipelines((cur) => {
      if (cur.some((p) => p.id === id)) return cur;
      return [...cur, { id, label: `Трубопровод ${cur.length + 1}` }];
    });
  }, []);

  /**
   * Объединить выбранные сегменты в ОДИН трубопровод: всем указанным сегментам
   * присваивается общий pipelineId, в дереве появляется одна запись.
   * Старые записи трубопроводов, у которых не осталось сегментов, удаляются.
   */
  const mergeSegments = useCallback(
    (segmentIds: readonly string[]): string | null => {
      const ids = new Set(segmentIds);
      const target = segmentsRef.current.filter((s) => ids.has(s.id));
      if (target.length === 0) return null;
      pushHistory();
      const pipelineId = `pipe-${(pipelineSeqRef.current += 1)}`;
      // 1) Переназначаем pipelineId выбранным сегментам.
      setSegments((cur) =>
        cur.map((s) => (ids.has(s.id) ? { ...s, pipelineId } : s)),
      );
      // 2) Какие трубопроводы могли осиротеть (их сегменты изменились).
      const touched = new Set(
        target.map((s) => s.pipelineId).filter((p): p is string => p !== null),
      );
      // 3) Считаем, сколько сегментов осталось у каждого старого трубопровода,
      //    удаляем записи-сироты и добавляем новую запись для объединённого.
      setPipelines((cur) => {
        const others = cur.filter((p) => !touched.has(p.id));
        // Среди «осиротевших» сохраняем те, у которых есть оставшиеся сегменты.
        const remainingIds = new Set(
          segmentsRef.current
            .filter((s) => !ids.has(s.id) && s.pipelineId && touched.has(s.pipelineId))
            .map((s) => s.pipelineId as string),
        );
        const kept = cur.filter((p) => !touched.has(p.id) || remainingIds.has(p.id));
        return [
          ...others,
          ...kept.filter((p) => touched.has(p.id)),
          { id: pipelineId, label: `Трубопровод ${others.length + 1}` },
        ];
      });
      return pipelineId;
    },
    [pushHistory],
  );

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
      registerPipeline(pipelineId);
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
   * Добавить врезку на ребро в точке (x, y).
   * Врезка разрезает сегмент edgeId на два и привязывается к ЛЕВОМУ из них.
   */
  const addTap = useCallback((edgeId: string, x: number, y: number) => {
    pushHistory();
    tapSeqRef.current += 1;
    const geoTap = graphPointToLngLat(x, y);
    const tapId = nextId('tap');

    // Врезка РАЗРЕЗАЕТ сегмент на два: left (from → врезка) и right (врезка → to).
    // Врезка становится ТОЧКОЙ СОЕДИНЕНИЯ этих двух сегментов. Трубопровод при
    // этом НЕ делится — оба новых сегмента остаются в том же трубопроводе (pipelineId).
    const leftId = nextId('seg');
    const rightId = nextId('seg');
    const vidL = `tapv-${tapId}-l${(segmentSeqRef.current += 1)}`;
    const vidR = `tapv-${tapId}-r${(segmentSeqRef.current += 1)}`;

    // ВАЖНО: врезка должна ссылаться на СУЩЕСТВУЮЩИЙ сегмент. После разреза
    // исходный edgeId исчезает (заменяется left/right), поэтому привязываем
    // врезку к ЛЕВОМУ сегменту с t = 1 (конец левого = точка врезки).
    const tap: MapTap = {
      id: tapId,
      label: `Врезка ${tapSeqRef.current}`,
      x,
      y,
      lng: geoTap.lng,
      lat: geoTap.lat,
      edgeId: leftId,
      t: 1,
    };
    setTaps((cur) => [...cur, tap]);

    // Ищем сегмент И среди завершённых, И среди черновика (ребро может быть
    // ещё не закоммичено — иначе разрез молча не срабатывает).
    const inSegments = segmentsRef.current.find((s) => s.id === edgeId);
    const inDraft = draftRef.current.segments.find((s) => s.id === edgeId);

    const tapPoint = { x, y };
    if (inSegments) {
      const split = splitSegmentByTapRef.current(
        segmentsRef.current, edgeId, tapId, leftId, rightId, vidL, vidR, tapPoint,
      );
      if (split) setSegments(() => split.segments);
    } else if (inDraft) {
      const split = splitSegmentByTapRef.current(
        draftRef.current.segments, edgeId, tapId, leftId, rightId, vidL, vidR, tapPoint,
      );
      if (split) setDraft((cur) => ({ ...cur, segments: split.segments }));
    }

    // Количество сегментов НЕ храним — оно выводится из списка сегментов
    // (`pipelineId`), поэтому после разреза подпись в дереве обновится сама.
  }, [pushHistory]);

  /**
   * Проецировать вершины рёбер, привязанные к врезке, в её новую точку.
   * Используется и при перетаскивании САМОЙ врезки (вершины едут за ней),
   * и при движении ребра (врезка тянет свои вершины).
   */
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
      // Вершины рёбер, привязанные к врезке, СЛЕДУЮТ за ней (в т.ч. при её
      // перетаскивании вдоль основного ребра).
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

  /**
   * Переместить конкретный конец сегмента (from/to) в мировую точку.
   * Двигает ТОЛЬКО этот конец — важно для стыков с общим vid (врезка/тройник).
   */
  const setSegmentEnd = useCallback(
    (segId: string, side: 'from' | 'to', x: number, y: number) => {
      const move = (s: DrawnSegment): DrawnSegment => {
        if (s.id !== segId) return s;
        const end = { ...s[side], x, y };
        return { ...s, [side]: end };
      };
      setSegments((cur) => cur.map(move));
      setDraft((cur) => ({ ...cur, segments: cur.segments.map(move) }));
    },
    [],
  );

  /**
   * Заменить конкретный конец сегмента новым определением вершины (с сохранением vid).
   * Используется при отпускании перетаскиваемого конца: перепривязка или отсоединение.
   */
  const replaceSegmentEnd = useCallback(
    (segId: string, side: 'from' | 'to', next: DrawVertex) => {
      const swap = (s: DrawnSegment): DrawnSegment => {
        if (s.id !== segId) return s;
        const end: DrawVertex = { ...next, vid: s[side].vid };
        return { ...s, [side]: end };
      };
      setSegments((cur) => cur.map(swap));
      setDraft((cur) => ({ ...cur, segments: cur.segments.map(swap) }));
    },
    [],
  );

  /** Переместить ГРУПУ концов (слипшийся стык) в одну мировую точку. */
  const setSegmentEnds = useCallback(
    (ends: ReadonlyArray<{ segId: string; side: 'from' | 'to' }>, x: number, y: number) => {
      const keys = new Set(ends.map((e) => `${e.segId}:${e.side}`));
      const move = (s: DrawnSegment): DrawnSegment => {
        let out = s;
        for (const side of ['from', 'to'] as const) {
          if (keys.has(`${s.id}:${side}`)) {
            const end = { ...out[side], x, y };
            out = { ...out, [side]: end };
          }
        }
        return out;
      };
      setSegments((cur) => cur.map(move));
      setDraft((cur) => ({ ...cur, segments: cur.segments.map(move) }));
    },
    [],
  );

  /** Заменить ГРУПУ концов одним определением вершины (с сохранением vid каждого). */
  const replaceSegmentEnds = useCallback(
    (ends: ReadonlyArray<{ segId: string; side: 'from' | 'to' }>, next: DrawVertex) => {
      const keys = new Set(ends.map((e) => `${e.segId}:${e.side}`));
      const swap = (s: DrawnSegment): DrawnSegment => {
        let out = s;
        for (const side of ['from', 'to'] as const) {
          if (keys.has(`${s.id}:${side}`)) {
            const end: DrawVertex = { ...next, vid: s[side].vid };
            out = { ...out, [side]: end };
          }
        }
        return out;
      };
      setSegments((cur) => cur.map(swap));
      setDraft((cur) => ({ ...cur, segments: cur.segments.map(swap) }));
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
                  pipelineClass: pipelineClassRef.current,
                  label: `Сегмент ${(segmentNameSeqRef.current += 1)}`,
                },
              ];
        setSegments((cur) => [...cur, ...all]);
        // Правило 3: полилиния становится одной записью в группе «Трубопроводы»
        registerPipeline(pipelineId);
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

  /**
   * Сшить обратно сегменты, соединённые через УДАЛЯЕМУЮ врезку, используя
   * чистую функцию healRemovedTaps (см. healSplits.ts).
   */
  const healTapSplits = useCallback((tapIds: Set<string>) => {
    setSegments((cur) => healRemovedTaps(cur, tapIds));
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
    const areaIds = new Set(sel.filter((s) => s.kind === 'area').map((s) => s.id));

    if (vertexIds.size > 0) {
      setVertices((cur) => cur.filter((v) => !vertexIds.has(v.id)));
    }
    // Удаление лицензионных участков (полигонов).
    if (areaIds.size > 0) {
      setAreas((cur) => cur.filter((a) => !areaIds.has(a.id)));
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
    // Врезка СШИВАЕТ ребро: два сегмента, соединённые через неё, снова становятся одним.
    if (tapIds.size > 0) {
      healTapSplits(tapIds);
    }
    // Концы рёбер, привязанные к удалённым сущностям, отвязываем.
    if (vertexIds.size || fittingIds.size) {
      detachSegments(
        (v) =>
          (v.type === 'box' && vertexIds.has(v.boxId)) ||
          (v.type === 'fitting' && fittingIds.has(v.fittingId)),
      );
    }
    setSelections([]);
  }, [detachSegments, pushHistory, healTapSplits]);

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
      // Лицензионные участки — если центр полигона попал внутрь лассо.
      for (const a of areasRef.current) {
        if (a.points.length === 0) continue;
        const cx = a.points.reduce((sum, p) => sum + p.x, 0) / a.points.length;
        const cy = a.points.reduce((sum, p) => sum + p.y, 0) / a.points.length;
        if (inside(cx, cy)) found.push({ kind: 'area', id: a.id });
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
          setDraft({
            start: vertex,
            last: null,
            segments: [],
            pipelineClass: pipelineClassRef.current,
          });
          return; // первая точка сегмента зафиксирована — ждём вторую
        }
        // Правило 2: петля из одной точки запрещена — клик игнорируем,
        // начало остаётся, пользователь выбирает другую точку.
        if (sameVertex(prev.start, vertex)) return;
        // Одиночный сегмент — самостоятельный трубопровод: задаём pipelineId
        // СРАЗУ, чтобы он совпадал с id записи в дереве (фокус камеры, связи).
        const singlePipelineId = `pipe-${(pipelineSeqRef.current += 1)}`;
        const segment: DrawnSegment = {
          id: nextId('seg'),
          from: prev.start,
          to: vertex,
          pipelineId: singlePipelineId,
          fluid: fluidRef.current,
          pipelineClass: pipelineClassRef.current,
          label: `Сегмент ${(segmentNameSeqRef.current += 1)}`,
        };
        setSegments((all) => [...all, segment]);
        // Правило 3: одиночный сегмент — тоже запись в «Трубопроводах».
        registerPipeline(singlePipelineId);
        setDraft(EMPTY_DRAFT);
        return;
      }
      if (tool === 'pipeline') {
        // Полилиния: каждая следующая точка продолжает цепочку.
        const prev = draftRef.current;
        if (!prev.start) {
          pushHistory(); // начало полилинии — один шаг undo на всю полилинию
          setDraft({
            start: vertex,
            last: vertex,
            segments: [],
            pipelineClass: pipelineClassRef.current,
          });
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
          pipelineClass: pipelineClassRef.current,
          label: `Сегмент ${(segmentNameSeqRef.current += 1)}`,
        };
        setDraft({
          start: prev.start,
          last: vertex,
          segments: [...prev.segments, segment],
          pipelineClass: pipelineClassRef.current,
        });
      }
    },
    [tool, registerPipeline, pushHistory],
  );

  /** Добавить точку в черновик полигона лицензионного участка. */
  const addAreaPoint = useCallback((x: number, y: number) => {
    setAreaDraft((cur) => {
      // Первая точка — зафиксировать действие в истории (один шаг на весь участок).
      if (cur.length === 0) pushHistory();
      return [...cur, { x, y }];
    });
  }, [pushHistory]);

  /** Замкнуть полигон участка (>= MIN_AREA_POINTS вершин) и создать участок. */
  const closeArea = useCallback(() => {
    const pts = areaDraftRef.current;
    if (pts.length < MIN_AREA_POINTS) return;
    areaSeqRef.current += 1;
    const lngLat = pts.map((p) => graphPointToLngLat(p.x, p.y));
    const area: LicenceArea = {
      id: nextId('area'),
      label: `Лицензионный участок ${areaSeqRef.current}`,
      points: pts,
      lngLat,
    };
    setAreas((cur) => [...cur, area]);
    setAreaDraft([]);
  }, []);

  /** Сбросить черновик полигона участка без создания. */
  const cancelAreaDraft = useCallback(() => setAreaDraft([]), []);

  /**
   * Создать лицензионный участок из ИМПОРТИРОВАННОГО полигона (lng/lat).
   * Мировые точки вычисляются из гео-координат; имя — авто или заданное.
   */
  const addImportedArea = useCallback(
    (polygon: Array<{ lng: number; lat: number }>, name?: string) => {
      if (polygon.length < 3) return;
      pushHistory();
      areaSeqRef.current += 1;
      const points = polygon.map((p) => lngLatToGraphPoint(p.lng, p.lat));
      setAreas((cur) => [
        ...cur,
        {
          id: nextId('area'),
          label: name || `Лицензионный участок ${areaSeqRef.current}`,
          points,
          lngLat: polygon,
        },
      ]);
    },
    [pushHistory],
  );

  /**
   * Создать несколько участков одной партией (импорт файла): один шаг истории,
   * один вызов setAreas — без «дребезга» undo на каждый участок.
   */
  const addImportedAreas = useCallback(
    (incoming: Array<{ name: string; points: Array<{ lng: number; lat: number }> }>) => {
      const valid = incoming.filter((a) => a.points.length >= MIN_AREA_POINTS);
      if (valid.length === 0) return 0;
      pushHistory();
      const created: LicenceArea[] = valid.map((area) => {
        areaSeqRef.current += 1;
        return {
          id: nextId('area'),
          label: area.name || `Лицензионный участок ${areaSeqRef.current}`,
          points: area.points.map((p) => lngLatToGraphPoint(p.lng, p.lat)),
          lngLat: area.points.map((p) => ({ lng: p.lng, lat: p.lat })),
        };
      });
      setAreas((cur) => [...cur, ...created]);
      return created.length;
    },
    [pushHistory],
  );

  // --- Переименование сущностей (двойной клик по узлу дерева) ---
  // Общий шаблон: тримим имя, пустое — игнорируем, один шаг истории.
  const cleanLabel = (label: string) => label.trim();

  // ВАЖНО: pushHistory() — сайд-эффект, его НЕЛЬЗЯ вызывать внутри апдейтера
  // setState (в StrictMode апдейтер выполняется дважды). Поэтому проверяем
  // цель и изменение по актуальным ref-значениям, а историю пишем снаружи.

  /** Переименовать объект (куст/УПН/точку поставки). */
  const renameVertex = useCallback(
    (id: string, label: string) => {
      const next = cleanLabel(label);
      if (!next) return;
      const target = verticesRef.current.find((v) => v.id === id);
      if (!target || target.label === next) return;
      pushHistory();
      setVertices((cur) => cur.map((v) => (v.id === id ? { ...v, label: next } : v)));
    },
    [pushHistory],
  );

  /** Переименовать трубопровод (запись группы дерева). */
  const renamePipeline = useCallback(
    (id: string, label: string) => {
      const next = cleanLabel(label);
      if (!next) return;
      const target = pipelinesRef.current.find((p) => p.id === id);
      if (!target || target.label === next) return;
      pushHistory();
      setPipelines((cur) => cur.map((p) => (p.id === id ? { ...p, label: next } : p)));
    },
    [pushHistory],
  );

  /** Переименовать тройник. */
  const renameFitting = useCallback(
    (id: string, label: string) => {
      const next = cleanLabel(label);
      if (!next) return;
      const target = fittingsRef.current.find((f) => f.id === id);
      if (!target || target.label === next) return;
      pushHistory();
      setFittings((cur) => cur.map((f) => (f.id === id ? { ...f, label: next } : f)));
    },
    [pushHistory],
  );

  /** Переименовать врезку. */
  const renameTap = useCallback(
    (id: string, label: string) => {
      const next = cleanLabel(label);
      if (!next) return;
      const target = tapsRef.current.find((t) => t.id === id);
      if (!target || target.label === next) return;
      pushHistory();
      setTaps((cur) => cur.map((t) => (t.id === id ? { ...t, label: next } : t)));
    },
    [pushHistory],
  );

  /** Переименовать лицензионный участок. */
  const renameArea = useCallback(
    (id: string, label: string) => {
      const next = cleanLabel(label);
      if (!next) return;
      const target = areasRef.current.find((a) => a.id === id);
      if (!target || target.label === next) return;
      pushHistory();
      setAreas((cur) => cur.map((a) => (a.id === id ? { ...a, label: next } : a)));
    },
    [pushHistory],
  );

  /** Переименовать сегмент трубопровода. */
  const renameSegment = useCallback(
    (id: string, label: string) => {
      const next = cleanLabel(label);
      if (!next) return;
      const target = segmentsRef.current.find((s) => s.id === id);
      if (!target || target.label === next) return;
      pushHistory();
      setSegments((cur) => cur.map((s) => (s.id === id ? { ...s, label: next } : s)));
    },
    [pushHistory],
  );

  /** Переместить одну вершину участка (индекс pointIndex) в мировую точку. */
  const moveAreaPoint = useCallback((areaId: string, pointIndex: number, x: number, y: number) => {
    const geo = graphPointToLngLat(x, y);
    setAreas((cur) =>
      cur.map((a) => {
        if (a.id !== areaId) return a;
        const points = a.points.map((p, i) => (i === pointIndex ? { x, y } : p));
        const lngLat = a.lngLat.map((g, i) => (i === pointIndex ? geo : g));
        return { ...a, points, lngLat };
      }),
    );
  }, []);

  /** Переместить ВЕСЬ участок на дельту (dx, dy) в мировых единицах. */
  const moveArea = useCallback((areaId: string, dx: number, dy: number) => {
    setAreas((cur) =>
      cur.map((a) => {
        if (a.id !== areaId) return a;
        const points = a.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        const lngLat = points.map((p) => graphPointToLngLat(p.x, p.y));
        return { ...a, points, lngLat };
      }),
    );
  }, []);

  /**
   * Пропорционально масштабировать участок относительно точки-якоря.
   * Масштаб ограничен снизу, чтобы полигон не выворачивался и не схлопывался.
   */
  const scaleArea = useCallback(
    (areaId: string, scale: number, anchorX: number, anchorY: number) => {
      const clamped = Math.max(0.05, Math.min(50, scale));
      setAreas((cur) =>
        cur.map((a) => {
          if (a.id !== areaId) return a;
          const points = a.points.map((p) => ({
            x: anchorX + (p.x - anchorX) * clamped,
            y: anchorY + (p.y - anchorY) * clamped,
          }));
          const lngLat = points.map((p) => graphPointToLngLat(p.x, p.y));
          return { ...a, points, lngLat };
        }),
      );
    },
    [],
  );

  /** Повернуть участок вокруг точки (ox, oy) на угол deltaRad (радианы). */
  const rotateArea = useCallback(
    (areaId: string, deltaRad: number, ox: number, oy: number) => {
      const cos = Math.cos(deltaRad);
      const sin = Math.sin(deltaRad);
      setAreas((cur) =>
        cur.map((a) => {
          if (a.id !== areaId) return a;
          const points = a.points.map((p) => {
            const dx = p.x - ox;
            const dy = p.y - oy;
            return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
          });
          const lngLat = points.map((p) => graphPointToLngLat(p.x, p.y));
          return { ...a, points, lngLat };
        }),
      );
    },
    [],
  );

  /**
   * Загрузить сценарий из снимка БД в domain layer: восстановить объекты,
   * узлы (концы рёбер/тройники/врезки), сегменты, трубопроводы и участки.
   */
  const loadSnapshot = useCallback((snapshot: ProjectSnapshotInput) => {
    pushHistory();

    // 1. Объекты (vertices).
    const nextVertices: MapVertex[] = snapshot.facilities.map((f) => {
      const kind: VertexKind =
        f.kind === 'wellpad' ? 'wellpad' : f.kind === 'delivery-point' ? 'delivery-point' : 'facility';
      const w = f.width_m ?? DEFAULT_VERTEX_SIZE[kind].w;
      const h = f.height_m ?? DEFAULT_VERTEX_SIZE[kind].h;
      return {
        id: f.id,
        kind,
        label: f.name,
        x: 0,
        y: 0,
        lng: f.lng,
        lat: f.lat,
        w,
        h,
      };
    });
    // Восстановить мировые координаты (x/y) из lng/lat.
    for (const v of nextVertices) {
      const p = lngLatToGraphPoint(v.lng, v.lat);
      v.x = p.x;
      v.y = p.y;
    }
    const vertexById = new Map(nextVertices.map((v) => [v.id, v]));

    // 2. Узлы: плоский список координат + типы.
    const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]));

    // 3. Сегменты: концы восстанавливаем как DrawVertex нужного типа.
    const nextSegments: DrawnSegment[] = [];
    const fittingById = new Map<string, MapFitting>();
    const tapById = new Map<string, MapTap>();
    for (const s of snapshot.segments) {
      const fluid = toDrainFluid(s.fluid);
      const pipelineClass = toPipelineClass(s.pipeline_class);
      const from = nodeToDrawVertex(nodeById.get(s.start_node_id), vertexById, fittingById, tapById);
      const to = nodeToDrawVertex(nodeById.get(s.end_node_id), vertexById, fittingById, tapById);
      if (!from || !to) continue;
      // pipelineId проставим позже (из связок трубопроводов).
      // Имя сегмента из снимка (name) → label; пусто — сгенерируется в дереве.
      const label = s.name || undefined;
      nextSegments.push({ id: s.id, from, to, pipelineId: null, fluid, pipelineClass, label });
    }

    // 3b. Восстановить привязку концов рёбер к врезкам/тройникам по снимку:
    //     если узел конца помечен bound_tap_id/bound_fitting_id — заменяем тип
    //     конца на 'tap'/'fitting', сохраняя координаты.
    for (const s of nextSegments) {
      const fromId = nodeIdFromVid(s.from);
      const toId = nodeIdFromVid(s.to);
      s.from = bindEndByNode(s.from, fromId ? nodeById.get(fromId) : undefined);
      s.to = bindEndByNode(s.to, toId ? nodeById.get(toId) : undefined);
    }

    // 4. Трубопроводы: проставляем pipelineId сегментам по segment_ids.
    const nextPipelines: PipelineRecord[] = snapshot.pipelines.map((p) => {
      for (const segId of p.segment_ids) {
        const seg = nextSegments.find((x) => x.id === segId);
        if (seg) seg.pipelineId = p.id;
      }
      return { id: p.id, label: p.name };
    });

    // 5. Лицензионные участки.
    const nextAreas: LicenceArea[] = snapshot.licence_areas.map((a) => ({
      id: a.id,
      label: a.name,
      points: a.polygon.map(([lng, lat]) => lngLatToGraphPoint(lng, lat)),
      lngLat: a.polygon.map(([lng, lat]) => ({ lng, lat })),
    }));

    setVertices(nextVertices);
    setFittings(Array.from(fittingById.values()));
    setTaps(Array.from(tapById.values()));
    setSegments(nextSegments);
    setPipelines(nextPipelines);
    setAreas(nextAreas);
    setDraft(EMPTY_DRAFT);
    setAreaDraft([]);
    setSelections([]);
  }, [pushHistory]);

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
      setSegmentEnd,
      setSegmentEnds,
      replaceSegmentEnd,
      replaceSegmentEnds,
      setVertexPosition,
      setVertexSize,
      setVertexBox,
      fluid,
      setFluid,
      pipelineClass,
      setPipelineClass,
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
      areas,
      areaDraft,
      addAreaPoint,
      closeArea,
      cancelAreaDraft,
      moveAreaPoint,
      moveArea,
      addImportedArea,
      addImportedAreas,
      renameVertex,
      renamePipeline,
      renameFitting,
      renameTap,
      renameArea,
      renameSegment,
      scaleArea,
      rotateArea,
      mergeSegments,
      loadSnapshot,
      exportGeoJSON,
      exportModel,
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
      setSegmentEnd,
      setSegmentEnds,
      replaceSegmentEnd,
      replaceSegmentEnds,
      setVertexPosition,
      setVertexSize,
      setVertexBox,
      fluid,
      pipelineClass,
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
      areas,
      areaDraft,
      addAreaPoint,
      closeArea,
      cancelAreaDraft,
      moveAreaPoint,
      moveArea,
      addImportedArea,
      addImportedAreas,
      renameVertex,
      renamePipeline,
      renameFitting,
      renameTap,
      renameArea,
      renameSegment,
      scaleArea,
      rotateArea,
      mergeSegments,
      loadSnapshot,
      exportGeoJSON,
      exportModel,
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
