import { z } from 'zod';

/**
 * Zod-схемы API-ответов (README этап 9.2).
 * Схемы используются и как рантайм-валидация, и как источник типов.
 */

/** Тип флюида. */
export const FluidTypeSchema = z.enum(['oil', 'gas', 'product']);

/** Тип трубопровода для общих параметров. */
export const PipelineTypeSchema = z.enum(['npp', 'gp', 'water']);
export type PipelineType = z.infer<typeof PipelineTypeSchema>;

/** Подписи типов трубопровода для UI и экспортов. */
export const PIPELINE_TYPE_LABELS: Record<PipelineType, string> = {
  npp: 'НП (нефтепродуктопровод / нефтепровод)',
  gp: 'ГП (газопровод)',
  water: 'ВД (водовод)',
};

/** Класс трубопровода: фильтр стиля линии (цвет задаётся флюидом). */
export const PipelineClassSchema = z.enum(['field', 'interfield', 'trunk', 'logical']);
export type PipelineClass = z.infer<typeof PipelineClassSchema>;

/** Подписи классов трубопровода для панели общих параметров. */
export const PIPELINE_CLASS_LABELS: Record<Exclude<PipelineClass, 'logical'>, string> = {
  field: 'Промысловый',
  interfield: 'Межпромысловый',
  trunk: 'Магистральный',
};

/** Способ прокладки трубопровода. */
export const PipelineInstallationSchema = z.enum(['underground', 'overground', 'embankment', 'underwater']);
export type PipelineInstallation = z.infer<typeof PipelineInstallationSchema>;
export const PIPELINE_INSTALLATION_LABELS: Record<PipelineInstallation, string> = {
  underground: 'Подземный',
  overground: 'Надземный',
  embankment: 'В насыпи',
  underwater: 'Подводный',
};

/** Условия трассы. */
export const PipelineRouteConditionSchema = z.enum(['unspecified', 'dryland', 'permafrost', 'dryland30-permafrost70', 'dryland70-permafrost30']);
export type PipelineRouteCondition = z.infer<typeof PipelineRouteConditionSchema>;
export const PIPELINE_ROUTE_CONDITION_LABELS: Record<PipelineRouteCondition, string> = {
  unspecified: 'Не указано',
  dryland: 'Суходол',
  permafrost: 'МГ (многолетнемерзлые грунты)',
  'dryland30-permafrost70': '30% Суходол 70% ММГ',
  'dryland70-permafrost30': '70% Суходол 30% ММГ',
};

/** Допустимые владельцы трубопровода в общих параметрах. */
export const PipelineOwnerSchema = z.enum(['gp-angara', 'gp-zapolyarye', 'gazprom', 'surgutneftegaz', 'transneft', 'unspecified']);
export type PipelineOwner = z.infer<typeof PipelineOwnerSchema>;
export const PIPELINE_OWNER_LABELS: Record<PipelineOwner, string> = {
  'gp-angara': 'ГПН-Ангара',
  'gp-zapolyarye': 'ГПН-Заполярье',
  gazprom: 'Газпром',
  surgutneftegaz: 'Сургутнефтегаз',
  transneft: 'Траснефть',
  unspecified: 'Не указан',
};

/** Статус трубопровода в общих параметрах. */
export const PipelineStatusSchema = z.enum(['approved', 'new']);
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  approved: 'Утвержденный',
  new: 'Новый',
};

/** Тип маркера на карте. */
export const MarkerKindSchema = z.enum(['wellpad', 'processing', 'delivery']);

/** Базовые поля объекта на карте. */
const PositionedEntity = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Проекция WGS-84: [долгота, широта] */
  coords: z.tuple([z.number(), z.number()]),
});

/** Кустовая площадка. */
export const WellpadNodeSchema = PositionedEntity.extend({
  marker: z.literal('wellpad'),
  wells: z.number().int().nonnegative(),
  status: z.enum(['active', 'inactive', 'warning']),
});

/** Технологический объект (УПН, точка поставки). */
export const FacilitySchema = PositionedEntity.extend({
  marker: z.enum(['processing', 'delivery']),
  capacity: z.string(),
  status: z.enum(['active', 'inactive', 'warning']),
});

/** Трубопровод. */
export const PipelineSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fluid: FluidTypeSchema,
  /** Владелец трубопровода. */
  owner: z.string().optional(),
  /** Тип трубопровода: НП, ГП или ВД. */
  pipelineType: PipelineTypeSchema.optional(),
  /** Классификация трубопровода. */
  pipelineClass: PipelineClassSchema.optional(),
  /** Протяжённость в километрах. */
  lengthKm: z.number().nonnegative().default(0),
  /** Наружный диаметр трубы в миллиметрах. */
  outerDiameterMm: z.number().int().nonnegative().optional(),
  /** Толщина стенки трубы в миллиметрах. */
  wallThicknessMm: z.number().int().nonnegative().optional(),
  /** Шероховатость внутренней поверхности трубы в миллиметрах. */
  roughnessMm: z.number().int().nonnegative().default(0),
  installation: PipelineInstallationSchema.optional().default('overground'),
  depthM: z.number().nonnegative().optional().default(0),
  routeCondition: PipelineRouteConditionSchema.optional().default('unspecified'),
  additivesEfficiency: z.boolean().optional().default(false),
  pipelineStatus: PipelineStatusSchema.optional().default('new'),
});

/** Площадной объект (лицензионный участок). */
export const AreaSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Полигон в проекции WGS-84 */
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
});

/** Узел графа (vis-network x/y заполняется проекцией на клиенте). */
export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: MarkerKindSchema,
  entityId: z.string().min(1),
});

/** Ребро графа-трубопровод. */
export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  fluid: FluidTypeSchema,
  /** Класс трубопровода (стиль линии на карте) */
  pipelineClass: PipelineClassSchema,
  /** Метка расхода: «1,8 млн м³/сут» */
  flowLabel: z.string().min(1),
});

/** Ответ API: граф карты. */
export const MapGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type MapGraph = z.infer<typeof MapGraphSchema>;

/** Категория объекта — совпадает с TreeNodeKind дерева объектов. */
export const TreeNodeKindSchema = z.enum([
  'wellpad',
  'facility',
  'delivery-point',
  'pipeline',
  'segment',
  'node',
]);

/** Тип узла: врезка или стык трубопровода (также поддерживается тройник) */
export const NodeTypeSchema = z.enum(['tap', 'joint', 'tee']);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  tap: 'Врезка',
  joint: 'Стык трубопровода',
  tee: 'Тройник',
};

/** Поток-связь между объектами (без физической трубы / с трубой). */
export const FlowSchema = z.object({
  id: z.string().min(1),
  /** id связанного объекта (для navigate-to-relation) */
  targetId: z.string().min(1),
  /** имя связанного объекта */
  targetLabel: z.string().min(1),
  /** категория связанного объекта */
  targetKind: TreeNodeKindSchema,
  /** тип потока, например «Нефтепровод» */
  flowType: z.string().min(1),
  /** true — передача флюида без физ. трубы (бейдж на карточке) */
  isLogicalFlow: z.boolean(),
  fluid: FluidTypeSchema.optional(),
});

/** Элемент проверки состояния модели. */
export const ValidationItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  ok: z.boolean(),
});
export type ValidationItem = z.infer<typeof ValidationItemSchema>;

/** Детальная карточка объекта (инспектор). */
export const EntityDetailsSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: TreeNodeKindSchema,
  subType: z.string().optional(),
  /** Тип трубопровода для редактирования во вкладке «Общие параметры». */
  pipelineType: PipelineTypeSchema.optional(),
  /** Классификация трубопровода для редактирования во вкладке «Общие параметры». */
  pipelineClass: PipelineClassSchema.optional(),
  /** Протяжённость трубопровода в километрах. */
  lengthKm: z.number().nonnegative().optional(),
  /** Наружный диаметр трубы в миллиметрах. */
  outerDiameterMm: z.number().int().nonnegative().optional(),
  /** Толщина стенки трубы в миллиметрах. */
  wallThicknessMm: z.number().int().nonnegative().optional(),
  /** Шероховатость внутренней поверхности трубы в миллиметрах. */
  roughnessMm: z.number().int().nonnegative().optional(),
  installation: PipelineInstallationSchema.optional(),
  depthM: z.number().nonnegative().optional(),
  routeCondition: PipelineRouteConditionSchema.optional(),
  additivesEfficiency: z.boolean().optional(),
  pipelineStatus: PipelineStatusSchema.optional(),
  status: z.enum(['running', 'warning', 'stopped']),
  /** Лицензионный участок */
  licenseArea: z.string().min(1),
  owner: z.string().min(1),
  period: z.string().optional(),
  condition: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  modelStatus: z.array(ValidationItemSchema),
  outgoing: z.array(FlowSchema),
  incoming: z.array(FlowSchema),
});

export type EntityDetails = z.infer<typeof EntityDetailsSchema>;

/* ------------------------------------------------------------------ */
/* Панель параметров (UI images/parameter panel) — расширенный инспектор. */
/* ------------------------------------------------------------------ */

/**
 * Род панели параметров: определяет НАБОР вкладок (у трубопровода есть
 * гидравлический расчёт, у площадных объектов — нет, у узла/врезки — только общие параметры).
 */
export const ParameterPanelKindSchema = z.enum(['pipeline', 'facility', 'wellpad', 'node']);
export type ParameterPanelKind = z.infer<typeof ParameterPanelKindSchema>;

/** Тип ряда профиля: флюид или технологический параметр. */
export const ProductTypeSchema = z.enum(['oil', 'gas', 'water', 'liquid', 'pressure', 'temperature']);
export type ProductType = z.infer<typeof ProductTypeSchema>;

/** Вкладки панели параметров (иконки на левом рельсе). */
export const ParameterTabIdSchema = z.enum([
  'general',
  'calendar',
  'product',
  'hydraulic',
  'analytics',
]);
export type ParameterTabId = z.infer<typeof ParameterTabIdSchema>;

/** Период вывода из эксплуатации (строка таблицы). */
export const ShutdownPeriodSchema = z.object({
  start: z.string(),
  end: z.string(),
  reason: z.string(),
});
export type ShutdownPeriod = z.infer<typeof ShutdownPeriodSchema>;

/** Период работы объекта (вкладка «Период работы»). */
export const WorkPeriodSchema = z.object({
  /** Источник периода: «Профиль транспортировки», «из системы сбора» … */
  source: z.string(),
  /** Год ввода в эксплуатацию */
  startYear: z.number().int(),
  /** Год вывода из эксплуатации */
  endYear: z.number().int(),
  /** Отрезки эксплуатации на таймлайне (год начала / год конца) */
  activeRanges: z.array(
    z.object({ start: z.number().int(), end: z.number().int() }),
  ),
  /** Периоды вывода из эксплуатации */
  shutdowns: z.array(ShutdownPeriodSchema),
});
export type WorkPeriod = z.infer<typeof WorkPeriodSchema>;

/** Значение продукта по годам (колонка профиля продукции). */
export const ProductSeriesSchema = z.object({
  product: ProductTypeSchema,
  /** Точки ряда: год → значение */
  points: z.array(z.object({ year: z.number().int(), value: z.number() })),
});
export type ProductSeries = z.infer<typeof ProductSeriesSchema>;

/** Профиль продукции (вкладка «Профиль продукции»). */
export const ProductProfileSchema = z.object({
  /** Заголовок блока значений: «Поставка» / «Добыча» / «Поступление» */
  measureLabel: z.string(),
  /** Диапазон лет профиля */
  startYear: z.number().int(),
  endYear: z.number().int(),
  /** Доступные продукты и их единицы измерения */
  products: z.array(
    z.object({
      product: ProductTypeSchema,
      unit: z.string(),
      enabled: z.boolean(),
    }),
  ),
  /** Ряды значений по продуктам */
  series: z.array(ProductSeriesSchema),
  /** Ограничение (пунктирная линия графика), опционально */
  limit: z.number().optional(),
});
export type ProductProfile = z.infer<typeof ProductProfileSchema>;

/** Гидравлический расчёт (вкладка «Расчёт», только трубопровод). */
export const HydraulicCalcSchema = z.object({
  /** Бейдж состояния: «Актуален» / «Устарел» */
  state: z.enum(['actual', 'stale', 'none']),
  /** Расчётный период (год) */
  period: z.string(),
  /** Дата/время последнего расчёта */
  lastRun: z.string(),
  /** Готовность модели — проверки */
  readiness: z.array(ValidationItemSchema),
});
export type HydraulicCalc = z.infer<typeof HydraulicCalcSchema>;

/** Предупреждение/проверка аналитики. */
export const AnalyticsItemSchema = z.object({
  /** Уровень: предупреждение / информация / нет данных */
  level: z.enum(['warning', 'info', 'none']),
  title: z.string(),
  detail: z.string(),
});
export type AnalyticsItem = z.infer<typeof AnalyticsItemSchema>;

/** Аналитика (вкладка «Аналитика»). */
export const AnalyticsDataSchema = z.object({
  warnings: z.array(AnalyticsItemSchema),
  recommendations: z.array(AnalyticsItemSchema),
  modelChecks: z.array(AnalyticsItemSchema),
});
export type AnalyticsData = z.infer<typeof AnalyticsDataSchema>;

/** Полный набор данных панели параметров для выбранного объекта. */
export const ParameterPanelDataSchema = z.object({
  entity: EntityDetailsSchema,
  /** Род панели — определяет доступные вкладки */
  panelKind: ParameterPanelKindSchema,
  /** Класс объекта для подзаголовка (напр. «Промысловый») */
  objectClass: z.string().optional(),
  /** Готовность модели: зелёные галочки (идентификация/состояние) */
  modelStatus: z.array(ValidationItemSchema),
  workPeriod: WorkPeriodSchema.nullable(),
  productProfile: ProductProfileSchema.nullable(),
  hydraulic: HydraulicCalcSchema.nullable(),
  analytics: AnalyticsDataSchema.nullable(),
});
export type ParameterPanelData = z.infer<typeof ParameterPanelDataSchema>;

/** Парсер ответа с понятной ошибкой (для problem_log: TS5023-стиль проблем избегаем). */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`API schema violation: ${result.error.message}`);
  }
  return result.data;
}
