import { z } from 'zod';

/**
 * Zod-схемы API-ответов (README этап 9.2).
 * Схемы используются и как рантайм-валидация, и как источник типов.
 */

/** Тип флюида. */
export const FluidTypeSchema = z.enum(['oil', 'gas', 'product']);

/** Класс трубопровода: фильтр стиля линии (цвет задаётся флюидом). */
export const PipelineClassSchema = z.enum(['field', 'interfield', 'trunk', 'logical']);

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
  /** Длина в километрах */
  lengthKm: z.number().positive(),
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
]);

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

/** Детальная карточка объекта (инспектор). */
export const EntityDetailsSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: TreeNodeKindSchema,
  subType: z.string().optional(),
  status: z.enum(['running', 'warning', 'stopped']),
  /** Лицензионный участок */
  licenseArea: z.string().min(1),
  owner: z.string().min(1),
  modelStatus: z.array(ValidationItemSchema),
  outgoing: z.array(FlowSchema),
  incoming: z.array(FlowSchema),
});

export type EntityDetails = z.infer<typeof EntityDetailsSchema>;

/** Парсер ответа с понятной ошибкой (для problem_log: TS5023-стиль проблем избегаем). */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`API schema violation: ${result.error.message}`);
  }
  return result.data;
}
