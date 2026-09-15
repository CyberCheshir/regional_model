/**
 * Мок-детали объекта: собираются из данных карты (Этап 6).
 * На Этапе 9 заменяется запросом деталей + zod-валидацией.
 */
import { mockMapEdges, mockMapNodes } from '../map/mapData';
import type { ConnectionItemData, EntityDetails, EntityStatus } from './types';
import type { TreeNodeKind } from '../objectTree/types';

const SUBTYPE_BY_KIND: Record<TreeNodeKind, string> = {
  wellpad: 'Кустовая площадка',
  facility: 'Объект подготовки',
  'delivery-point': 'Точка поставки',
  pipeline: 'Трубопровод',
};

const STATUS_BY_NODE: Record<string, EntityStatus> = {
  'wellpad-1': 'warning',
  'wellpad-2': 'running',
  'facility-ukpg': 'running',
  'facility-upn': 'running',
  'delivery-1': 'running',
  'delivery-2': 'stopped',
};

/** Связи узла по рёбрам карты: исходящие (from=узел) и входящие (to=узел). */
function buildConnections(nodeId: string) {
  const kindOf = (id: string): TreeNodeKind => {
    const node = mockMapNodes.find((n) => n.id === id);
    return node ? node.kind : 'pipeline';
  };
  const map = (edges: typeof mockMapEdges, fromSide: boolean): ConnectionItemData[] =>
    edges.map((e) => {
      const targetId = fromSide ? e.to : e.from;
      const targetNode = mockMapNodes.find((n) => n.id === targetId);
      return {
      id: e.id,
      targetId,
      targetLabel: targetNode ? targetNode.label : targetId,
      targetKind: kindOf(targetId),
      flowType: e.label,
      isLogicalFlow: e.label === 'Продуктопровод',
      fluid: e.fluid,
      };
    });
  return {
    outgoing: map(mockMapEdges.filter((e) => e.from === nodeId), true),
    incoming: map(mockMapEdges.filter((e) => e.to === nodeId), false),
  };
}

export function getEntityDetails(nodeId: string): EntityDetails {
  const node = mockMapNodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new Error(`Unknown entity: ${nodeId}`);
  }
  const { outgoing, incoming } = buildConnections(nodeId);
  return {
    id: node.id,
    label: node.label,
    kind: node.kind,
    subType: SUBTYPE_BY_KIND[node.kind],
    status: STATUS_BY_NODE[node.id] ?? 'running',
    licenseArea: 'Северный ЛУ',
    owner: 'ГПН-3',
    modelStatus: [
      { label: 'Система сбора', value: 'Северный контур', ok: true },
      { label: 'Профиль добычи', value: 'из системы сбора', ok: true },
      { label: 'Результаты ГР', value: '2026–2040', ok: node.warnings === undefined },
    ],
    outgoing,
    incoming,
  };
}
