/**
 * Domain Layer: Детальная карточка сущности и общие параметры объекта.
 *
 * Единый источник истины для формирования:
 *  - Детальной информации об объекте (`EntityDetails`): наименование, тип, статус, ЛУ, владелец;
 *  - Проверок состояния модели (`modelStatus`: чеклисты валидации);
 *  - Топологических связей объекта (входящие/исходящие потоки);
 *  - Структуры данных панели параметров (`ParameterPanelData`): период работы, профиль, гидравлика, аналитика.
 */
import type {
  AnalyticsData,
  EntityDetails,
  Flow,
  HydraulicCalc,
  ParameterPanelData,
  ParameterPanelKind,
  PipelineClass,
  PipelineInstallation,
  PipelineOwner,
  PipelineRouteCondition,
  PipelineStatus,
  PipelineType,
  ProductProfile,
  ProductType,
  ValidationItem,
  WorkPeriod,
} from './types';
import { DOMAIN_KIND_META } from './elementGroups';

export type EntityDetailsInput = {
  id: string;
  vertices: Array<{
    id: string;
    label: string;
    kind: 'wellpad' | 'facility' | 'delivery-point';
    owner?: string;
    condition?: string;
    period?: string;
    source?: string;
    status?: 'running' | 'warning' | 'stopped';
    licenseArea?: string;
    attributes?: Record<string, unknown>;
  }>;
  pipelines: Array<{
    id: string;
    label: string;
    fluid?: string;
    /** Тип трубопровода для общих параметров. */
    pipelineType?: PipelineType;
    pipelineClass?: PipelineClass;
    /** Протяжённость трубопровода в километрах. */
    lengthKm?: number;
    /** Наружный диаметр трубы в миллиметрах. */
    outerDiameterMm?: number;
    /** Толщина стенки трубы в миллиметрах. */
    wallThicknessMm?: number;
    /** Шероховатость внутренней поверхности трубы в миллиметрах. */
    roughnessMm?: number;
    installation?: PipelineInstallation;
    depthM?: number;
    routeCondition?: PipelineRouteCondition;
    additivesEfficiency?: boolean;
    pipelineStatus?: PipelineStatus;
    owner?: PipelineOwner | string;
    condition?: string;
    period?: string;
    source?: string;
    status?: 'running' | 'warning' | 'stopped';
    licenseArea?: string;
    attributes?: Record<string, unknown>;
  }>;
  segments?: Array<{
    id: string;
    label?: string;
    pipelineId: string | null;
    startNodeId?: string;
    endNodeId?: string;
    fluid?: string;
    pipelineClass?: string;
    owner?: string;
    condition?: string;
    period?: string;
    source?: string;
    status?: 'running' | 'warning' | 'stopped';
    licenseArea?: string;
    attributes?: Record<string, unknown>;
  }>;
  taps?: Array<{
    id: string;
    label?: string;
    edgeId?: string;
    t?: number;
    owner?: string;
    condition?: string;
    period?: string;
    source?: string;
    status?: 'running' | 'warning' | 'stopped';
    licenseArea?: string;
    attributes?: Record<string, unknown>;
  }>;
};

/** Сопоставление строкового состояния или статуса в тип EntityDetails['status']. */
function resolveEntityStatus(
  status?: string,
  condition?: string,
): 'running' | 'warning' | 'stopped' {
  if (status === 'stopped' || status === 'warning' || status === 'running') return status;
  if (condition === 'Остановлен') return 'stopped';
  if (condition === 'Предупреждение') return 'warning';
  return 'running';
}

/**
 * Собирает доменную карточку объекта (EntityDetails) из графа проектирования.
 * Возвращает null, если сущность с данным id не найдена.
 */
export function buildEntityDetails({
  id,
  vertices,
  pipelines,
  segments = [],
  taps = [],
}: EntityDetailsInput): EntityDetails | null {
  // Быстрый поиск метки и категории по id узла для связей
  const entityLabelMap = new Map<string, { label: string; kind: EntityDetails['kind'] }>();
  for (const v of vertices) entityLabelMap.set(v.id, { label: v.label, kind: v.kind });
  for (const t of taps) entityLabelMap.set(t.id, { label: t.label || 'Врезка', kind: 'node' });

  // Вспомогательная функция для сборки входящих/исходящих потоков
  const findFlows = (nodeId: string): { incoming: Flow[]; outgoing: Flow[] } => {
    const incoming: Flow[] = [];
    const outgoing: Flow[] = [];

    for (const seg of segments) {
      const pipe = pipelines.find((p) => p.id === seg.pipelineId);
      const pipeLabel = pipe?.label || seg.label || 'Сегмент';
      const isLogical = seg.pipelineClass === 'logical';

      if (seg.endNodeId === nodeId && seg.startNodeId) {
        const source = entityLabelMap.get(seg.startNodeId);
        incoming.push({
          id: `flow-in-${seg.id}`,
          targetId: seg.startNodeId,
          targetLabel: source?.label || 'Узел сети',
          targetKind: source?.kind || 'node',
          flowType: isLogical ? 'Логический поток' : pipeLabel,
          isLogicalFlow: isLogical,
          fluid: (seg.fluid as Flow['fluid']) || 'oil',
        });
      }

      if (seg.startNodeId === nodeId && seg.endNodeId) {
        const target = entityLabelMap.get(seg.endNodeId);
        outgoing.push({
          id: `flow-out-${seg.id}`,
          targetId: seg.endNodeId,
          targetLabel: target?.label || 'Узел сети',
          targetKind: target?.kind || 'node',
          flowType: isLogical ? 'Логический поток' : pipeLabel,
          isLogicalFlow: isLogical,
          fluid: (seg.fluid as Flow['fluid']) || 'oil',
        });
      }
    }

    return { incoming, outgoing };
  };

  // 1. Врезка (Tap)
  const tap = taps.find((t) => t.id === id || `tap-${t.id}` === id);
  if (tap) {
    const flows = findFlows(tap.id);
    const tVal = tap.t ?? 0;
    const modelStatus: ValidationItem[] = [
      { label: 'Тип узла', value: 'Врезка', ok: true },
      {
        label: 'Трубопровод-носитель',
        value: tap.edgeId ? 'привязана' : 'не привязана',
        ok: !!tap.edgeId,
      },
      { label: 'Позиция вдоль трубы', value: `${Math.round(tVal * 100)}%`, ok: true },
    ];

    return {
      id: tap.id,
      label: tap.label || 'Врезка',
      kind: 'node',
      subType: DOMAIN_KIND_META.node.typeClass,
      status: resolveEntityStatus(tap.status, tap.condition || (tap.attributes?.condition as string)),
      licenseArea: tap.licenseArea || (tap.attributes?.licenseArea as string) || '—',
      owner: tap.owner || (tap.attributes?.owner as string) || '—',
      period: tap.period || (tap.attributes?.period as string) || '2026–2040',
      condition: tap.condition || (tap.attributes?.condition as string) || 'Работает',
      attributes: tap.attributes,
      modelStatus,
      outgoing: flows.outgoing,
      incoming: flows.incoming,
    };
  }

  // 2. Сегмент трубопровода
  const segment = segments.find((s) => s.id === id);
  if (segment) {
    const parentPipe = pipelines.find((p) => p.id === segment.pipelineId);
    const parentAttrs = (parentPipe?.attributes || {}) as Record<string, unknown>;
    const segAttrs = (segment.attributes || {}) as Record<string, unknown>;

    const mergedAttributes: Record<string, unknown> = {
      ...parentAttrs,
      ...segAttrs,
      productProfile: segAttrs.productProfile || parentAttrs.productProfile,
      elevationProfile: segAttrs.elevationProfile || parentAttrs.elevationProfile,
      elevationStats: segAttrs.elevationStats || parentAttrs.elevationStats,
      supplyProfiles: segAttrs.supplyProfiles || parentAttrs.supplyProfiles,
    };

    const modelStatus: ValidationItem[] = [
      {
        label: 'Трубопровод',
        value: parentPipe ? parentPipe.label : 'отдельный сегмент',
        ok: !!segment.pipelineId,
      },
      {
        label: 'Флюид',
        value: segment.fluid === 'gas' ? 'Газ' : segment.fluid === 'water' ? 'Вода' : 'Нефть',
        ok: true,
      },
    ];

    return {
      id: segment.id,
      label: segment.label || 'Сегмент',
      kind: 'segment',
      subType: DOMAIN_KIND_META.segment.typeClass,
      status: resolveEntityStatus(
        segment.status || parentPipe?.status,
        segment.condition || parentPipe?.condition || (mergedAttributes.condition as string),
      ),
      licenseArea: segment.licenseArea || parentPipe?.licenseArea || (mergedAttributes.licenseArea as string) || '—',
      owner: segment.owner || parentPipe?.owner || (mergedAttributes.owner as string) || '—',
      period: segment.period || parentPipe?.period || (mergedAttributes.period as string) || '2026–2040',
      condition: segment.condition || parentPipe?.condition || (mergedAttributes.condition as string) || 'Работает',
      pipelineType: parentPipe?.pipelineType ?? (mergedAttributes.pipelineType as PipelineType | undefined),
      pipelineClass: (parentPipe?.pipelineClass ?? segment.pipelineClass ?? mergedAttributes.pipelineClass) as PipelineClass | undefined,
      lengthKm: parentPipe?.lengthKm ?? (mergedAttributes.lengthKm as number | undefined) ?? 0,
      outerDiameterMm: parentPipe?.outerDiameterMm ?? (mergedAttributes.outerDiameterMm as number | undefined),
      wallThicknessMm: parentPipe?.wallThicknessMm ?? (mergedAttributes.wallThicknessMm as number | undefined),
      roughnessMm: parentPipe?.roughnessMm ?? (mergedAttributes.roughnessMm as number | undefined) ?? 0,
      installation: parentPipe?.installation ?? (mergedAttributes.installation as PipelineInstallation | undefined),
      depthM: parentPipe?.depthM ?? (mergedAttributes.depthM as number | undefined) ?? 0,
      routeCondition: parentPipe?.routeCondition ?? (mergedAttributes.routeCondition as PipelineRouteCondition | undefined),
      additivesEfficiency: parentPipe?.additivesEfficiency ?? (mergedAttributes.additivesEfficiency as boolean | undefined),
      pipelineStatus: parentPipe?.pipelineStatus ?? (mergedAttributes.pipelineStatus as PipelineStatus | undefined),
      owner: parentPipe?.owner ?? (mergedAttributes.owner as string | undefined),
      attributes: mergedAttributes,
      modelStatus,
      outgoing: [],
      incoming: [],
    };
  }

  // 3. Вершина-объект (кустовая площадка, объект подготовки, точка поставки)
  const vertex = vertices.find((v) => v.id === id);
  if (vertex) {
    const flows = findFlows(vertex.id);
    const meta = DOMAIN_KIND_META[vertex.kind];
    const hasIncoming = flows.incoming.length > 0;
    const hasOutgoing = flows.outgoing.length > 0;

    const modelStatus: ValidationItem[] =
      vertex.kind === 'wellpad'
        ? [
          {
            label: 'Система сбора',
            value: hasOutgoing ? 'подключена' : 'не подключена',
            ok: hasOutgoing,
          },
          { label: 'Профиль добычи', value: 'не задан', ok: false },
          { label: 'Результаты ГР', value: 'отсутствуют', ok: false },
        ]
        : vertex.kind === 'facility'
          ? [
            {
              label: 'Входящие потоки',
              value: hasIncoming ? `${flows.incoming.length} подключено` : 'не подключены',
              ok: hasIncoming,
            },
            {
              label: 'Исходящие потоки',
              value: hasOutgoing ? `${flows.outgoing.length} подключено` : 'не подключены',
              ok: hasOutgoing,
            },
            { label: 'Технологическая схема', value: 'в норме', ok: true },
          ]
          : [
            {
              label: 'Точка сдачи',
              value: hasIncoming ? 'подключена' : 'ожидает подключения',
              ok: hasIncoming,
            },
            { label: 'Узел коммерческого учёта', value: 'готов к работе', ok: true },
          ];

    return {
      id: vertex.id,
      label: vertex.label,
      kind: vertex.kind,
      subType: meta?.typeClass,
      status: resolveEntityStatus(vertex.status, vertex.condition || (vertex.attributes?.condition as string)),
      licenseArea: vertex.licenseArea || (vertex.attributes?.licenseArea as string) || '—',
      owner: vertex.owner || (vertex.attributes?.owner as string) || '—',
      period: vertex.period || (vertex.attributes?.period as string) || '2026–2040',
      condition: vertex.condition || (vertex.attributes?.condition as string) || 'Работает',
      attributes: vertex.attributes,
      modelStatus,
      outgoing: flows.outgoing,
      incoming: flows.incoming,
    };
  }

  // 4. Логический трубопровод (цепочка сегментов)
  const pipeline = pipelines.find((p) => p.id === id);
  if (pipeline) {
    const count = segments.filter((s) => s.pipelineId === pipeline.id).length;
    const modelStatus: ValidationItem[] = [
      { label: 'Топология', value: `${count} сегментов`, ok: count > 0 },
      {
        label: 'Флюид',
        value: pipeline.fluid === 'gas' ? 'Газ' : pipeline.fluid === 'water' ? 'Вода' : 'Нефть',
        ok: true,
      },
    ];

    return {
      id: pipeline.id,
      label: pipeline.label,
      kind: 'pipeline',
      subType: DOMAIN_KIND_META.pipeline.typeClass,
      status: resolveEntityStatus(pipeline.status, pipeline.condition || (pipeline.attributes?.condition as string)),
      licenseArea: pipeline.licenseArea || (pipeline.attributes?.licenseArea as string) || '—',
      owner: pipeline.owner || (pipeline.attributes?.owner as string) || '—',
      period: pipeline.period || (pipeline.attributes?.period as string) || '2026–2040',
      condition: pipeline.condition || (pipeline.attributes?.condition as string) || 'Работает',
      pipelineType: pipeline.pipelineType ?? (pipeline.attributes?.pipelineType as PipelineType | undefined),
      pipelineClass: pipeline.pipelineClass ?? (pipeline.attributes?.pipelineClass as PipelineClass | undefined),
      lengthKm: pipeline.lengthKm ?? (pipeline.attributes?.lengthKm as number | undefined) ?? 0,
      outerDiameterMm: pipeline.outerDiameterMm ?? (pipeline.attributes?.outerDiameterMm as number | undefined),
      wallThicknessMm: pipeline.wallThicknessMm ?? (pipeline.attributes?.wallThicknessMm as number | undefined),
      roughnessMm: pipeline.roughnessMm ?? (pipeline.attributes?.roughnessMm as number | undefined) ?? 0,
      installation: pipeline.installation ?? (pipeline.attributes?.installation as PipelineInstallation | undefined),
      depthM: pipeline.depthM ?? (pipeline.attributes?.depthM as number | undefined) ?? 0,
      routeCondition: pipeline.routeCondition ?? (pipeline.attributes?.routeCondition as PipelineRouteCondition | undefined),
      additivesEfficiency: pipeline.additivesEfficiency ?? (pipeline.attributes?.additivesEfficiency as boolean | undefined),
      pipelineStatus: pipeline.pipelineStatus ?? (pipeline.attributes?.pipelineStatus as PipelineStatus | undefined),
      owner: pipeline.owner ?? (pipeline.attributes?.owner as string | undefined),
      attributes: pipeline.attributes,
      modelStatus,
      outgoing: [],
      incoming: [],
    };
  }

  // 5. Точки стыка и узлы сети (drawv-*, node-*, joint-*, snap-*)
  if (
    id.startsWith('drawv-') ||
    id.startsWith('node-') ||
    id.startsWith('joint-') ||
    id.includes('snap-') ||
    id.includes('sv')
  ) {
    const flows = findFlows(id);
    const numMatch = id.match(/(\d+)$/);
    const label = numMatch ? `Стык трубопровода ${numMatch[1]}` : 'Стык трубопровода';
    return {
      id,
      label,
      kind: 'node',
      subType: 'Стык трубопровода',
      status: 'running',
      licenseArea: '—',
      owner: '—',
      modelStatus: [
        { label: 'Тип узла', value: 'Стык трубопровода', ok: true },
        { label: 'Состояние', value: 'подключён', ok: true },
      ],
      outgoing: flows.outgoing,
      incoming: flows.incoming,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Построители данных для вкладок панели параметров                   */
/* ------------------------------------------------------------------ */

/** Род панели по категории объекта и его подтипу. */
export function panelKindFor(entity: EntityDetails): ParameterPanelKind {
  if (entity.kind === 'node') return 'node';
  if (entity.kind === 'pipeline' || entity.kind === 'segment') return 'pipeline';
  if (entity.kind === 'wellpad') return 'wellpad';
  return 'facility';
}

/** Класс объекта для подзаголовка («Промысловый» и т.п.). */
export function objectClassFor(entity: EntityDetails, kind: ParameterPanelKind): string {
  if (kind === 'pipeline') return 'Промысловый';
  if (kind === 'wellpad') return 'Объект добычи';
  if (entity.kind === 'node') return entity.subType ?? 'Узел сети';
  return entity.subType ?? 'Объект подготовки';
}

const PROFILE_START = 2026;
const PROFILE_END = 2040;

function productsFor(kind: ParameterPanelKind): ProductType[] {
  if (kind === 'wellpad') return ['oil', 'gas', 'water', 'liquid'];
  if (kind === 'pipeline') return ['oil', 'gas', 'water'];
  return ['oil', 'gas', 'water'];
}

const PRODUCT_UNIT: Record<ProductType, string> = {
  oil: 'тыс. т/год',
  gas: 'млн м³/год',
  water: 'тыс. м³/год',
  liquid: 'тыс. т/год',
};

function measureLabelFor(kind: ParameterPanelKind): string {
  if (kind === 'pipeline') return 'Поставка';
  if (kind === 'wellpad') return 'Добыча';
  return 'Поступление';
}

/** Профиль продукции по роду объекта (из импортированных данных или заготовка). */
export function buildProductProfile(kind: ParameterPanelKind, entity?: EntityDetails): ProductProfile {
  if (entity?.attributes?.productProfile && typeof entity.attributes.productProfile === 'object') {
    return entity.attributes.productProfile as ProductProfile;
  }
  const products = productsFor(kind);
  return {
    measureLabel: measureLabelFor(kind),
    startYear: PROFILE_START,
    endYear: PROFILE_END,
    products: products.map((product) => ({
      product,
      unit: PRODUCT_UNIT[product],
      enabled: true,
    })),
    series: [],
    limit: undefined,
  };
}

function parsePeriodYears(periodStr?: string): { start: number; end: number } {
  if (!periodStr) return { start: PROFILE_START, end: PROFILE_END };
  const match = periodStr.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  if (match) {
    const s = parseInt(match[1], 10);
    const e = parseInt(match[2], 10);
    if (s <= e) return { start: s, end: e };
  }
  return { start: PROFILE_START, end: PROFILE_END };
}

/** Период работы объекта (таймлайн + периоды вывода). */
export function buildWorkPeriod(kind: ParameterPanelKind, periodStr?: string): WorkPeriod {
  const { start, end } = parsePeriodYears(periodStr);
  return {
    source:
      kind === 'pipeline'
        ? 'Профиль транспортировки'
        : kind === 'wellpad'
          ? 'Профиль добычи'
          : 'Профиль продукции',
    startYear: start,
    endYear: end,
    activeRanges: [{ start, end }],
    shutdowns: [],
  };
}

/** Гидравлический расчёт — только для трубопровода. */
export function buildHydraulic(kind: ParameterPanelKind, entity: EntityDetails): HydraulicCalc | null {
  if (kind !== 'pipeline') return null;
  const okResults = entity.modelStatus.every((m) => m.ok);
  const { start, end } = parsePeriodYears(entity.period);
  const hasElev = Array.isArray(entity.attributes?.elevationProfile) && entity.attributes.elevationProfile.length > 0;
  const stats = entity.attributes?.elevationStats as { totalDistanceKm?: number; pointsCount?: number } | undefined;

  return {
    state: okResults || hasElev ? 'actual' : 'stale',
    period: `${start}–${end}`,
    lastRun: hasElev ? 'Импортирован профиль' : '—',
    readiness: [
      { label: 'Профиль', value: entity.attributes?.productProfile ? 'импортирован' : 'не задан', ok: !!entity.attributes?.productProfile },
      { label: 'Флюид', value: 'задан', ok: true },
      {
        label: 'Трасса и высоты',
        value: hasElev && stats
          ? `${stats.pointsCount} точек (${stats.totalDistanceKm} км)`
          : (okResults ? 'построена' : 'не завершена'),
        ok: hasElev || okResults,
      },
      { label: 'Параметры трубы', value: hasElev ? 'заданы из файла' : 'заданы', ok: true },
      { label: 'Граничные условия', value: hasElev ? 'рассчитаны' : 'не заданы', ok: hasElev },
    ],
  };
}

/** Аналитика объекта (предупреждения / рекомендации / проверки модели). */
export function buildAnalytics(entity: EntityDetails): AnalyticsData {
  const hasWarnings = entity.status === 'warning';
  const warnings = hasWarnings
    ? [
        {
          level: 'warning' as const,
          title: 'Завышенный риск / Предупреждение',
          detail: 'Объект находится в состоянии предупреждения, проверьте параметры эксплуатации.',
        },
      ]
    : [];

  const modelChecks = entity.modelStatus.map((m) => ({
    level: (m.ok ? 'info' : 'none') as 'info' | 'none',
    title: m.label,
    detail: m.value,
  }));
  return { warnings, recommendations: [], modelChecks };
}

/** Полная сборка данных панели для выбранного объекта. */
export function buildParameterPanelData(entity: EntityDetails): ParameterPanelData {
  const kind = panelKindFor(entity);
  return {
    entity,
    panelKind: kind,
    objectClass: objectClassFor(entity, kind),
    modelStatus: entity.modelStatus,
    workPeriod: buildWorkPeriod(kind, entity.period),
    productProfile: buildProductProfile(kind, entity),
    hydraulic: buildHydraulic(kind, entity),
    analytics: buildAnalytics(entity),
  };
}
