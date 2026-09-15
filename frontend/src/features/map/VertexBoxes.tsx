import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Network } from 'vis-network';
import type { MutableRefObject } from 'react';
import {
  CONNECT_RADIUS,
  MIN_BOX_SIZE,
  POINT_VERTEX_RADIUS,
  isBoxVertex,
  type MapVertex,
} from './drawingTypes';
import { getMarkerColor } from './mapColors';
import wellpadIcon from '../../assets/design/wellpad.png';
import facilityIcon from '../../assets/design/facility.png';
import deliveryPointIcon from '../../assets/design/delivery-point.png';
import './VertexBoxes.css';

/** Иконка (картинка) по типу объекта — внутри вершины. */
const VERTEX_ICON: Record<string, string> = {
  wellpad: wellpadIcon,
  facility: facilityIcon,
  'delivery-point': deliveryPointIcon,
};

export type VertexBoxesProps = {
  /** Императивный экземпляр vis-network (для canvasToDOM/DOMtoCanvas) */
  networkRef: MutableRefObject<Network | null>;
  /** Все спроектированные вершины (и кусты, и точечные — для областей соединения) */
  vertices: MapVertex[];
  /** Изменение положения куста (перетаскивание за тело) */
  onMove: (id: string, x: number, y: number) => void;
  /** Изменение размеров и положения куста (ресайз за ручку) */
  onResize: (id: string, box: { x: number; y: number; w: number; h: number }) => void;
  /** id куста-цели снапа (подсветка при рисовании рядом) */
  highlightId?: string | null;
  /** Показывать подписи */
  showLabels: boolean;
  /** Показывать область соединения (прозрачная зона вокруг контура) */
  showConnectArea?: boolean;
  /** id выделенных объектов (controlled из состояния рисования) */
  selectedIds?: readonly string[];
  /** Выбор объекта по клику (withShift — добавить к выделению) */
  onSelect?: (id: string, withShift: boolean) => void;
  /** Снять выделение (клик по пустой карте / Esc) */
  onClearSelection?: () => void;
  /** Сообщить о начале действия (для истории undo — один снимок на drag/resize) */
  onBeginAction?: () => void;
  /** Начало группового переноса (подхватить прочие выделенные элементы) */
  onGroupDragStart?: () => void;
  /** Групповой перенос: сдвиг выделенных не-объектов на (dx, dy) */
  onGroupDrag?: (dx: number, dy: number) => void;
  /** Конец группового переноса */
  onGroupDragEnd?: () => void;
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

/** Состояние камеры vis-network для применения CSS-трансформации к слою. */
type Camera = {
  scale: number;
  viewX: number;
  viewY: number;
  width: number;
  height: number;
};

/** CSS-трансформ слоя в мировых координатах (Origin 0 0). */
function cameraTransform(cam: Camera): string {
  const tx = cam.width / 2 - cam.viewX * cam.scale;
  const ty = cam.height / 2 - cam.viewY * cam.scale;
  return `translate(${tx}px, ${ty}px) scale(${cam.scale})`;
}

/**
 * DOM-слой прямоугольных вершин (кустов) поверх canvas vis-network.
 *
 * vis-network не умеет рисовать прямоугольники с ручками ресайза, поэтому кусты
 * живут в отдельном DOM-слое. Ко ВСЕМУ слою применяется ОДИН CSS-transform,
 * повторяющий камеру vis (translate + scale) — это даёт плавный, синхронный с
 * canvas-картой зум, без покадрового пересчёта координат каждого куста в React.
 * Кусты позиционируются в МИРОВЫХ координатах (x/y/w/h из модели).
 */
export function VertexBoxes({
  networkRef,
  vertices,
  onMove,
  onResize,
  highlightId,
  showLabels,
  showConnectArea = false,
  selectedIds = [],
  onSelect,
  onClearSelection,
  onBeginAction,
  onGroupDragStart,
  onGroupDrag,
  onGroupDragEnd,
}: VertexBoxesProps) {
  const frameRef = useRef(0);
  const boxes = useMemo(() => vertices.filter((v) => isBoxVertex(v.kind)), [vertices]);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const points = useMemo(() => vertices.filter((v) => !isBoxVertex(v.kind)), [vertices]);
  const [camera, setCamera] = useState<Camera>({
    scale: 1,
    viewX: 0,
    viewY: 0,
    width: 0,
    height: 0,
  });

  // --- Синхронизация камеры слоя с камерой vis (зум/пан/redraw) ---
  // Пересчитывается один transform на весь слой, а не координаты каждого куста —
  // браузер масштабирует DOM-слой за один композитный шаг, синхронно с canvas.
  useEffect(() => {
    const recompute = () => {
      const net = networkRef.current;
      const host = document.querySelector('.map-viewport__canvas') as HTMLElement | null;
      if (!net || !host) return;
      const view = net.getViewPosition();
      setCamera({
        scale: net.getScale(),
        viewX: view.x,
        viewY: view.y,
        width: host.clientWidth,
        height: host.clientHeight,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(recompute);
    };
    const net = networkRef.current;
    const names: Array<'zoom' | 'dragging' | 'afterDrawing'> = ['zoom', 'dragging', 'afterDrawing'];
    if (net) names.forEach((n) => net.on(n, schedule));
    window.addEventListener('resize', schedule);
    recompute();
    return () => {
      if (net) names.forEach((n) => net.off(n, schedule));
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frameRef.current);
    };
  }, [networkRef, boxes, points]);

  // --- Снятие выделения (клик по пустой карте / Escape) ---
  useEffect(() => {
    // Клик по canvas (не по кусту) снимает выделение
    const canvas = document.querySelector('.map-viewport__canvas');
    const onCanvasDown = () => onClearSelection?.();
    canvas?.addEventListener('pointerdown', onCanvasDown);
    // Escape — выйти из режима редактирования
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClearSelection?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      canvas?.removeEventListener('pointerdown', onCanvasDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClearSelection]);

  // --- Перетаскивание тела куста (возможно, группы) ---
  const startMove = useCallback(
    (e: ReactPointerEvent, id: string) => {
      const net = networkRef.current;
      if (!net) return;
      e.preventDefault();
      e.stopPropagation();
      const start = net.DOMtoCanvas({ x: e.clientX - hostLeft(), y: e.clientY - hostTop() });
      // Если объект в выделении и выделено несколько — двигаем всю группу.
      const isGroup = selectedIds.includes(id) && selectedIds.length > 1;
      const group = isGroup ? selectedIds : [id];
      onBeginAction?.(); // один снимок истории на весь перенос
      // Стартовые позиции всех перемещаемых объектов
      const starts = group
        .map((gid) => boxesRef.current.find((b) => b.id === gid))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => ({ id: b.id, x: b.x, y: b.y }));
      if (starts.length === 0) return;
      // Групповой перенос: подхватываем и прочие выделенные элементы
      // (вершины рёбер/тройники/врезки) — их двигает MapViewport по дельте.
      if (isGroup) onGroupDragStart?.();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const onMovePtr = (ev: PointerEvent) => {
        const p = net.DOMtoCanvas({ x: ev.clientX - hostLeft(), y: ev.clientY - hostTop() });
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        for (const s of starts) onMove(s.id, s.x + dx, s.y + dy);
        if (isGroup) onGroupDrag?.(dx, dy);
      };
      const finish = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', onMovePtr);
        target.removeEventListener('pointerup', finish);
        target.removeEventListener('pointercancel', finish);
        target.releasePointerCapture(ev.pointerId);
        if (isGroup) onGroupDragEnd?.();
      };
      target.addEventListener('pointermove', onMovePtr);
      target.addEventListener('pointerup', finish);
      target.addEventListener('pointercancel', finish);
    },
    [networkRef, onMove, selectedIds, onGroupDragStart, onGroupDrag, onGroupDragEnd, onBeginAction],
  );

  // --- Ресайз за ручку ---
  const startResize = useCallback(
    (e: ReactPointerEvent, id: string, dir: HandleDir) => {
      const net = networkRef.current;
      if (!net) return;
      e.preventDefault();
      e.stopPropagation();
      const v = boxesRef.current.find((b) => b.id === id);
      if (!v) return;
      onBeginAction?.(); // один снимок истории на весь ресайз
      const startWorld = net.DOMtoCanvas({ x: e.clientX - hostLeft(), y: e.clientY - hostTop() });
      const orig = {
        left: v.x - (v.w ?? 0) / 2,
        top: v.y - (v.h ?? 0) / 2,
        right: v.x + (v.w ?? 0) / 2,
        bottom: v.y + (v.h ?? 0) / 2,
      };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const onMovePtr = (ev: PointerEvent) => {
        const p = net.DOMtoCanvas({ x: ev.clientX - hostLeft(), y: ev.clientY - hostTop() });
        const ddx = p.x - startWorld.x;
        const ddy = p.y - startWorld.y;
        let { left, top, right, bottom } = orig;
        if (dir.includes('w')) left = Math.min(orig.left + ddx, right - MIN_BOX_SIZE);
        if (dir.includes('e')) right = Math.max(orig.right + ddx, left + MIN_BOX_SIZE);
        if (dir.includes('n')) top = Math.min(orig.top + ddy, bottom - MIN_BOX_SIZE);
        if (dir.includes('s')) bottom = Math.max(orig.bottom + ddy, top + MIN_BOX_SIZE);
        const w = right - left;
        const h = bottom - top;
        onResize(id, { x: (left + right) / 2, y: (top + bottom) / 2, w, h });
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
    [networkRef, onResize, onBeginAction],
  );

  return (
    <div className="vertex-boxes" aria-hidden={false}>
      {/* Весь слой — в мировых координатах, одна CSS-трансформация под камеру vis */}
      <div
        className="vertex-boxes__layer"
        style={{ transform: cameraTransform(camera), transformOrigin: '0 0' }}
      >
        {/* Области соединения точечных вершин (круги, мировые координаты) */}
        {showConnectArea &&
          points.map((v) => {
            const r = POINT_VERTEX_RADIUS + CONNECT_RADIUS;
            return (
              <span
                key={`area-${v.id}`}
                className="vertex-box__connect-area vertex-box__connect-area--point"
                style={{ left: v.x - r, top: v.y - r, width: r * 2, height: r * 2 }}
              />
            );
          })}
        {boxes.map((v) => {
          const w = v.w ?? 0;
          const h = v.h ?? 0;
          const selected = selectedIds.includes(v.id);
          const highlighted = highlightId === v.id;
          const color = getMarkerColor(v.kind);
          return (
            <div key={v.id} className="vertex-box-item">
              {showConnectArea && (
                <span
                  className="vertex-box__connect-area"
                  style={{
                    left: v.x - w / 2 - CONNECT_RADIUS,
                    top: v.y - h / 2 - CONNECT_RADIUS,
                    width: w + CONNECT_RADIUS * 2,
                    height: h + CONNECT_RADIUS * 2,
                    borderColor: color,
                  }}
                />
              )}
              <div
                className={`vertex-box${selected ? ' is-selected' : ''}${highlighted ? ' is-snap-target' : ''}`}
                style={{
                  left: v.x - w / 2,
                  top: v.y - h / 2,
                  width: w,
                  height: h,
                  // Цвет передаём в CSS-переменную: фон/тени рисует CSS (объём)
                  ['--vertex-color' as string]: color,
                  borderColor: color,
                }}
                onPointerDown={(e) => {
                  // Не сбрасываем выделение, если кликнули по уже выделенному
                  // объекту — иначе групповой перенос терялся бы. Клик по
                  // НЕвыделенному объекту (без Shift) выделяет только его.
                  if (!selectedIds.includes(v.id)) {
                    onSelect?.(v.id, e.shiftKey);
                  } else if (e.shiftKey) {
                    // Shift по выделенному — снять с выделения (toggle)
                    onSelect?.(v.id, true);
                  }
                  startMove(e, v.id);
                }}
              >
                {VERTEX_ICON[v.kind] && (
                  <img
                    className="vertex-box__icon"
                    src={VERTEX_ICON[v.kind]}
                    alt=""
                    draggable={false}
                  />
                )}
                {showLabels && <span className="vertex-box__label">{v.label}</span>}
                {HANDLES.map((dir) => (
                  <span
                    key={dir}
                    className={`vertex-box__handle vertex-box__handle--${dir}`}
                    style={{ cursor: CURSOR[dir] }}
                    onPointerDown={(e) => startResize(e, v.id, dir)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Левый край host-контейнера карты (для приведения client-координат к canvas). */
function hostLeft(): number {
  const el = document.querySelector('.map-viewport__canvas');
  return el ? el.getBoundingClientRect().left : 0;
}
function hostTop(): number {
  const el = document.querySelector('.map-viewport__canvas');
  return el ? el.getBoundingClientRect().top : 0;
}
