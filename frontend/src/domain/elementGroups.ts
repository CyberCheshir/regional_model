/**
 * Domain Layer: Группировка и проекции элементов модели.
 *
 * Единый источник истины для классификации и проекций доменных сущностей:
 *  - Группы элементов (`ObjectTreeData`) для дерева объектов (`LeftSidebar`);
 *  - Список объектов (`ModelObject`) для таблицы объектов (`ObjectsTab`);
 *  - Связи (`ConnectionItem`) для вкладки топологии и связей (`ConnectionsTab`).
 *
 * Любое изменение классификации, структуры или типов сущностей в доменном слое
 * автоматически и синхронно отражается во всех интерфейсных модулях.
 */
import type { ObjectCategory, ModelObject, ConnectionItem } from '../features/dataModule/types';
import type { ObjectTreeData, TreeNodeData, TreeNodeKind } from '../features/objectTree/types';

export type DomainEntityKind = TreeNodeKind;

export type DomainCategory = ObjectCategory;

export type DomainEntityMeta = {
  kind: DomainEntityKind;
  category: DomainCategory;
  typeClass: string;
  defaultGroupLabel: string;
  groupId: string;
};

/**
 * Доменная карта метаданных по типам сущностей.
 * При добавлении нового типа сущности в модель достаточно прописать его сюда,
 * и он автоматически появится в дереве, таблице объектов и фильтрах.
 */
export const DOMAIN_KIND_META: Record<DomainEntityKind, DomainEntityMeta> = {
  wellpad: {
    kind: 'wellpad',
    category: 'Объект добычи',
    typeClass: 'Кустовая площадка',
    defaultGroupLabel: 'Объекты добычи',
    groupId: 'group-wellpads',
  },
  facility: {
    kind: 'facility',
    category: 'Площадной объект',
    typeClass: 'Объект подготовки',
    defaultGroupLabel: 'Объекты подготовки',
    groupId: 'group-facilities',
  },
  'delivery-point': {
    kind: 'delivery-point',
    category: 'Площадной объект',
    typeClass: 'Сдача нефти',
    defaultGroupLabel: 'Точки поставки',
    groupId: 'group-delivery',
  },
  pipeline: {
    kind: 'pipeline',
    category: 'Трубопровод',
    typeClass: 'Трубопровод',
    defaultGroupLabel: 'Трубопроводы',
    groupId: 'group-pipelines',
  },
  segment: {
    kind: 'segment',
    category: 'Трубопровод',
    typeClass: 'Сегмент трубопровода',
    defaultGroupLabel: 'Трубопроводы',
    groupId: 'group-pipelines',
  },
  node: {
    kind: 'node',
    category: 'Узел',
    typeClass: 'Врезка',
    defaultGroupLabel: 'Врезки',
    groupId: 'group-taps',
  },
};

export type ElementGroupsInput = {
  vertices: Array<{ id: string; label: string; kind: 'wellpad' | 'facility' | 'delivery-point' }>;
  pipelines: Array<{ id: string; label: string }>;
  segments: Array<{
    id: string;
    label?: string;
    pipelineId: string | null;
    startNodeId?: string;
    endNodeId?: string;
    fluid?: string;
    pipelineClass?: string;
  }>;
  taps: Array<{ id: string; label: string; edgeId?: string }>;
};

/**
 * Подпись количества сегментов трубопровода (с учётом склонения).
 */
export function segmentCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = 'сегментов';
  if (mod10 === 1 && mod100 !== 11) word = 'сегмент';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'сегмента';
  return `${count} ${word}`;
}

/**
 * Собирает группы элементов дерева из спроектированных доменных сущностей.
 */
export function buildElementGroups({
  vertices,
  pipelines,
  segments,
  taps,
}: ElementGroupsInput): ObjectTreeData[] {
  const groups: ObjectTreeData[] = [];

  const byKind = (kind: 'wellpad' | 'facility' | 'delivery-point') =>
    vertices
      .filter((v) => v.kind === kind)
      .map((v) => ({
        id: v.id,
        label: v.label,
        kind: v.kind as TreeNodeData['kind'],
        subType: DOMAIN_KIND_META[v.kind]?.typeClass,
      }));

  const wellpads = byKind('wellpad');
  const facilities = byKind('facility');
  const deliveryPoints = byKind('delivery-point');
  const tapNodes: TreeNodeData[] = (taps || []).map((t) => ({
    id: t.id,
    label: t.label,
    kind: 'node' as const,
    subType: 'Врезка',
  }));

  const appendToGroup = (groupId: string, groupLabel: string, nodes: TreeNodeData[]) => {
    if (nodes.length === 0) return;
    const existing = groups.find((g) => g.id === groupId);
    if (existing) {
      const existingIds = new Set(existing.children.map((c) => c.id));
      for (const node of nodes) {
        if (!existingIds.has(node.id)) {
          existing.children.push(node);
        }
      }
    } else {
      groups.push({ id: groupId, label: groupLabel, children: [...nodes] });
    }
  };

  appendToGroup(DOMAIN_KIND_META.wellpad.groupId, DOMAIN_KIND_META.wellpad.defaultGroupLabel, wellpads);
  appendToGroup(DOMAIN_KIND_META.facility.groupId, DOMAIN_KIND_META.facility.defaultGroupLabel, facilities);
  appendToGroup(DOMAIN_KIND_META['delivery-point'].groupId, DOMAIN_KIND_META['delivery-point'].defaultGroupLabel, deliveryPoints);
  appendToGroup(DOMAIN_KIND_META.node.groupId, DOMAIN_KIND_META.node.defaultGroupLabel, tapNodes);

  // Трубопроводы БЕЗ сегментов в дерево не попадают
  const segmentsOfPipeline = (pipelineId: string) =>
    segments.filter((s) => s.pipelineId === pipelineId);

  const pipelinesWithSegments = pipelines.filter((p) => segmentsOfPipeline(p.id).length > 0);
  if (pipelinesWithSegments.length > 0) {
    const pipeNodes: TreeNodeData[] = pipelinesWithSegments.map((p) => {
      const own = segmentsOfPipeline(p.id);
      return {
        id: p.id,
        label: p.label,
        kind: 'pipeline' as const,
        subType: segmentCountLabel(own.length),
        children: own.map((seg) => ({
          id: seg.id,
          label: seg.label || 'Сегмент',
          kind: 'segment' as const,
          subType: DOMAIN_KIND_META.segment.typeClass,
        })),
      };
    });
    appendToGroup(DOMAIN_KIND_META.pipeline.groupId, DOMAIN_KIND_META.pipeline.defaultGroupLabel, pipeNodes);
  }

  return groups;
}

/**
 * Проекция: формирует список объектов для таблицы «Объекты» из групп элементов.
 */
export function buildModelObjects(
  groups: ObjectTreeData[],
  defaultsById?: Map<string, Partial<ModelObject>>,
): ModelObject[] {
  const result: ModelObject[] = [];

  for (const group of groups) {
    for (const node of group.children) {
      // Сегменты трубопроводов не являются отдельными строками таблицы верхнего уровня
      if (node.kind === 'segment') continue;
      const meta = DOMAIN_KIND_META[node.kind];
      const defaultData = defaultsById?.get(node.id);

      result.push({
        id: node.id,
        name: node.label,
        category: (defaultData?.category as ObjectCategory) ?? meta?.category ?? 'Площадной объект',
        typeClass: defaultData?.typeClass ?? meta?.typeClass ?? node.subType ?? '',
        period: defaultData?.period ?? '',
        source: defaultData?.source ?? '',
        status: defaultData?.status ?? '',
        owner: defaultData?.owner ?? '',
        condition: defaultData?.condition ?? 'Работает',
        kind: node.kind,
      });
    }
  }

  return result;
}

/**
 * Проекция: формирует список топологических связей из графа модели.
 */
export function buildModelConnections(input: ElementGroupsInput): ConnectionItem[] {
  const { segments, pipelines, vertices, taps } = input;
  const vertexMap = new Map<string, string>();
  for (const v of vertices) vertexMap.set(v.id, v.label);
  for (const t of taps) vertexMap.set(t.id, t.label);

  const pipelineMap = new Map<string, string>();
  for (const p of pipelines) pipelineMap.set(p.id, p.label);

  const connections: ConnectionItem[] = [];

  for (const seg of segments) {
    const fromLabel = (seg.startNodeId && vertexMap.get(seg.startNodeId)) || 'Узел';
    const toLabel = (seg.endNodeId && vertexMap.get(seg.endNodeId)) || 'Узел';
    const pipeLabel = (seg.pipelineId && pipelineMap.get(seg.pipelineId)) || seg.label || 'Сегмент';
    const isLogical = seg.pipelineClass === 'logical';

    connections.push({
      id: `conn-${seg.id}`,
      from: fromLabel,
      flowType: isLogical ? 'Логический поток' : pipeLabel,
      to: toLabel,
      productClass: isLogical ? 'Продукция' : (seg.fluid || 'Нефть'),
      period: '2026–2040',
      status: 'Корректно',
    });
  }

  return connections;
}
