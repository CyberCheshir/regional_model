import { useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import type { Options, Network as NetworkType, Node, Edge, NetworkEvents } from 'vis-network';

/**
 * Интеграция vis-network с React (стек по problem_log: @vis-network/react
 * недоступен, поэтому низкоуровневый хук поверх vis-network).
 *
 * Хук создаёт Network один раз на контейнере и обновляет DataSet'ы при
 * изменении nodes/edges (декларативный стиль вместо императивного API).
 */
export type UseVisNetworkParams = {
  nodes: Node[];
  edges: Edge[];
  options: Options;
  /** Обработчики событий сети (select, click, ...) — переподключаются при изменении */
  events?: Partial<Record<NetworkEvents, (...args: unknown[]) => void>>;
  /** Внешний реф экземпляра сети (если нужен снаружи до вызова хука) */
  networkRef?: React.MutableRefObject<NetworkType | null>;
};

export type UseVisNetworkResult = {
  /** Реф для контейнера (div), в который монтируется canvas сети */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Императивный экземпляр Network (для fit(), focus() и т.п.) */
  networkRef: React.MutableRefObject<NetworkType | null>;
};

export function useVisNetwork({ nodes, edges, options, events, networkRef: externalNetworkRef }: UseVisNetworkParams): UseVisNetworkResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalNetworkRef = useRef<NetworkType | null>(null);
  const networkRef = externalNetworkRef ?? internalNetworkRef;
  const nodesDsRef = useRef<DataSet<Node> | null>(null);
  const edgesDsRef = useRef<DataSet<Edge> | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Создание Network — один раз
  useEffect(() => {
    if (!containerRef.current) return;
    nodesDsRef.current = new DataSet<Node>(nodes);
    edgesDsRef.current = new DataSet<Edge>(edges);
    networkRef.current = new Network(
      containerRef.current,
      { nodes: nodesDsRef.current, edges: edgesDsRef.current },
      options,
    );
    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
      nodesDsRef.current = null;
      edgesDsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Синхронизация данных
  useEffect(() => {
    if (!nodesDsRef.current || !edgesDsRef.current) return;
    const cur = nodesDsRef.current;
    cur.update(nodes);
    const ids = new Set(nodes.map((n) => String(n.id)));
    const removed = cur.getIds().filter((id) => !ids.has(String(id)));
    if (removed.length) cur.remove(removed);
    // Рёбра пересобираем через remove+add: vis DataSet.update мержит поля
    // и не всегда применяет смену опций ребра (например, arrows при
    // переключении «ориентированный граф»). Полная замена гарантирует перерисовку.
    const ec = edgesDsRef.current;
    ec.clear();
    if (edges.length) ec.add(edges);
  }, [nodes, edges]);

  // Подписка на события
  useEffect(() => {
    const net = networkRef.current;
    if (!net || !events) return;
    const handlers = (Object.entries(events) as [NetworkEvents, (...args: unknown[]) => void][]).map(
      ([name]) => {
        const fn = (...args: unknown[]) => eventsRef.current?.[name]?.(...args);
        net.on(name, fn);
        return [name, fn] as const;
      },
    );
    return () => handlers.forEach(([name, fn]) => net.off(name, fn));
    // eventsRef внутри замыкания — повторная подписка при смене объекта events не нужна
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, networkRef };
}
