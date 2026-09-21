import { useEffect, useRef } from 'react';
import { graphPointToScreen } from './geo';
import type { DrawnSegment } from './drawingTypes';
import './FlowAnimation.css';

export type GeoFlowAnimationProps = {
  /** Гео-рёбра (сегменты) в мировых координатах (м) */
  segments: DrawnSegment[];
  /** Камера чистой карты (для перевода мировых точек в экран) */
  camera: { originX: number; originY: number; zoom: number } | null;
  /** Включена ли анимация потока (тумблер «Анимация потока» в настройках) */
  enabled: boolean;
  /** Скорость: доля длины ребра в секунду */
  speedPerSec?: number;
};

/** Радиус точки (px на экране). */
const DOT_RADIUS = 2.5;
/** Шаг между точками (px на экране). */
const DOT_STEP = 18;
/** Цвет бегущих точек (поверх рёбер) — белый. */
const DOT_COLOR = '#ffffff';

/**
 * Порог LOD анимации потока: при зуме < 8 (обзорный масштаб) анимацию НЕ
 * рисуем — точки мелкие и шумные; при зуме >= 8 («> zoom 8») анимация включена.
 */
const MIN_ZOOM_FOR_FLOW = 8;

/**
 * Слой «анимации потока» для ЧИСТОЙ гео-карты (Вариант 2): по всем гео-рёбрам
 * бегут ТОЧКИ в направлении from → to. Рисуем на отдельном canvas в rAF-цикле,
 * координаты берём из камеры (originPx + zoom), а не из vis.
 */
export function GeoFlowAnimation({
  segments,
  camera,
  enabled,
  speedPerSec = 0.6,
}: GeoFlowAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ctx = canvas.getContext('2d');
      const cam = cameraRef.current;
      if (!ctx || !cam) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // LOD: ниже порога (zoom < 8) анимацию не рисуем (мелко и шумно).
      // При zoom >= 8 — анимация включена.
      if (cam.zoom < MIN_ZOOM_FOR_FLOW) {
        raf = requestAnimationFrame(draw);
        return;
      }

      ctx.fillStyle = DOT_COLOR;
      // Фаза движения точек вдоль ребра (смещение по шагу).
      phaseRef.current = (phaseRef.current + dt * speedPerSec * DOT_STEP) % DOT_STEP;

      for (const seg of segmentsRef.current) {
        const a = graphPointToScreen(seg.from, cam);
        const b = graphPointToScreen(seg.to, cam);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const ux = dx / len;
        const uy = dy / len;
        // Точки с шагом DOT_STEP, фаза сдвигает их вдоль ребра к концу.
        for (let s = phaseRef.current; s < len; s += DOT_STEP) {
          ctx.beginPath();
          ctx.arc(a.x + ux * s, a.y + uy * s, DOT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [enabled, speedPerSec]);

  if (!enabled) return null;

  return <canvas ref={canvasRef} className="flow-animation flow-animation--geo" aria-hidden="true" />;
}
