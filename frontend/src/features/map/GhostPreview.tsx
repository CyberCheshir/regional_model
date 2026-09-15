import type { MutableRefObject } from 'react';
import type { Network } from 'vis-network';
import {
  DEFAULT_VERTEX_SIZE,
  isVertexTool,
  type DrawTool,
  type PipelineDraft,
} from './drawingTypes';
import { getMarkerColor } from './mapColors';
import './GhostPreview.css';

export type GhostPreviewProps = {
  tool: DrawTool;
  /** Мировая позиция курсора (или null, если вне карты) */
  ghost: { x: number; y: number } | null;
  /** Черновик полилинии — для предпросмотра ребра от последней точки */
  draft: PipelineDraft;
  networkRef: MutableRefObject<Network | null>;
};

/**
 * Полупрозрачный «призрак» создаваемого элемента под курсором (UX-предпросмотр):
 *  - объект (куст/УПН/точка) — полупрозрачный контур нужного размера;
 *  - сегмент/трубопровод — пунктирная линия от начала к курсору;
 *  - тройник/врезка — полупрозрачная точка.
 *
 * Координаты переводятся в DOM через network.canvasToDOM (следуют за зумом/паном).
 */
export function GhostPreview({ tool, ghost, draft, networkRef }: GhostPreviewProps) {
  const net = networkRef.current;
  if (!ghost || !net) return null;

  // Вершина-объект (прямоугольник по размеру типа)
  if (isVertexTool(tool)) {
    const size = DEFAULT_VERTEX_SIZE[tool];
    const tl = net.canvasToDOM({ x: ghost.x - size.w / 2, y: ghost.y - size.h / 2 });
    const br = net.canvasToDOM({ x: ghost.x + size.w / 2, y: ghost.y + size.h / 2 });
    const color = getMarkerColor(tool);
    return (
      <div className="ghost-preview" aria-hidden="true">
        <div
          className="ghost-preview__box"
          style={{
            left: tl.x,
            top: tl.y,
            width: Math.max(1, br.x - tl.x),
            height: Math.max(1, br.y - tl.y),
            borderColor: color,
            background: `${color}33`,
          }}
        />
      </div>
    );
  }

  // Ребро (сегмент / трубопровод): пунктир от последней точки к курсору
  if (tool === 'segment' || tool === 'pipeline') {
    const anchor = draft.last ?? draft.start;
    const c = net.canvasToDOM(ghost);
    const a = anchor ? net.canvasToDOM(anchor) : null;
    return (
      <div className="ghost-preview" aria-hidden="true">
        <svg className="ghost-preview__svg">
          {a && (
            <line
              x1={a.x}
              y1={a.y}
              x2={c.x}
              y2={c.y}
              stroke="#0066cc"
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.55}
            />
          )}
          <circle cx={c.x} cy={c.y} r={4} fill="#0066cc" opacity={0.5} />
        </svg>
      </div>
    );
  }

  // Тройник / врезка — полупрозрачная точка
  if (tool === 'tee' || tool === 'tap') {
    const c = net.canvasToDOM(ghost);
    const color = tool === 'tee' ? '#94a3b8' : '#7dd3fc';
    return (
      <div className="ghost-preview" aria-hidden="true">
        <span
          className="ghost-preview__dot"
          style={{ left: c.x, top: c.y, background: color }}
        />
      </div>
    );
  }

  return null;
}
