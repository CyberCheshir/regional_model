import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Edge, Network } from 'vis-network';
import './FlowAnimation.css';

export type FlowAnimationProps = {
  /** Императивный экземпляр vis-network */
  networkRef: MutableRefObject<Network | null>;
  /** Полный набор рёбер карты (для разрешения from/to) */
  edges: Edge[];
  /** Включена ли анимация потока (тумблер «Анимация потока» в настройках) */
  enabled: boolean;
  /** Скорость: доля длины ребра в секунду */
  speedPerSec?: number;
};

/** Базовая геометрия бегущих точек (в мировых единицах, × scale). */
/** Радиус точки */
const DOT_RADIUS = 2.5;
/** Шаг между точками (расстояние между центрами соседних точек) */
const DOT_STEP = 18;

/** Цвет бегущих точек (поверх рёбер) — белый. */
const DOT_COLOR = '#ffffff';

/**
 * Порог LOD: при масштабе ≤ 30% анимацию потока не рисуем — точки становятся
 * слишком мелким/шумным и нечитаемо сливаются. Вместо анимации рёбра остаются
 * как есть (сплошные).
 */
const MIN_SCALE_FOR_FLOW = 0.3;

/**
 * Слой «анимации потока»: по всем рёбрам бегут ТОЧКИ в направлении from → to.
 * vis-network не умеет анимировать рёбра, поэтому рисуем поверх карты на
 * отдельном canvas в rAF-цикле.
 *
 * Включается тумблером «Анимация потока»; при выключении рёбра остаются
 * сплошными линиями (этот слой не рендерится).
 */
export function FlowAnimation({
  networkRef,
  edges,
  enabled,
  speedPerSec = 0.6,
}: FlowAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const net = networkRef.current;
    if (!enabled || !canvas || !net) return;

    const host = document.querySelector('.map-viewport__canvas') as HTMLElement | null;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = host?.clientWidth ?? canvas.clientWidth;
      const h = host?.clientHeight ?? canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const graph = networkRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx || !graph) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scale = graph.getScale();
      // LOD: при сильном отдалении (≤ 30%) анимацию не рисуем.
      if (scale <= MIN_SCALE_FOR_FLOW) {
        raf = requestAnimationFrame(draw);
        return;
      }

      // Геометрия точек пропорциональна масштабу карты — при отдалении
      // точки уменьшаются вместе с рёбрами (анимация «привязана» к размеру графа).
      const dotRadius = Math.max(0.8, DOT_RADIUS * scale);
      const dotStep = Math.max(6, DOT_STEP * scale);
      ctx.fillStyle = DOT_COLOR;

      // Фаза движения точек вдоль ребра (смещение по шагу).
      // Точки бегут от начала (a) к концу (b).
      phaseRef.current = (phaseRef.current + dt * speedPerSec * dotStep) % dotStep;

      for (const edge of edgesRef.current) {
        const from = graph.getPositions([String(edge.from)])[String(edge.from)];
        const to = graph.getPositions([String(edge.to)])[String(edge.to)];
        if (!from || !to) continue;
        const a = graph.canvasToDOM({ x: from.x, y: from.y });
        const b = graph.canvasToDOM({ x: to.x, y: to.y });
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const ux = dx / len;
        const uy = dy / len;
        // Точки с шагом dotStep, фаза сдвигает их вдоль ребра к концу
        for (let s = phaseRef.current; s < len; s += dotStep) {
          ctx.beginPath();
          ctx.arc(a.x + ux * s, a.y + uy * s, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);
    const names = ['zoom', 'dragEnd'] as const;
    names.forEach((n) => net.on(n, resize));

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      names.forEach((n) => net.off(n, resize));
    };
  }, [enabled, networkRef, speedPerSec]);

  if (!enabled) return null;

  return <canvas ref={canvasRef} className="flow-animation" aria-hidden="true" />;
}
