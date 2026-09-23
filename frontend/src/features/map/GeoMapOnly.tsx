import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  TILE_MAX_ZOOM,
  TILE_MIN_ZOOM,
  TILE_SIZE,
  lngLatToWorldPixel,
  worldPixelToLngLat,
} from './geo';
import type { Basemap } from '../displaySettings/types';
import './GeoMapOnly.css';

export type GeoMapOnlyProps = {
  /** Подложка: topo — OSM, satellite — спутниковые снимки */
  basemap: Basemap;
  /** Начальный гео-зум (тайловый) */
  initialZoom?: number;
  /** Центр карты (по умолчанию MAP_CENTER) */
  center?: { lng: number; lat: number };
  /** Режим разработчика — показывать отладочную информацию (координаты) */
  devMode?: boolean;
  /** Служебный контент поверх тайлов (граф, подписи и т.п.) */
  children?: React.ReactNode;
  /**
   * Отчёт о камере: origin (мировой пиксель в левом-верхнем углу), zoom, размер.
   * Позволяет внешним оверлеям переводить lng/lat ↔ экранные пиксели.
   */
  onCamera?: (cam: { originX: number; originY: number; zoom: number; w: number; h: number }) => void;
  /** Клик ЛКМ по карте: координаты точки (lng/lat) */
  onMapClick?: (lng: number, lat: number) => void;
  /**
   * Движение курсора над картой: экранная точка (px от левого-верхнего угла)
   * или null, когда курсор ушёл с карты. Нужно для «призрака» создаваемого элемента.
   */
  onCursorMove?: (screen: { x: number; y: number } | null) => void;
  /**
   * Разрешено ли панорамирование обычной ЛКМ (перетаскиванием). Обычно — да;
   * выключается, когда активен инструмент создания (тогда ЛКМ создаёт элемент).
   */
  panEnabled?: boolean;
  /**
   * Точка, к которой нужно перенести камеру (например, выбранный в дереве объект),
   * если она вне поля видимости. Смена значения (по lng/lat) запускает фокусировку.
   */
  focus?: { lng: number; lat: number } | null;
};

/** URL-шаблоны тайлов (XYZ). Для `none` тайлов нет — пустой серый фон. */
const TILE_URL: Partial<Record<Basemap, string>> = {
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  topo: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

type Tile = { key: string; url: string; left: number; top: number };

/**
 * Чистая гео-карта (без vis-network): ковёр растровых тайлов с собственным
 * зумом (колесо к курсору) и панорамированием ОБЫЧНОЙ ЛКМ (перетаскивание).
 * Когда активен инструмент создания, панорамирование отключается
 * (`panEnabled=false`) — ЛКМ тогда создаёт элемент. Служит базой для графа.
 */
export function GeoMapOnly({
  basemap,
  initialZoom = MAP_INITIAL_ZOOM,
  center = MAP_CENTER,
  devMode = false,
  children,
  onCamera,
  onMapClick,
  onCursorMove,
  panEnabled = true,
  focus = null,
}: GeoMapOnlyProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(initialZoom);
  // Мировой пиксель (Web Mercator на текущем зуме) в ЛЕВОМ-ВЕРХНЕМ углу экрана.
  // Центрируем точку `center` — origin вычислим после узнания размера контейнера.
  const [originPx, setOriginPx] = useState(() => {
    const c = lngLatToWorldPixel(center.lng, center.lat, initialZoom);
    return { x: c.x, y: c.y };
  });
  const centeredRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  // Контекстное меню (dev-режим, ПКМ): экранная позиция + гео-координаты точки
  const [contextMenu, setContextMenu] = useState<
    { sx: number; sy: number; lng: number; lat: number } | null
  >(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  // Актуальный колбэк движения курсора (без пересоздания обработчиков)
  const onCursorMoveRef = useRef(onCursorMove);
  onCursorMoveRef.current = onCursorMove;

  // Размер контейнера
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Однократно центрируем карту в середине экрана (Нижневартовск).
  useEffect(() => {
    if (centeredRef.current || size.w === 0 || size.h === 0) return;
    const c = lngLatToWorldPixel(center.lng, center.lat, zoom);
    setOriginPx({ x: c.x - size.w / 2, y: c.y - size.h / 2 });
    centeredRef.current = true;
  }, [size, zoom, center]);

  // Фокусировка на точке (например, выбранный в дереве объект/трубопровод):
  // если точка за пределами видимой области — переносим камеру так, чтобы она
  // оказалась в центре. Если точка уже видна — камеру не трогаем.
  //
  // ВАЖНО: эффект зависит ТОЛЬКО от смены цели (focusKey), а не от zoom/
  // originPx — иначе при зуме камера каждый раз прыгала бы к выбранному
  // объекту, мешая приближать нужное место вручную.
  const focusKey = focus ? `${focus.lng},${focus.lat}` : null;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const originPxRef = useRef(originPx);
  originPxRef.current = originPx;
  useEffect(() => {
    if (!focus || size.w === 0 || size.h === 0) return;
    const z = zoomRef.current;
    const o = originPxRef.current;
    const wp = lngLatToWorldPixel(focus.lng, focus.lat, z);
    const visible =
      wp.x >= o.x && wp.x <= o.x + size.w && wp.y >= o.y && wp.y <= o.y + size.h;
    if (visible) return;
    setOriginPx({ x: wp.x - size.w / 2, y: wp.y - size.h / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реакция именно на смену цели
  }, [focusKey, size.w, size.h]);

  // Пересборка тайлов при смене зума/смещения/размера/подложки
  useEffect(() => {
    // Подложка «без тайлов» — пустое полотно, тайлы не грузим.
    const template = TILE_URL[basemap];
    if (!template) {
      setTiles([]);
      return;
    }
    const { w, h } = size;
    const max = Math.pow(2, zoom);
    const x0 = Math.floor(originPx.x / TILE_SIZE);
    const x1 = Math.floor((originPx.x + w) / TILE_SIZE);
    const y0 = Math.floor(originPx.y / TILE_SIZE);
    const y1 = Math.floor((originPx.y + h) / TILE_SIZE);
    const next: Tile[] = [];
    for (let tx = x0; tx <= x1; tx += 1) {
      for (let ty = y0; ty <= y1; ty += 1) {
        if (ty < 0 || ty >= max) continue;
        const wrapX = ((tx % max) + max) % max;
        next.push({
          key: `${zoom}/${wrapX}/${ty}`,
          url: template
            .replace('{z}', String(zoom))
            .replace('{x}', String(wrapX))
            .replace('{y}', String(ty)),
          left: tx * TILE_SIZE - originPx.x,
          top: ty * TILE_SIZE - originPx.y,
        });
      }
    }
    setTiles(next);
  }, [zoom, originPx, size, basemap]);

  // Отчёт о камере внешним оверлеям (граф, подписи) при любом изменении вида
  useEffect(() => {
    onCamera?.({
      originX: originPx.x,
      originY: originPx.y,
      zoom,
      w: size.w,
      h: size.h,
    });
  }, [originPx, zoom, size, onCamera]);

  // Зум колесом — к позиции курсора
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const dir = e.deltaY < 0 ? 1 : -1;
      const nextZoom = Math.max(TILE_MIN_ZOOM, Math.min(TILE_MAX_ZOOM, zoom + dir));
      const k = Math.pow(2, nextZoom - zoom);
      // Мировая точка под курсором до зума:
      const wx = originPx.x + mx;
      const wy = originPx.y + my;
      // При новом зуме мировой масштаб меняется в k раз; удерживаем точку под курсором
      setOriginPx({
        x: wx * k - mx,
        y: wy * k - my,
      });
      setZoom(nextZoom);
    },
    [zoom, originPx],
  );

  // Панорамирование перетаскиванием (и различение «клик» vs «drag»)
  const movedRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Shift+ЛКМ зарезервировано под ЛАССО-выделение (обрабатывается в GeoGraphLayer) —
    // панорамирование в этом случае НЕ начинаем, иначе карта перехватила бы указатель.
    if (e.shiftKey) return;
    // Панорамирование — обычной ЛКМ (перетаскиванием). Отключается, когда активен
    // инструмент создания (panEnabled=false) — тогда ЛКМ создаёт элемент, а не тащит.
    if (panEnabled) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY, ox: originPx.x, oy: originPx.y };
      setPanning(true);
    }
    movedRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    // Трекаем позицию курсора (для окна координат и «призрака»)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const next = { x: e.clientX - r.left, y: e.clientY - r.top };
    setCursor(next);
    onCursorMoveRef.current?.(next);
    const d = dragRef.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) movedRef.current = true;
    setOriginPx({ x: d.ox - (e.clientX - d.x), y: d.oy - (e.clientY - d.y) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = movedRef.current;
    const wasPanning = dragRef.current !== null;
    dragRef.current = null;
    setPanning(false);
    if (wasPanning) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      // Панорамирование стартовало по ЛКМ, но без движения — это КЛИК по карте
      // (например, снятие выделения). Движение было — просто завершаем пан.
      if (wasDrag) return;
    }
    // Shift-жест — это ЛАССО-выделение (обрабатывается в GeoGraphLayer):
    // НЕ считаем его кликом по карте, иначе onMapClick снял бы только что
    // установленное лассо-выделение.
    if (e.shiftKey) return;
    // ПКМ (и другие не-левые кнопки) — НЕ клик-создание: правый клик завершает
    // режим создания (см. cancelDrawing), элемент не создаётся.
    if (e.button !== 0) return;
    // Клик (не перетаскивание) — сообщаем координаты точки
    if (!wasDrag) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const g = worldPixelToLngLat(originPx.x + (e.clientX - r.left), originPx.y + (e.clientY - r.top), zoom);
      onMapClick?.(g.lng, g.lat);
    }
  };
  const onPointerLeave = () => {
    setCursor(null);
    onCursorMoveRef.current?.(null);
  };

  // ПКМ в dev-режиме — контекстное меню с координатами точки
  const onContextMenu = (e: React.MouseEvent) => {
    if (!devMode) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const g = worldPixelToLngLat(originPx.x + mx, originPx.y + my, zoom);
    setContextMenu({ sx: mx, sy: my, lng: g.lng, lat: g.lat });
  };

  const copyCoords = async () => {
    if (!contextMenu) return;
    const text = `${contextMenu.lat.toFixed(6)}, ${contextMenu.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Фолбэк, если clipboard API недоступен (не https / нет разрешения)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setContextMenu(null);
  };

  // Обратный расчёт центра для отображения подписи (не обязателен, для отладки)
  const centerPx = { x: originPx.x + size.w / 2, y: originPx.y + size.h / 2 };
  const centerGeo = worldPixelToLngLat(centerPx.x, centerPx.y, zoom);

  // Гео-координаты под курсором (как в dev-режиме)
  const cursorGeo = cursor
    ? worldPixelToLngLat(originPx.x + cursor.x, originPx.y + cursor.y, zoom)
    : null;

  // Закрытие контекстного меню: клик в любом месте / Esc
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  return (
    <div
      ref={hostRef}
      className={`geo-map-only${panning ? ' is-panning' : ''}`}
      data-basemap={basemap}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      role="application"
      aria-label="Карта"
    >
      {tiles.map((t) => (
        <img
          key={t.key}
          className="geo-map-only__tile"
          src={t.url}
          alt=""
          draggable={false}
          style={{ left: t.left, top: t.top, width: TILE_SIZE, height: TILE_SIZE }}
        />
      ))}
      {/* Граф-оверлей (объекты/рёбра), привязанный к гео-координатам */}
      {children}
      {devMode && (
        <div className="geo-map-only__info">
          z{zoom} · центр {centerGeo.lng.toFixed(4)}, {centerGeo.lat.toFixed(4)}
        </div>
      )}

      {/* Контекстное меню (dev-режим, ПКМ) — копирование координат */}
      {devMode && contextMenu && (
        <div
          className="geo-map-only__context-menu"
          style={{ left: contextMenu.sx, top: contextMenu.sy }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="geo-map-only__context-coords">
            {contextMenu.lat.toFixed(6)}, {contextMenu.lng.toFixed(6)}
          </div>
          <button
            type="button"
            className="geo-map-only__context-item"
            onClick={copyCoords}
          >
            Копировать в буфер обмена координаты
          </button>
        </div>
      )}

      {/* Отладочное окно координат под курсором (только в режиме разработчика) */}
      {devMode && cursor && cursorGeo && (
        <div
          className="geo-map-only__coords"
          style={{ left: cursor.x + 14, top: cursor.y + 14 }}
        >
          <div>lng: {cursorGeo.lng.toFixed(6)}</div>
          <div>lat: {cursorGeo.lat.toFixed(6)}</div>
          <div>
            px: {Math.round(originPx.x + cursor.x)}, {Math.round(originPx.y + cursor.y)}
          </div>
          <div>zoom: {zoom}</div>
        </div>
      )}
    </div>
  );
}
