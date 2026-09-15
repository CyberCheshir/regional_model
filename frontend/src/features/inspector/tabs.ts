import type { InspectorTabId } from './types';
import type { IconName } from '../../components/AppIcon';

/** Описание одной вкладки инспектора. */
export type InspectorTab = {
  id: InspectorTabId;
  label: string;
  icon: IconName;
};

/** Регистр вкладок инспектора (design description/components.md §2). */
export const INSPECTOR_TABS: InspectorTab[] = [
  { id: 'general', label: 'Общие', icon: 'tab-general' },
  { id: 'tech_params', label: 'Параметры', icon: 'tab-params' },
  { id: 'calendar', label: 'Календарь', icon: 'tab-calendar' },
  { id: 'trends', label: 'Тренды', icon: 'tab-trends' },
  { id: 'alerts', label: 'Алерты', icon: 'tab-alerts' },
];
