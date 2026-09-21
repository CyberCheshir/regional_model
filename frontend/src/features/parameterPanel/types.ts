/**
 * Типы панели параметров. Ссылки на домен (schemas.ts) — единый источник.
 * Заменяет features/inspector/types.ts (старый инспектор).
 */
import type { z } from 'zod';
import { EntityDetailsSchema, FlowSchema, ValidationItemSchema } from '../../domain/schemas';

export type EntityStatus = z.infer<typeof EntityDetailsSchema>['status'];
export type EntityDetails = z.infer<typeof EntityDetailsSchema>;
export type ConnectionItemData = z.infer<typeof FlowSchema>;
export type ValidationItemData = z.infer<typeof ValidationItemSchema>;

/** Статус-бейджи (цвет + подпись) для шапки панели. */
export const STATUS_BADGE: Record<EntityStatus, { label: string; className: string }> = {
  running: { label: 'Работает', className: 'status-badge--running' },
  warning: { label: 'Предупреждение', className: 'status-badge--warning' },
  stopped: { label: 'Остановлен', className: 'status-badge--stopped' },
};
