/**
 * Модель данных инспектора объекта (design description/components.md §2, RightSidebar).
 * Мок-генерация из данных карты; на Этапе 9 заменяется API + zod.
 */
import type { z } from 'zod';
import {
  EntityDetailsSchema,
  FlowSchema,
  ValidationItemSchema,
} from '../../domain/schemas';

/** Вкладки инспектора (components.md §3.1, inspectorTab) */
export type InspectorTabId =
  | 'general'
  | 'tech_params'
  | 'calendar'
  | 'trends'
  | 'alerts';

export type EntityStatus = EntityDetails['status'];

/** Поток-связь (единый источник — domain/schemas.ts). */
export type ConnectionItemData = z.infer<typeof FlowSchema>;

/** Элемент проверки состояния модели (единый источник — domain/schemas.ts). */
export type ValidationItemData = z.infer<typeof ValidationItemSchema>;

/** Детальная карточка объекта (единый источник — domain/schemas.ts). */
export type EntityDetails = z.infer<typeof EntityDetailsSchema>;

/** Статус-бейджи (цвет + подпись) */
export const STATUS_BADGE: Record<EntityStatus, { label: string; className: string }> = {
  running: { label: 'Работает', className: 'status-badge--running' },
  warning: { label: 'Предупреждение', className: 'status-badge--warning' },
  stopped: { label: 'Остановлен', className: 'status-badge--stopped' },
};
