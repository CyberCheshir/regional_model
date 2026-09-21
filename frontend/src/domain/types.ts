import type { z } from 'zod';
import {
  AreaSchema,
  FluidTypeSchema,
  FlowSchema,
  FacilitySchema,
  GraphEdgeSchema,
  GraphNodeSchema,
  PipelineSchema,
  WellpadNodeSchema,
  type MapGraph,
  type EntityDetails,
} from './schemas';

export type { MapGraph, EntityDetails };

/** Тип флюида: нефть / газ / вода */
export type FluidType = z.infer<typeof FluidTypeSchema>;

/**
 * Доменная модель сущностей (discriminated unions).
 * kind — дискриминант: каждый вариант имеет свой набор полей.
 */

/** Кустовая площадка (добывающий куст). */
export type Wellpad = z.infer<typeof WellpadNodeSchema> & { kind: 'wellpad' };
/** Технологический объект (УПН, точка поставки и т.п.). */
export type Facility = z.infer<typeof FacilitySchema> & { kind: 'facility' };
/** Трубопровод (линейный объект). */
export type Pipeline = z.infer<typeof PipelineSchema> & { kind: 'pipeline' };
/** Площадной объект (лицензионный участок и т.п.). */
export type Area = z.infer<typeof AreaSchema> & { kind: 'area' };
/** Сегмент трубопровода (ребро полилинии). */
export type Segment = { kind: 'segment' };

/** Любая сущность доменной модели. */
export type DomainEntity = Wellpad | Facility | Pipeline | Area | Segment;

/** Узел графа карты. */
export type GraphNode = z.infer<typeof GraphNodeSchema>;
/** Ребро-трубопровод графа карты. */
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

/** Логический поток (передача флюида между объектами). */
export type Flow = z.infer<typeof FlowSchema>;

/** Род сущности для selectedEntity. */
export type EntityKind = DomainEntity['kind'];

/** Краткая ссылка на выбранную сущность (components.md §3.1). */
export type SelectedEntity = { id: string; kind: EntityKind };
