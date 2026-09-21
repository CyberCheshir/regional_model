import type {
  EntityDetails,
  Flow,
  MapGraph,
} from '../domain/types';
import { EntityDetailsSchema, MapGraphSchema } from '../domain/schemas';

/**
 * Мок-данные API (Этап 9.3). Структура повторяет доменные схемы,
 * чтобы ответ шёл через валидацию Zod как в реальном API.
 */

/** Граф карты: узлы-объекты + рёбра-трубопроводы (по design.png). */
export const MOCK_GRAPH: MapGraph = MapGraphSchema.parse({
  nodes: [
    { id: 'node-wellpad-north', label: 'Северный', kind: 'wellpad', entityId: 'wellpad-north' },
    { id: 'node-wellpad-east', label: 'Восточный', kind: 'wellpad', entityId: 'wellpad-east' },
    { id: 'node-upn-2', label: 'УПН-2', kind: 'processing', entityId: 'facility-upn-2' },
    { id: 'node-delivery', label: 'Точка поставки', kind: 'delivery', entityId: 'facility-delivery' },
  ],
  edges: [
    {
      id: 'edge-oil-01',
      from: 'node-wellpad-north',
      to: 'node-upn-2',
      fluid: 'oil',
      pipelineClass: 'field',
      flowLabel: '2,4 тыс т/сут',
    },
    {
      id: 'edge-oil-02',
      from: 'node-wellpad-east',
      to: 'node-upn-2',
      fluid: 'oil',
      pipelineClass: 'field',
      flowLabel: '1,8 тыс т/сут',
    },
    {
      id: 'edge-oil-03',
      from: 'node-upn-2',
      to: 'node-delivery',
      fluid: 'oil',
      pipelineClass: 'interfield',
      flowLabel: '4,2 тыс т/сут',
    },
  ],
});

/** Детальная карточка «Северного» (по design.png §2). */
export const MOCK_ENTITY_DETAILS: EntityDetails = EntityDetailsSchema.parse({
  id: 'wellpad-1',
  label: 'Куст 1',
  kind: 'wellpad',
  subType: 'Кустовая площадка',
  status: 'warning',
  licenseArea: 'Северный ЛУ',
  owner: 'ГПН-3',
  modelStatus: [
    { label: 'Система сбора', value: 'Северный контур', ok: true },
    { label: 'Профиль добычи', value: 'из системы сбора', ok: true },
    { label: 'Результаты ГР', value: '2026–2040', ok: true },
  ],
  outgoing: [
    {
      id: 'edge-1',
      targetId: 'facility-ukpg',
      targetLabel: 'УКПГ «Северная»',
      targetKind: 'facility',
      flowType: 'Нефтепровод',
      isLogicalFlow: false,
      fluid: 'oil',
    },
  ] satisfies Flow[],
  incoming: [],
});
