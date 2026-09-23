import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { MAP_CENTER, graphPointToScreen, lngLatToWorldPixel, screenToGraphPoint } from './geo';
import {
  MIN_BOX_SIZE,
  isBoxVertex,
  type LicenceArea,
  type DrawnSegment,
  type MapFitting,
  type MapTap,
  type MapVertex,
} from './drawingTypes';
import {
  getEdgeColor,
  getPipelineClassStyle,
} from './mapColors';
import wellpadIcon from '../../assets/design/wellpad.png';
import facilityIcon from '../../assets/design/facility.png';
import deliveryPointIcon from '../../assets/design/delivery-point.png';
import './GeoGraphLayer.css';

/** Иконка (картинка) по типу объекта — промежуточный уровень детализации. */
const VERTEX_ICON: Record<string, string> = {
  wellpad: wellpadIcon,
  facility: facilityIcon,
  'delivery-point': deliveryPointIcon,
};

/** Камера чистой карты: мировой пиксель (на зуме) в левом-верхнем углу + зум. */
export type GeoCamera = { originX: number; originY: number; zoom: number };

export type GeoGraphLayerProps = {
  /** Камера карты: мировой пиксель (на зуме) в левом-верхнем углу + зум */
  camera: GeoCamera | null;
  vertices: MapVertex[];
  fittings: MapFitting[];
  taps: MapTap[];
  segments: DrawnSegment[];
  /** Лицензионные участки (замкнутые полигоны) */
  areas?: LicenceArea[];
  /** Черновик полигона участка (поставленные вершины) */
  areaDraft?: { x: number; y: number }[];
  /** id выделенных вершин (подсветка) */
  selectedIds?: readonly string[];
  /** id выделенных рёбер (подсветка + цель для врезки) */
  selectedSegmentIds?: readonly string[];
  /** id выделенных лицензионных участков (подсветка + ручки вершин) */
  selectedAreaIds?: readonly string[];
  /** id выделенных ВРЕЗОК (визуальная подсветка) */
  selectedTapIds?: readonly string[];
  /** id выделенных ТРОЙНИКОВ (визуальная подсветка) */
  selectedFittingIds?: readonly string[];
  /** Клик по тройнику — выделить/снять выделение (как у врезки) */
  onSelectFitting?: (id: string, withShift: boolean) => void;
  /** Выбор участка кликом (withShift — добавить к выделению) */
  onSelectArea?: (id: string, withShift: boolean) => void;
  /** Перетаскивание ВЕРШИНЫ участка: id, индекс точки, новая мировая точка */
  onAreaPointMove?: (areaId: string, pointIndex: number, x: number, y: number) => void;
  /** Перетаскивание ВСЕГО участка на дельту (dx, dy) в мировых единицах */
  onAreaMove?: (areaId: string, dx: number, dy: number) => void;
  /** Пропорциональный ресайз участка вокруг якоря (мировые координаты) */
  onAreaScale?: (
    areaId: string,
    scale: number,
    anchorX: number,
    anchorY: number,
  ) => void;
  /** Поворот участка вокруг точки (мировые координаты) на угол (рад) */
  onAreaRotate?: (
    areaId: string,
    deltaRad: number,
    ox: number,
    oy: number,
  ) => void;
  /** Режим только для чтения (просмотр) — скрывает ручки трансформации */
  readOnly?: boolean;
  /** id объекта-цели снапа (подсветка при рисовании рёбер рядом) */
  snapTargetId?: string | null;
  /** Выбор объекта по клику (withShift — добавить/убрать из выделения) */
  onSelect?: (id: string, withShift: boolean) => void;
  /** Выбор ребра по клику (withShift — мультивыбор) */
  onSelectSegment?: (id: string, withShift: boolean) => void;
  /** Режим врезки: клик по ребру сразу создаёт врезку в точке клика */
  tapMode?: boolean;
  /**
   * Активен режим СОЗДАНИЯ (рисование ребра/объекта). В этом режиме клик
   * по уже существующему элементу НЕ выделяет его для редактирования —
   * клик пропускается на карту, чтобы сработало присоединение (снап).
   */
  drawingMode?: boolean;
  /** Постановка врезки на ребро: edgeId + мировая точка клика */
  onSegmentPress?: (edgeId: string, world: { x: number; y: number }) => void;
  /** Снять выделение (клик по пустому / Esc) */
  onClearSelection?: () => void;
  /** Лассо-выделение: мировой полигон → добавить всё попавшее в выделение */
  onLasso?: (poly: ReadonlyArray<{ x: number; y: number }>) => void;
  /** Начался лассо-жест (Shift+ЛКМ) — чтобы родитель не снял выделение. */
  onLassoStart?: () => void;
  /** Начать действие (один снимок истории undo на весь drag/resize) */
  onBeginAction?: () => void;
  /** Перетаскивание объекта: новая мировая точка центра (в единицах графа, м) */
  onMove?: (id: string, x: number, y: number) => void;
  /** Перетаскивание тройника: новая мировая точка */
  onMoveFitting?: (id: string, x: number, y: number) => void;
  /** Выбор врезки кликом (withShift — мультивыбор). Врезки неперемещаемы. */
  onSelectTap?: (id: string, withShift: boolean) => void;
  /** Ориентированный граф: рисовать стрелки направления на рёбрах (from → to) */
  directed?: boolean;
  /** Показывать стыки трубопроводов (вершины на концах рёбер) */
  /** Показывать подписи объектов (тумблер «Подписи объектов») */
  showLabels?: boolean;
  /** Показывать стыки трубопроводов (вершины на концах рёбер) */
  showJoints?: boolean;
  /** Ресайз объекта: новый бокс в мировых единицах (м) */
  onResize?: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  /** Перетаскивание концов ребра (группа слипшихся) в новую мировую точку */
  onEndsMove?: (ends: ReadonlyArray<{ segId: string; side: 'from' | 'to' }>, x: number, y: number) => void;
  /** Отпускание концов: перепривязка/отсоединение по мировой точке */
  onEndsDrop?: (ends: ReadonlyArray<{ segId: string; side: 'from' | 'to' }>, x: number, y: number) => void;
};

/** Ось/угол ручки ресайза. */
type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Курсор по направлению ручки. */
const CURSOR: Record<HandleDir, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

/** Пикселей на метр при текущем зуме (для размеров объектов из метров). */
function pxPerMeterAt(zoom: number): number {
  const cosLat = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
  return (256 * Math.pow(2, zoom)) / (40075016.686 * cosLat);
}

/**
 * LOD ОТКЛЮЧЁН: объекты, подписи, точки и ручки ресайза отображаются на ЛЮБОМ
 * зуме (никаких скрытий/уменьшений при изменении масштаба).
 * Единый фиксированный экранный размер точек (тройники/врезки/вершины рёбер).
 */
const DOT_BASE_PX = 12;

/**
 * Порог LOD подписей объектов: при zoom ≤ 8 подписи НЕ отображаются
 * (на обзорном масштабе они нечитаемы и зашумляют карту).
 */
const MIN_ZOOM_FOR_LABEL = 8;

/**
 * id SVG-маркера стрелки по КЛАССУ трубопровода. У тонких линий
 * (промысловый, межпромысловый) стрелка крупнее — см. defs в разметке.
 */
function edgeArrowIdFor(pipelineClass: string): string {
  if (pipelineClass === 'field') return 'geo-edge-arrow-field';
  if (pipelineClass === 'interfield') return 'geo-edge-arrow-interfield';
  return 'geo-edge-arrow';
}

/** Перевод lng/lat в экранные пиксели по текущей камере. */
function toScreen(
  lng: number,
  lat: number,
  camera: { originX: number; originY: number; zoom: number },
): { x: number; y: number } {
  const wp = lngLatToWorldPixel(lng, lat, camera.zoom);
  return { x: wp.x - camera.originX, y: wp.y - camera.originY };
}

/**
 * Оверлей графа поверх растровой карты: объекты и рёбра рисуются в своих
 * гео-координатах (lng/lat) → экранные пиксели. Так граф «привязан» к карте:
 * при зуме/пане объекты остаются на своих географических местах.
 */
export function GeoGraphLayer({
  camera,
  vertices,
  fittings,
  taps,
  segments,
  areas = [],
  areaDraft = [],
  selectedIds = [],
  selectedSegmentIds = [],
  selectedAreaIds = [],
  selectedTapIds = [],
  selectedFittingIds = [],
  onSelectFitting,
  onSelectArea,
  onAreaPointMove,
  onAreaMove,
  onAreaScale,
  onAreaRotate,
  readOnly = false,
  snapTargetId = null,
  onSelect,
  onSelectSegment,
  tapMode = false,
  drawingMode = false,
  onSegmentPress,
  onClearSelection,
  onLasso,
  onLassoStart,
  onBeginAction,
  onMove,
  onMoveFitting,
  onSelectTap,
  directed = false,
  showLabels = true,
  showJoints = true,
  onResize,
  onEndsMove,
  onEndsDrop,
}: GeoGraphLayerProps) {
  // Лассо выделения (Shift + ЛКМ): экранные точки рисуем, при отпускании —
  // конвертируем в мировые и отдаём наружу.
  const [lasso, setLasso] = useState<{ x: number; y: number }[] | null>(null);
  // Актуальные camera/onLasso для лассо-эффекта (навешивается один раз).
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const onLassoRef = useRef(onLasso);
  onLassoRef.current = onLasso;
  const onLassoStartRef = useRef(onLassoStart);
  onLassoStartRef.current = onLassoStart;

  // Esc — снять выделение
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClearSelection?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClearSelection]);

  // Shift + ЛКМ: рисование лассо поверх карты.
  // ВАЖНО: эффект навешивается ОДИН раз ([]), а актуальные camera/onLasso читаем
  // через ref — иначе setLasso вызывает рендер, эффект пересоздаётся, и набранный
  // путь (path) теряется между pointerdown и pointerup.
  useEffect(() => {
    const host = () => document.querySelector('.geo-graph-layer') as HTMLElement | null;
    let path: { x: number; y: number }[] | null = null;
    const down = (e: PointerEvent) => {
      if (!e.shiftKey || e.button !== 0) return;
      const el = host();
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      // Гасим начало жеста, чтобы не выделялся текст под курсором.
      e.preventDefault();
      onLassoStartRef.current?.();
      path = [{ x: e.clientX - r.left, y: e.clientY - r.top }];
      setLasso(path);
    };
    const move = (e: PointerEvent) => {
      if (!path) return;
      const el = host();
      if (!el) return;
      const r = el.getBoundingClientRect();
      path.push({ x: e.clientX - r.left, y: e.clientY - r.top });
      setLasso([...path]);
    };
    const up = () => {
      const pts = path;
      path = null;
      setLasso(null);
      const cam = cameraRef.current;
      if (!pts || pts.length < 3 || !cam) return;
      const world = pts.map((p) => screenToGraphPoint(p, cam));
      onLassoRef.current?.(world);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
    };
  }, []);
  /** Экранная точка карты (по текущей камере) → мировые единицы графа (м). */
  const screenToWorld = useCallback(
    (clientX: number, clientY: number, hostRect: DOMRect) => {
      if (!camera) return null;
      return screenToGraphPoint(
        { x: clientX - hostRect.left, y: clientY - hostRect.top },
        camera,
      );
    },
    [camera],
  );

  // --- Перетаскивание объекта за тело (возможно, с Shift-мультивыбором) ---
  const startMove = useCallback(
    (e: ReactPointerEvent, v: MapVertex) => {
      if (!camera || !onMove) return;
      e.preventDefault();
      e.stopPropagation();
      const host = (e.currentTarget as HTMLElement).closest('.geo-graph-layer') as HTMLElement | null;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const start = screenToWorld(e.clientX, e.clientY, rect);
      if (!start) return;
      onBeginAction?.(); // один снимок истории на весь перенос
      // Дельта между стартовой мировой точкой курсора и центром объекта —
      // сохраняем, чтобы объект не «прыгал» под курсор при захвате.
      const grabDx = v.x - start.x;
      const grabDy = v.y - start.y;
      // Групповой перенос: если объект входит в выделение и выделено больше
      // одного — двигаем ВСЕ выделенные объекты на общий вектор.
      const group =
        selectedIds.includes(v.id) && selectedIds.length > 1
          ? vertices.filter((it) => selectedIds.includes(it.id)).map((it) => ({ id: it.id, x: it.x, y: it.y }))
          : null;
      const originX = v.x;
      const originY = v.y;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const onMovePtr = (ev: PointerEvent) => {
        const p = screenToWorld(ev.clientX, ev.clientY, rect);
        if (!p) return;
        const nx = p.x + grabDx;
        const ny = p.y + grabDy;
        if (!group) {
          onMove(v.id, nx, ny);
          return;
        }
        const dx = nx - originX;
        const dy = ny - originY;
        for (const g of group) onMove(g.id, g.x + dx, g.y + dy);
      };
      const finish = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', onMovePtr);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        target.releasePointerCapture(ev.pointerId);
      };
      target.addEventListener('pointermove', onMovePtr);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [camera, onMove, onBeginAction, screenToWorld, selectedIds, vertices],
  );

  // --- Перетаскивание тройника ---
  const startFittingDrag = useCallback(
    (e: ReactPointerEvent, id: string, fx: number, fy: number) => {
      if (!camera || !onMoveFitting) return;
      e.preventDefault();
      e.stopPropagation();
      const host = (e.currentTarget as HTMLElement).closest('.geo-graph-layer') as HTMLElement | null;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const start = screenToWorld(e.clientX, e.clientY, rect);
      if (!start) return;
      onBeginAction?.();
      const grabDx = fx - start.x;
      const grabDy = fy - start.y;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const onMovePtr = (ev: PointerEvent) => {
        const p = screenToWorld(ev.clientX, ev.clientY, rect);
        if (!p) return;
        onMoveFitting(id, p.x + grabDx, p.y + grabDy);
      };
      const finish = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', onMovePtr);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        target.releasePointerCapture(ev.pointerId);
      };
      target.addEventListener('pointermove', onMovePtr);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [camera, onMoveFitting, onBeginAction, screenToWorld],
  );

  // Врезки НЕ перетаскиваются (fixed): клик только выделяет для удаления,
  // поэтому обработчик перетаскивания врезки отсутствует.

  // --- Перетаскивание КОНЦА ребра (segId + сторона) ---
  // Стык = НЕСКОЛЬКО концов разных рёбер в одной точке. Тянем всю группу
  // слипшихся концов вместе — иначе «соединение» визуально остаётся (двигался
  // бы только один конец, а соседний стоял бы на месте).
  const startEdgeVertexDrag = useCallback(
    (e: ReactPointerEvent, segId: string, side: 'from' | 'to', vx: number, vy: number) => {
      if (!camera || !onEndsMove) return;
      e.preventDefault();
      e.stopPropagation();
      const host = (e.currentTarget as HTMLElement).closest('.geo-graph-layer') as HTMLElement | null;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const start = screenToWorld(e.clientX, e.clientY, rect);
      if (!start) return;
      onBeginAction?.();
      const grabDx = vx - start.x;
      const grabDy = vy - start.y;
      // Собираем все концы всех сегментов, стоящие в той же точке (±2 м).
      const ends: { segId: string; side: 'from' | 'to' }[] = [];
      for (const s of segments) {
        for (const sd of ['from', 'to'] as const) {
          if (Math.hypot(s[sd].x - vx, s[sd].y - vy) <= 2) ends.push({ segId: s.id, side: sd });
        }
      }
      if (ends.length === 0) ends.push({ segId, side });
      let lastWorld = { x: vx, y: vy };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const onMovePtr = (ev: PointerEvent) => {
        const p = screenToWorld(ev.clientX, ev.clientY, rect);
        if (!p) return;
        lastWorld = { x: p.x + grabDx, y: p.y + grabDy };
        onEndsMove(ends, lastWorld.x, lastWorld.y);
      };
      const finish = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', onMovePtr);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        target.releasePointerCapture(ev.pointerId);
        // Перепривязка/отсоединение: резолвим ближайшую цель (или free)
        onEndsDrop?.(ends, lastWorld.x, lastWorld.y);
      };
      target.addEventListener('pointermove', onMovePtr);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [camera, onEndsMove, onEndsDrop, onBeginAction, screenToWorld, segments],
  );

  // --- Ресайз за ручку (размеры в метрах/мировых единицах) ---
  const startResize = useCallback(
    (e: ReactPointerEvent, v: MapVertex, dir: HandleDir) => {
      if (!camera || !onResize) return;
      e.preventDefault();
      e.stopPropagation();
      const ppm = pxPerMeterAt(camera.zoom);
      const startX = e.clientX;
      const startY = e.clientY;
      const orig = {
        left: v.x - (v.w ?? 0) / 2,
        top: v.y - (v.h ?? 0) / 2,
        right: v.x + (v.w ?? 0) / 2,
        bottom: v.y + (v.h ?? 0) / 2,
      };
      onBeginAction?.(); // один снимок истории на весь ресайз
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const onMovePtr = (ev: PointerEvent) => {
        // Экранная дельта → метры: на экране 1 м = ppm пикселей.
        const ddx = (ev.clientX - startX) / ppm;
        const ddy = (ev.clientY - startY) / ppm;
        let { left, top, right, bottom } = orig;
        if (dir.includes('w')) left = Math.min(orig.left + ddx, right - MIN_BOX_SIZE);
        if (dir.includes('e')) right = Math.max(orig.right + ddx, left + MIN_BOX_SIZE);
        if (dir.includes('n')) top = Math.min(orig.top + ddy, bottom - MIN_BOX_SIZE);
        if (dir.includes('s')) bottom = Math.max(orig.bottom + ddy, top + MIN_BOX_SIZE);
        onResize(v.id, {
          x: (left + right) / 2,
          y: (top + bottom) / 2,
          w: right - left,
          h: bottom - top,
        });
      };
      const finish = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', onMovePtr);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        target.releasePointerCapture(ev.pointerId);
      };
      target.addEventListener('pointermove', onMovePtr);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [camera, onResize, onBeginAction],
  );

  if (!camera || camera.zoom === 0) return null;

  const pxPerMeter = pxPerMeterAt(camera.zoom);
  // Единый экранный размер точек (LOD отключён — точки видны на любом зуме).
  const dotSize = DOT_BASE_PX;

  // Вершины на концах рёбер (маленькие точки). У КАЖДОГО ребра всегда 2 вершины
  // (from и to) — точка привязана к конкретному концу сегмента (segId + side).
  // НЕ дедуплицируем: если два конца смежных рёбер совпадают (общий vid),
  // точки просто накладываются друг на друга — визуально одна, но обе перетаскиваемы.
  // Стыки к объектам графа (type: 'node') пропускаются — там уже есть сам объект.
  type EdgeEndVertex = {
    key: string;
    segId: string;
    side: 'from' | 'to';
    x: number;
    y: number;
    /** Цвет вершины — как у родительского ребра (флюид + класс) */
    color: string;
    /** Вершина привязана к врезке — её НЕЛЬЗЯ перетаскивать */
    fixed: boolean;
  };
  const edgeVertices: EdgeEndVertex[] = [];
  for (const s of segments) {
    // Вершина наследует цвет РЕБРА целиком (флюид + класс): у «логического
    // потока» класс перекрывает флюид — цвет тёмно-серый, как у самого ребра.
    const segmentColor = selectedSegmentIds.includes(s.id)
      ? '#004d99'
      : getEdgeColor(s.fluid, s.pipelineClass);
    for (const side of ['from', 'to'] as const) {
      const v = s[side];
      if (v.type === 'node') continue;
      edgeVertices.push({
        key: `${s.id}-${side}`,
        segId: s.id,
        side,
        x: v.x,
        y: v.y,
        color: segmentColor,
        fixed: v.type === 'tap' && v.tapId !== '',
      });
    }
  }

  return (
    <div className="geo-graph-layer">
      {/* Лассо выделения (Shift + ЛКМ) */}
      {lasso && lasso.length > 1 && (
        <svg className="geo-graph-layer__lasso" aria-hidden="true">
          <polyline
            points={lasso.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="rgba(0,102,204,0.12)"
            stroke="#0066cc"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </svg>
      )}

      {/* Рёбра */}
      <svg className="geo-graph-layer__svg">
        {/* Стрелки направления рёбер (ориентированный граф).
            Отдельный маркер на класс трубопровода: у тонких линий (промысловый,
            межпромысловый) стрелка крупнее (markerWidth больше), чтобы быть
            сопоставимой по размеру со стрелкой толстого магистрального.
            markerUnits=strokeWidth — размер отсчитывается от толщины линии. */}
        <defs>
          {/* Промысловый (тонкая линия 2.5 px) — самая крупная стрелка */}
          <marker
            id="geo-edge-arrow-field"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
          </marker>
          {/* Межпромысловый (линия 4 px) — крупная стрелка */}
          <marker
            id="geo-edge-arrow-interfield"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
          </marker>
          {/* Магистральный / логический — базовый размер */}
          <marker
            id="geo-edge-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="2.5"
            markerHeight="2.5"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
          >
            {/* context-stroke — стрелка берёт цвет ПРИВЯЗАННОГО ребра
                (учитывая флюид и выделение), а не фиксированный синий. */}
            <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        {/* Лицензионные участки — заливка + контур (под графом) */}
        {areas.map((area) => {
          const pts = area.points
            .map((p) => graphPointToScreen(p, camera))
            .map((p) => `${p.x},${p.y}`)
            .join(' ');
          const selected = selectedAreaIds.includes(area.id);
          return (
            <polygon
              key={area.id}
              className={`geo-graph-layer__area${selected ? ' is-selected' : ''}`}
              points={pts}
              // Клик — выделить участок (для редактирования/удаления).
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelectArea?.(area.id, e.shiftKey);
                // Перетаскивание всего участка за тело полигона.
                if (!onAreaMove) return;
                const host = (e.currentTarget.ownerSVGElement?.parentElement) ?? null;
                const rect = host?.getBoundingClientRect();
                if (!rect) return;
                const start = screenToWorld(e.clientX, e.clientY, rect);
                if (!start) return;
                onBeginAction?.();
                let last = start;
                const target = e.currentTarget as SVGPolygonElement;
                target.setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => {
                  const p = screenToWorld(ev.clientX, ev.clientY, rect);
                  if (!p) return;
                  onAreaMove(area.id, p.x - last.x, p.y - last.y);
                  last = p;
                };
                const finish = (ev: PointerEvent) => {
                  target.removeEventListener('pointermove', move);
                  target.removeEventListener('pointerup', finish);
                  target.removeEventListener('pointercancel', finish);
                  target.releasePointerCapture(ev.pointerId);
                };
                target.addEventListener('pointermove', move);
                target.addEventListener('pointerup', finish);
                target.addEventListener('pointercancel', finish);
              }}
              onPointerUp={(e) => e.stopPropagation()}
            />
          );
        })}
        {/* Вершины выделенных участков — ручки для правки формы полигона */}
        {areas
          .filter((a) => selectedAreaIds.includes(a.id))
          .map((area) =>
            area.points.map((pt, index) => {
              const sp = graphPointToScreen(pt, camera);
              return (
                <circle
                  key={`area-handle-${area.id}-${index}`}
                  className="geo-graph-layer__area-handle"
                  cx={sp.x}
                  cy={sp.y}
                  r={6}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (!onAreaPointMove) return;
                    const host = (e.currentTarget.ownerSVGElement?.parentElement) ?? null;
                    const rect = host?.getBoundingClientRect();
                    if (!rect) return;
                    onBeginAction?.();
                    const target = e.currentTarget as SVGCircleElement;
                    target.setPointerCapture(e.pointerId);
                    const move = (ev: PointerEvent) => {
                      const p = screenToWorld(ev.clientX, ev.clientY, rect);
                      if (p) onAreaPointMove(area.id, index, p.x, p.y);
                    };
                    const finish = (ev: PointerEvent) => {
                      target.removeEventListener('pointermove', move);
                      target.removeEventListener('pointerup', finish);
                      target.removeEventListener('pointercancel', finish);
                      target.releasePointerCapture(ev.pointerId);
                    };
                    target.addEventListener('pointermove', move);
                    target.addEventListener('pointerup', finish);
                    target.addEventListener('pointercancel', finish);
                  }}
                />
              );
            }),
          )}
        {/* Рамка трансформации выделенных участков: пропорциональный ресайз
            (8 ручек) + поворот (ручка сверху). Best practice: единый bbox-фрейм,
            угловые ручки — пропорционально, Shift — снап угла к 15°. */}
        {!readOnly &&
          areas
            .filter((a) => selectedAreaIds.includes(a.id))
            .map((area) => {
              // AABB участка в ЭКРАННЫХ координатах (рамка вокруг полигона).
              const screenPts = area.points.map((p) => graphPointToScreen(p, camera));
              const xs = screenPts.map((p) => p.x);
              const ys = screenPts.map((p) => p.y);
              const minX = Math.min(...xs);
              const maxX = Math.max(...xs);
              const minY = Math.min(...ys);
              const maxY = Math.max(...ys);
              const cxScreen = (minX + maxX) / 2;
              const cyScreen = (minY + maxY) / 2;

              // Центр поворота — геометрический центроид полигона (в мире).
              const centroid = area.points.reduce(
                (acc, p) => ({ x: acc.x + p.x / area.points.length, y: acc.y + p.y / area.points.length }),
                { x: 0, y: 0 },
              );
              // Универсальный драг ручки: считаем мировые координаты через rect.
              const beginDrag = (
                e: ReactPointerEvent,
                onMove: (world: { x: number; y: number }, shift: boolean) => void,
              ) => {
                e.stopPropagation();
                const target = e.currentTarget as SVGElement;
                const host = target.ownerSVGElement?.parentElement ?? null;
                const rect = host?.getBoundingClientRect();
                if (!rect) return;
                onBeginAction?.();
                target.setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => {
                  const p = screenToWorld(ev.clientX, ev.clientY, rect);
                  if (p) onMove(p, ev.shiftKey);
                };
                const finish = (ev: PointerEvent) => {
                  target.removeEventListener('pointermove', move);
                  target.removeEventListener('pointerup', finish);
                  target.removeEventListener('pointercancel', finish);
                  target.releasePointerCapture(ev.pointerId);
                };
                target.addEventListener('pointermove', move);
                target.addEventListener('pointerup', finish);
                target.addEventListener('pointercancel', finish);
              };

              // Мировые координаты фиксированного (диагонально противоположного) угла.
              const aabb = area.points.reduce(
                (acc, p) => ({
                  minX: Math.min(acc.minX, p.x),
                  maxX: Math.max(acc.maxX, p.x),
                  minY: Math.min(acc.minY, p.y),
                  maxY: Math.max(acc.maxY, p.y),
                }),
                { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
              );
              // 8 ручек пропорционального ресайза (углы + середины сторон).
              const handles: Array<{ pos: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'; x: number; y: number; cursor: string }> = [
                { pos: 'nw', x: minX, y: minY, cursor: 'nwse-resize' },
                { pos: 'n', x: cxScreen, y: minY, cursor: 'ns-resize' },
                { pos: 'ne', x: maxX, y: minY, cursor: 'nesw-resize' },
                { pos: 'e', x: maxX, y: cyScreen, cursor: 'ew-resize' },
                { pos: 'se', x: maxX, y: maxY, cursor: 'nwse-resize' },
                { pos: 's', x: cxScreen, y: maxY, cursor: 'ns-resize' },
                { pos: 'sw', x: minX, y: maxY, cursor: 'nesw-resize' },
                { pos: 'w', x: minX, y: cyScreen, cursor: 'ew-resize' },
              ];

              const ROTATE_OFFSET = 26; // отступ ручки поворота над рамкой, px
              return (
                <g key={`area-frame-${area.id}`}>
                  {/* Рамка bbox (тонкая, пунктирная — визуально не конкурирует с полигоном) */}
                  <rect
                    className="geo-graph-layer__area-frame"
                    x={minX}
                    y={minY}
                    width={Math.max(1, maxX - minX)}
                    height={Math.max(1, maxY - minY)}
                  />
                  {/* Поворот: ручка сверху по центру + соединительная линия */}
                  {onAreaRotate && (
                    <>
                      <line
                        className="geo-graph-layer__area-rotate-link"
                        x1={cxScreen}
                        y1={minY}
                        x2={cxScreen}
                        y2={minY - ROTATE_OFFSET}
                      />
                      {/* Ручка поворота: круг + изогнутая стрелка (аффорданс вращения) */}
                      <g className="geo-graph-layer__area-rotate-g">
                        <circle
                          className="geo-graph-layer__area-rotate"
                          cx={cxScreen}
                          cy={minY - ROTATE_OFFSET}
                          r={7}
                          onPointerDown={(e) => {
                          // Угол курсора относительно центроида; поворот применяется
                          // дельтой от предыдущего кадра. Shift — снап к 15°.
                          const host = (e.currentTarget.ownerSVGElement?.parentElement) ?? null;
                          const rect = host?.getBoundingClientRect();
                          const first = rect ? screenToWorld(e.clientX, e.clientY, rect) : null;
                          let prevAngle = first
                            ? Math.atan2(first.y - centroid.y, first.x - centroid.x)
                            : 0;
                          beginDrag(e, (world, shift) => {
                            const cur = Math.atan2(world.y - centroid.y, world.x - centroid.x);
                            let delta = cur - prevAngle;
                            if (shift) {
                              const snap = Math.PI / 12; // 15°
                              const snapped = Math.round((prevAngle + delta) / snap) * snap;
                              delta = snapped - prevAngle;
                            }
                            onAreaRotate?.(area.id, delta, centroid.x, centroid.y);
                            prevAngle = cur;
                          });
                        }}
                          onPointerUp={(e) => e.stopPropagation()}
                        />
                        <path
                          className="geo-graph-layer__area-rotate-glyph"
                          d={`M ${cxScreen - 3} ${minY - ROTATE_OFFSET} a 3 3 0 1 1 3 3`}
                        />
                      </g>
                    </>
                  )}
                  {/* 8 ручек пропорционального ресайза */}
                  {onAreaScale &&
                    handles.map((h) => (
                      <rect
                        key={`${area.id}-${h.pos}`}
                        className="geo-graph-layer__area-resize"
                        x={h.x - 4}
                        y={h.y - 4}
                        width={8}
                        height={8}
                        style={{ cursor: h.cursor }}
                        onPointerDown={(e) => {
                          // Якорь — диагонально противоположный угол bbox (в мире).
                          const anchorX = h.pos.includes('w') ? aabb.maxX : aabb.minX;
                          const anchorY = h.pos.includes('n') ? aabb.maxY : aabb.minY;
                          // Пропорциональный масштаб: отношение текущего расстояния
                          // «якорь→курсор» к начальному. Применяем инкрементально.
                          const host = (e.currentTarget.ownerSVGElement?.parentElement) ?? null;
                          const rect = host?.getBoundingClientRect();
                          const first = rect ? screenToWorld(e.clientX, e.clientY, rect) : null;
                          let prevDist = first
                            ? Math.hypot(first.x - anchorX, first.y - anchorY)
                            : 1;
                          beginDrag(e, (world) => {
                            const dist = Math.hypot(world.x - anchorX, world.y - anchorY);
                            // Относительный шаг: отношение текущего расстояния к
                            // предыдущему (полигон масштабируется инкрементально).
                            const step = dist / (prevDist || 1e-3);
                            prevDist = dist;
                            onAreaScale?.(area.id, step, anchorX, anchorY);
                          });
                        }}
                        onPointerUp={(e) => e.stopPropagation()}
                      />
                    ))}
                </g>
              );
            })}
        {segments.map((s) => {
          const a = graphPointToScreen(s.from, camera);
          const b = graphPointToScreen(s.to, camera);
          const selected = selectedSegmentIds.includes(s.id);
          // Цвет — по классу и флюиду (логический поток — тёмно-серый),
          // толщина/штрих — по классу трубопровода.
          const classStyle = getPipelineClassStyle(s.pipelineClass);
          const fluidColor = getEdgeColor(s.fluid, s.pipelineClass);
          return (
            <g key={s.id}>
              {/* Невидимая широкая линия — удобная зона клика по ребру */}
              <line
                className="geo-graph-layer__edge-hit"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={tapMode ? 24 : 12}
                onPointerDown={(e) => {
                  // Режим СОЗДАНИЯ: клик по ребру — не выделение, а обычный клик
                  // по карте (точка присоединения / продолжение полилинии).
                  if (drawingMode && !tapMode) return;
                  e.stopPropagation();
                  // В режиме врезки клик по ребру сразу ставит врезку в этой точке
                  if (tapMode) {
                    const host = (e.currentTarget.ownerSVGElement?.parentElement) ?? null;
                    const rect = host?.getBoundingClientRect();
                    const p = rect ? screenToWorld(e.clientX, e.clientY, rect) : null;
                    if (p) onSegmentPress?.(s.id, p);
                    return;
                  }
                  onSelectSegment?.(s.id, e.shiftKey);
                }}
                onPointerUp={(e) => {
                  if (drawingMode && !tapMode) return;
                  e.stopPropagation();
                }}
              />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={selected ? '#004d99' : fluidColor}
                strokeWidth={classStyle.width + (selected ? 2 : 0)}
                strokeDasharray={classStyle.dash}
                // Ориентированный граф — стрелка направления from → to на конце.
                // Маркер зависит от класса: у тонких линий (промысловый,
                // межпромысловый) стрелка крупнее — задаётся отдельными defs.
                markerEnd={directed ? `url(#${edgeArrowIdFor(s.pipelineClass)})` : undefined}
              />
            </g>
          );
        })}
      </svg>

      {/* Черновик полигона участка: линия по точкам + первая вершина (клик — замкнуть) */}
      {areaDraft.length > 0 && (
        <svg className="geo-graph-layer__svg">
          <polyline
            className="geo-graph-layer__area-draft"
            points={areaDraft.map((p) => {
              const sp = graphPointToScreen(p, camera);
              return `${sp.x},${sp.y}`;
            }).join(' ')}
          />
          {areaDraft.map((p, i) => {
            const sp = graphPointToScreen(p, camera);
            const isFirst = i === 0;
            return (
              <circle
                key={`area-pt-${i}`}
                className={`geo-graph-layer__area-vertex${isFirst ? ' is-first' : ''}`}
                cx={sp.x}
                cy={sp.y}
                r={isFirst ? 6 : 4}
              />
            );
          })}
        </svg>
      )}

      {/* Стыки трубопроводов (вершины на концах рёбер) — по тумблеру */}
      {showJoints &&
        edgeVertices.map((v) => {
        const p = graphPointToScreen(v, camera);
        // Вершины меньше, чем тройники/врезки (были size 4 в vis), но кликабельны:
        // визуальный размер — ~1/3 точки, зона захвата — не меньше 12 px.
        const size = Math.max(4, dotSize / 3);
        return (
          <span
            key={`ev-${v.key}`}
            className={`geo-graph-layer__dot geo-graph-layer__dot--vertex${v.fixed ? ' is-fixed' : ''}`}
            style={{
              left: p.x,
              top: p.y,
              width: size,
              height: size,
              // Цвет вершины — как у ребра (по флюиду): фон и контур.
              background: v.color,
              borderColor: v.color,
            }}
            // Вершины, привязанные к врезке, НЕ перетаскиваются (fixed).
            // В режиме СОЗДАНИЯ не даём тянуть вершину — клик идёт на карту.
            onPointerDown={
              v.fixed || drawingMode
                ? undefined
                : (e) => startEdgeVertexDrag(e, v.segId, v.side, v.x, v.y)
            }
            onPointerUp={(e) => {
              if (drawingMode) return;
              e.stopPropagation();
            }}
          />
        );
      })}
      {/* Объекты (системы сбора / УПН / точки поставки) — на любом зуме */}
      {vertices.map((v) => {
        const p = toScreen(v.lng, v.lat, camera);
        const w = (v.w ?? 0) * pxPerMeter;
        const h = (v.h ?? 0) * pxPerMeter;
        const selected = selectedIds.includes(v.id);
        const highlighted = snapTargetId === v.id;
        // Подписи: по тумблеру «Подписи объектов» И при рабочем масштабе
        // (при zoom ≤ 8 названия нечитаемы и только зашумляют карту).
        const showLabel = showLabels && camera.zoom > MIN_ZOOM_FOR_LABEL;
        return (
          <div
            key={v.id}
            className={`geo-graph-layer__vertex geo-graph-layer__vertex--${v.kind}${selected ? ' is-selected' : ''}${highlighted ? ' is-snap-target' : ''}`}
            style={{
              left: p.x,
              top: p.y,
              width: w || undefined,
              height: h || undefined,
            }}
            onPointerDown={(e) => {
              // Режим СОЗДАНИЯ: клик по объекту — не выделение, а точка
              // присоединения. Пропускаем событие на карту (снап сработает там).
              if (drawingMode) return;
              // Клик по НЕвыделенному (без Shift) — выделяет только его.
              // Клик по уже выделенному — не сбрасывает группу (групповой перенос).
              if (!selectedIds.includes(v.id)) onSelect?.(v.id, e.shiftKey);
              else if (e.shiftKey) onSelect?.(v.id, true);
              startMove(e, v);
            }}
            // Гасим pointerup: иначе он всплывёт до карты (GeoMapOnly) и
            // её onMapClick снимет выделение сразу после клика по объекту.
            // В режиме создания — НЕ гасим: карта должна получить клик (снап).
            onPointerUp={(e) => {
              if (drawingMode) return;
              e.stopPropagation();
            }}
          >
            {/* Внутри объекта — картинка типа, растянутая по размеру объекта */}
            {VERTEX_ICON[v.kind] && (
              <img className="geo-graph-layer__icon" src={VERTEX_ICON[v.kind]} alt="" draggable={false} />
            )}
            {/* Подпись (LOD: скрыта при zoom ≤ MIN_ZOOM_FOR_LABEL) */}
            {showLabel && (
              <span className="geo-graph-layer__vertex-label">{v.label}</span>
            )}
            {selected &&
              isBoxVertex(v.kind) &&
              HANDLES.map((dir) => (
                <span
                  key={dir}
                  className={`geo-graph-layer__handle geo-graph-layer__handle--${dir}`}
                  style={{ cursor: CURSOR[dir] }}
                  onPointerDown={(e) => startResize(e, v, dir)}
                  onPointerUp={(e) => e.stopPropagation()}
                />
              ))}
          </div>
        );
      })}

      {/* Тройники */}
      {fittings.map((f) => {
          const p = toScreen(f.lng, f.lat, camera);
          const teeSelected = selectedFittingIds.includes(f.id);
          return (
            <span
              key={f.id}
              className={`geo-graph-layer__dot geo-graph-layer__dot--tee${teeSelected ? ' is-selected' : ''}`}
              style={{ left: p.x, top: p.y, width: dotSize, height: dotSize }}
              title={f.label}
              // В режиме СОЗДАНИЯ тройник не тянем — клик идёт на карту.
              onPointerDown={
                drawingMode
                  ? undefined
                  : (e) => {
                      // Клик — выделение (для Delete), затем перетаскивание.
                      onSelectFitting?.(f.id, e.shiftKey);
                      startFittingDrag(e, f.id, f.x, f.y);
                    }
              }
              onPointerUp={(e) => {
                if (drawingMode) return;
                e.stopPropagation();
              }}
            />
          );
        })}

      {/* Врезки */}
      {taps.map((t) => {
          const p = toScreen(t.lng, t.lat, camera);
          const tapSelected = selectedTapIds.includes(t.id);
          return (
            <span
              key={t.id}
              className={`geo-graph-layer__dot geo-graph-layer__dot--tap is-fixed${tapSelected ? ' is-selected' : ''}`}
              style={{ left: p.x, top: p.y, width: dotSize, height: dotSize }}
              title={t.label}
              // Врезка НЕ перетаскивается (fixed). Клик — только выделение для удаления.
              // В режиме СОЗДАНИЯ не выделяем врезку — клик идёт на карту (снап).
              onPointerDown={(e) => {
                if (drawingMode) return;
                e.stopPropagation();
                onSelectTap?.(t.id, e.shiftKey);
              }}
              onPointerUp={(e) => {
                if (drawingMode) return;
                e.stopPropagation();
              }}
            />
          );
        })}
    </div>
  );
}
