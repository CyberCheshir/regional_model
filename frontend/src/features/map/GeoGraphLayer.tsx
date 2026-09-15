import { MAP_CENTER, lngLatToWorldPixel } from './geo';
import type { DrawnSegment, MapFitting, MapTap, MapVertex } from './drawingTypes';
import { getMarkerColor } from './mapColors';
import './GeoGraphLayer.css';

export type GeoGraphLayerProps = {
  /** Камера карты: мировой пиксель (на зуме) в левом-верхнем углу + зум */
  camera: { originX: number; originY: number; zoom: number } | null;
  vertices: MapVertex[];
  fittings: MapFitting[];
  taps: MapTap[];
  segments: DrawnSegment[];
  /** id выделенных вершин (подсветка) */
  selectedIds?: readonly string[];
};

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
  selectedIds = [],
}: GeoGraphLayerProps) {
  if (!camera || camera.zoom === 0) return null;

  // Пикселей на метр при текущем зуме (для размеров объектов из метров)
  const cosLat = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
  const pxPerMeter = (256 * Math.pow(2, camera.zoom)) / (40075016.686 * cosLat);

  return (
    <div className="geo-graph-layer" aria-hidden="true">
      {/* Рёбра */}
      <svg className="geo-graph-layer__svg">
        {segments.map((s) => {
          const a = toScreen(s.from.x, s.from.y, camera);
          const b = toScreen(s.to.x, s.to.y, camera);
          return (
            <line
              key={s.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#e11d48"
              strokeWidth={2}
            />
          );
        })}
      </svg>

      {/* Объекты (кусты/УПН/точки) */}
      {vertices.map((v) => {
        const p = toScreen(v.lng, v.lat, camera);
        const w = (v.w ?? 0) * pxPerMeter;
        const h = (v.h ?? 0) * pxPerMeter;
        const selected = selectedIds.includes(v.id);
        return (
          <div
            key={v.id}
            className={`geo-graph-layer__vertex${selected ? ' is-selected' : ''}`}
            style={{
              left: p.x,
              top: p.y,
              width: w || undefined,
              height: h || undefined,
              borderColor: getMarkerColor(v.kind),
              background: `${getMarkerColor(v.kind)}33`,
            }}
          >
            {v.label}
          </div>
        );
      })}

      {/* Тройники */}
      {fittings.map((f) => {
        const p = toScreen(f.lng, f.lat, camera);
        return (
          <span
            key={f.id}
            className="geo-graph-layer__dot geo-graph-layer__dot--tee"
            style={{ left: p.x, top: p.y }}
            title={f.label}
          />
        );
      })}

      {/* Врезки */}
      {taps.map((t) => {
        const p = toScreen(t.lng, t.lat, camera);
        return (
          <span
            key={t.id}
            className="geo-graph-layer__dot geo-graph-layer__dot--tap"
            style={{ left: p.x, top: p.y }}
            title={t.label}
          />
        );
      })}
    </div>
  );
}
