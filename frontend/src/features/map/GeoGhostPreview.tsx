import { MAP_CENTER, graphPointToScreen } from './geo';
import {
  DEFAULT_VERTEX_SIZE,
  isEdgeTool,
  isVertexTool,
  type DrainFluid,
  type DrawTool,
  type PipelineClass,
  type PipelineDraft,
} from './drawingTypes';
import { getEdgeColor, getMarkerColor, getPipelineClassStyle } from './mapColors';
import './GhostPreview.css';

export type GeoGhostPreviewProps = {
  /** Активный инструмент (none — призрак не показываем) */
  tool: DrawTool;
  /** Позиция курсора в экранных пикселях (или null, если вне карты) */
  cursor: { x: number; y: number } | null;
  /** Камера чистой карты (для перевода мировых точек в экран) */
  camera: { originX: number; originY: number; zoom: number } | null;
  /** Черновик полилинии — для предпросмотра ребра от последней точки */
  draft: PipelineDraft;
  /** Флюид создаваемого ребра (цвет призрака) */
  fluid?: DrainFluid;
  /** Класс создаваемого ребра (толщина призрака) */
  pipelineClass?: PipelineClass;
};

/** Пикселей на метр при текущем зуме (размеры объектов из метров). */
function pxPerMeterAt(zoom: number): number {
  const cosLat = Math.cos((MAP_CENTER.lat * Math.PI) / 180);
  return (256 * Math.pow(2, zoom)) / (40075016.686 * cosLat);
}

/**
 * Полупрозрачный «призрак» создаваемого элемента на ЧИСТОЙ гео-карте
 * (Вариант 2, без vis): прямоугольник объекта, пунктир ребра от последней
 * точки к курсору или точка тройника/врезки.
 */
export function GeoGhostPreview({
  tool,
  cursor,
  camera,
  draft,
  fluid = 'oil',
  pipelineClass,
}: GeoGhostPreviewProps) {
  if (!cursor || !camera || tool === 'none') return null;

  // Объект (куст / УПН / точка поставки) — контур нужного размера.
  if (isVertexTool(tool)) {
    const size = DEFAULT_VERTEX_SIZE[tool];
    const ppm = pxPerMeterAt(camera.zoom);
    const w = size.w * ppm;
    const h = size.h * ppm;
    const color = getMarkerColor(tool);
    return (
      <div className="ghost-preview" aria-hidden="true">
        <div
          className="ghost-preview__box"
          style={{
            left: cursor.x - w / 2,
            top: cursor.y - h / 2,
            width: Math.max(1, w),
            height: Math.max(1, h),
            borderColor: color,
            background: `${color}33`,
          }}
        />
      </div>
    );
  }

  // Ребро (трубопровод / логический поток): пунктир от последней точки к
  // курсору. Цвет — по флюиду, но для «логического потока» — серый (как у
  // ребра), толщина — по выбранному классу трубопровода.
  if (isEdgeTool(tool)) {
    const anchor = draft.last ?? draft.start;
    const a = anchor ? graphPointToScreen(anchor, camera) : null;
    // Класс: у логического потока — всегда logical, иначе — выбранный.
    const effectiveClass = tool === 'logical-pipeline' ? 'logical' : (pipelineClass ?? draft.pipelineClass);
    const color = getEdgeColor(fluid, effectiveClass);
    const classStyle = getPipelineClassStyle(effectiveClass);
    return (
      <div className="ghost-preview" aria-hidden="true">
        <svg className="ghost-preview__svg">
          {a && (
            <line
              x1={a.x}
              y1={a.y}
              x2={cursor.x}
              y2={cursor.y}
              stroke={color}
              strokeWidth={classStyle.width}
              strokeDasharray="6 4"
              opacity={0.55}
            />
          )}
          <circle cx={cursor.x} cy={cursor.y} r={4} fill={color} opacity={0.5} />
        </svg>
      </div>
    );
  }

  // Тройник / врезка — полупрозрачная точка под курсором.
  if (tool === 'tee' || tool === 'tap') {
    const color = tool === 'tee' ? '#94a3b8' : '#7dd3fc';
    return (
      <div className="ghost-preview" aria-hidden="true">
        <span
          className="ghost-preview__dot"
          style={{ left: cursor.x, top: cursor.y, background: color }}
        />
      </div>
    );
  }

  return null;
}
