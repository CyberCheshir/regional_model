import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Network } from 'vis-network';
import type { MapEdgeData } from './mapData';
import { getFluidColor } from './mapColors';
import './EdgeDataBadges.css';

export type EdgeDataBadgesProps = {
  /** Императивный экземпляр vis-network (позиции/масштаб берём из него) */
  networkRef: MutableRefObject<Network | null>;
  /** Видимые рёбра, для которых рисуются метки расхода */
  edges: MapEdgeData[];
  /** Глобальный переключатель «Подписи объектов» */
  visible: boolean;
};

type BadgePosition = { id: string; left: number; top: number; flowLabel: string; fluid: MapEdgeData['fluid'] };

/** LOD: ниже этого масштаба метки расхода скрываются (слишком плотная сеть) */
export const BADGES_MIN_SCALE = 0.5;

/**
 * Метки расхода на рёбрах (README 6.3). Позиции вычисляются из
 * императивного состояния vis-network (середина ребра в DOM-координатах)
 * и обновляются на events 'zoom'/'dragging'/'redraw' через rAF.
 * Живут в DOM-слое поверх прозрачного canvas — стили контролируем сами.
 */
export function EdgeDataBadges({ networkRef, edges, visible }: EdgeDataBadgesProps) {
  const [positions, setPositions] = useState<BadgePosition[]>([]);
  const frameRef = useRef<number>(0);

  const edgeMap = useMemo(() => new Map(edges.map((e) => [e.id, e])), [edges]);

  useEffect(() => {
    if (!visible) {
      setPositions([]);
      return;
    }

    const recompute = () => {
      const net = networkRef.current;
      if (!net) return;
      // LOD: на дальнем зуме метки не показываем
      if (net.getScale() < BADGES_MIN_SCALE) {
        setPositions([]);
        return;
      }
      const edgeIds = Array.from(edgeMap.keys());
      // Середина ребра = середина отрезка между позициями конечных узлов (в координатах сети),
      // затем конвертация в DOM-координаты через canvasToDOM.
      const nodePositions = net.getPositions(edgeIds.flatMap((id) => {
        const e = edgeMap.get(id);
        return e ? [e.from, e.to] : [];
      }));
      const next: BadgePosition[] = [];
      for (const id of edgeIds) {
        const e = edgeMap.get(id);
        if (!e) continue;
        const from = nodePositions[e.from];
        const to = nodePositions[e.to];
        if (!from || !to) continue;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const dom = net.canvasToDOM({ x: mx, y: my });
        next.push({ id, left: dom.x, top: dom.y, flowLabel: e.flowLabel, fluid: e.fluid });
      }
      setPositions(next);
    };

    // Пересчёт при событиях камеры + лёгкий rAF-троттлинг
    const schedule = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(recompute);
    };
    const net = networkRef.current;
    const eventNames: Array<'zoom' | 'dragging' | 'afterDrawing'> = ['zoom', 'dragging', 'afterDrawing'];
    if (net) {
      eventNames.forEach((name) => net.on(name, schedule));
    }
    recompute();
    return () => {
      if (net) eventNames.forEach((name) => net.off(name, schedule));
      cancelAnimationFrame(frameRef.current);
    };
  }, [visible, edgeMap, networkRef]);

  if (!visible) return null;

  return (
    <div className="edge-badges" aria-hidden="true">
      {positions.map((p) => (
        <span
          key={p.id}
          className="edge-badge"
          style={{ left: p.left, top: p.top, borderColor: getFluidColor(p.fluid) }}
        >
          {p.flowLabel}
        </span>
      ))}
    </div>
  );
}
