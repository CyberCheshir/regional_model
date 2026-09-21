/**
 * Реестр вкладок панели параметров (UI images/parameter panel).
 *
 * Набор вкладок зависит от РОДА объекта (panelKind):
 *   - pipeline  (Нефтепровод)        — объект, связи, период, продукция, РАСЧЁТ, аналитика (6);
 *   - facility  (Технологическая площадка) — без гидравлического расчёта (5);
 *   - wellpad   (Кустовая площадка)  — без расчёта и без ТХ-расчёта (4: объект, связи,
 *     период, продукция, аналитика → 5, но в макете у куста нет «Гидравлического расчёта»).
 *
 * Конфигурация держится в ОДНОМ месте — компонент только потребляет (см. problem_log
 * Этап 8: реестры вне компонентов, чтобы не было циклических импортов).
 */
import type { IconName } from '../../components/AppIcon';
import type { ParameterPanelKind, ParameterTabId } from '../../domain/types';

/** Описание одной вкладки панели параметров. */
export type ParameterTab = {
  id: ParameterTabId;
  label: string;
  icon: IconName;
};

/** Полный реестр вкладок (все возможные). */
const ALL_TABS: Record<ParameterTabId, ParameterTab> = {
  general: { id: 'general', label: 'Общие параметры', icon: 'pp-object' },
  calendar: { id: 'calendar', label: 'Период работы', icon: 'pp-period' },
  product: { id: 'product', label: 'Профиль продукции', icon: 'pp-product' },
  hydraulic: { id: 'hydraulic', label: 'Гидравлический расчёт', icon: 'pp-calc' },
  analytics: { id: 'analytics', label: 'Аналитика', icon: 'pp-analytics' },
};

/**
 * Набор вкладок по роду объекта.
 * Порядок соответствует макетам (сверху вниз по левому рельсу).
 */
export const PARAMETER_TABS_BY_KIND: Record<ParameterPanelKind, ParameterTabId[]> = {
  pipeline: ['general', 'calendar', 'product', 'hydraulic', 'analytics'],
  facility: ['general', 'calendar', 'product', 'analytics'],
  wellpad: ['general', 'calendar', 'product', 'analytics'],
};

/** Вкладки для конкретного рода объекта (в правильном порядке). */
export function tabsForKind(kind: ParameterPanelKind): ParameterTab[] {
  return PARAMETER_TABS_BY_KIND[kind].map((id) => ALL_TABS[id]);
}

/** Первая вкладка рода объекта — открывается по умолчанию. */
export function firstTabForKind(kind: ParameterPanelKind): ParameterTabId {
  return PARAMETER_TABS_BY_KIND[kind][0];
}

/** Есть ли вкладка у данного рода объекта (защита от невалидного activeTab). */
export function hasTab(kind: ParameterPanelKind, tab: ParameterTabId): boolean {
  return PARAMETER_TABS_BY_KIND[kind].includes(tab);
}
