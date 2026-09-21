import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Network } from 'vis-network';
import {
  MAP_CENTER,
  MAP_METERS_PER_UNIT,
  TILE_MAX_ZOOM,
  TILE_MIN_ZOOM,
  TILE_SIZE,
  graphPointToLngLat,
  lngLatToWorldPixel,
} from './geo';
import type { Basemap } from '../displaySettings/types';
import './BasemapTiles.css';

export type BasemapTilesProps = {
  /** Императивный экземпляр vis-network (камера: scale + viewPosition) */
  networkRef: MutableRefObject<Network | null>;
  /** Активная подложка; 'topo' — OSM, 'satellite' — спутниковые снимки */
  basemap: Basemap;
};

/** URL-шаблоны растровых тайлов по подложкам (XYZ). Для `none` — тайлов нет. */
const TILE_URL: Partial<Record<Basemap, string>> = {
  // Спутниковые снимки (реальные)
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  // Топографическая схема
  topo: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};

type Tile = { key: string; url: string; left: number; top: number; size: number };

/**
 * Растровый тайловый слой ПОД canvas vis-network.
 *
 * Синхронизирован с камерой vis: по видимому центру и масштабу вычисляем, какие
 * тайлы {z}/{x}/{y} попадают в экран, и позиционируем их. Граф (vis) рисуется
 * поверх отдельным (прозрачным по фону) canvas. За счёт этого узлы/рёбра ложатся
 * на реальную гео-карту.
 */
export function BasemapTiles({ networkRef, basemap }: BasemapTilesProps) {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const recompute = () => {
      // Подложка «без тайлов» — ничего не рисуем (пустой фон под графом).
      const template = TILE_URL[basemap];
      if (!template) {
        setTiles([]);
        return;
      }
      const net = networkRef.current;
      const host = document.querySelector('.map-viewport__canvas') as HTMLElement | null;
      if (!net || !host) return;
      const W = host.clientWidth;
      const H = host.clientHeight;
      if (W === 0 || H === 0) return;

      const viewScale = net.getScale();
      const view = net.getViewPosition();

      // Экранная точка (в px) ↔ графическая (world) единица:
      //   screenX = W/2 - viewX*viewScale + gx*viewScale
      // Найдём графическую координату центра экрана и левого-верхнего угла.
      const screenToGraph = (sx: number, sy: number) => ({
        x: (sx - W / 2) / viewScale + view.x,
        y: (sy - H / 2) / viewScale + view.y,
      });

      // Гео-координаты углов видимой области
      const tl = graphPointToLngLat(screenToGraph(0, 0).x, screenToGraph(0, 0).y);
      const br = graphPointToLngLat(screenToGraph(W, H).x, screenToGraph(W, H).y);

      // Подбираем гео-зум: метры на экранный пиксель = metersPerPixel(lat, z)
      const metersPerScreenPx = MAP_METERS_PER_UNIT / viewScale;
      let zoom = Math.round(
        Math.log2(
          (40075016.686 * Math.cos((MAP_CENTER.lat * Math.PI) / 180)) /
          (TILE_SIZE * metersPerScreenPx),
        ),
      );
      zoom = Math.max(TILE_MIN_ZOOM, Math.min(TILE_MAX_ZOOM, zoom));

      // Мировые пиксели тайлов на подобранном зуме для двух углов
      const pTL = lngLatToWorldPixel(tl.lng, tl.lat, zoom);
      const pBR = lngLatToWorldPixel(br.lng, br.lat, zoom);

      // Смещение области в мире (пиксели тайлов) относительно левого-верхнего угла экрана
      const tlWorldX = Math.min(pTL.x, pBR.x);
      const tlWorldY = Math.min(pTL.y, pBR.y);
      const brWorldX = Math.max(pTL.x, pBR.x);
      const brWorldY = Math.max(pTL.y, pBR.y);

      // Диапазон тайловых индексов
      const x0 = Math.floor(tlWorldX / TILE_SIZE);
      const x1 = Math.floor(brWorldX / TILE_SIZE);
      const y0 = Math.floor(tlWorldY / TILE_SIZE);
      const y1 = Math.floor(brWorldY / TILE_SIZE);
      const maxIndex = Math.pow(2, zoom);

      // Экранная позиция края тайлового мира: (tlWorld - виден на экране в позиции 0,0)
      const offsetX = tlWorldX; // мировой пиксель, соответствующий левому краю экрана
      const offsetY = tlWorldY;

      const next: Tile[] = [];
      for (let tx = x0; tx <= x1; tx += 1) {
        for (let ty = y0; ty <= y1; ty += 1) {
          if (ty < 0 || ty >= maxIndex) continue;
          const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
          const left = tx * TILE_SIZE - offsetX;
          const top = ty * TILE_SIZE - offsetY;
          next.push({
            key: `${zoom}/${wrappedX}/${ty}`,
            url: template
              .replace('{z}', String(zoom))
              .replace('{x}', String(wrappedX))
              .replace('{y}', String(ty)),
            left,
            top,
            size: TILE_SIZE,
          });
        }
      }
      setTiles(next);
    };

    const schedule = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(recompute);
    };

    const net = networkRef.current;
    const names: Array<'zoom' | 'dragging' | 'afterDrawing'> = [
      'zoom',
      'dragging',
      'afterDrawing',
    ];
    if (net) names.forEach((n) => net.on(n, schedule));
    window.addEventListener('resize', schedule);
    recompute();

    return () => {
      if (net) names.forEach((n) => net.off(n, schedule));
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frameRef.current);
    };
  }, [networkRef, basemap]);

  return (
    <div className="basemap-tiles" aria-hidden="true">
      {tiles.map((t) => (
        <img
          key={t.key}
          className="basemap-tiles__tile"
          src={t.url}
          alt=""
          draggable={false}
          style={{ left: t.left, top: t.top, width: t.size, height: t.size }}
        />
      ))}
    </div>
  );
}
