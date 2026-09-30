import type { WarningHierarchyNode } from './types';

/**
 * Иерархия модели по макету (общий мок для вкладок «Предупреждения» и «Рекомендации»).
 */
export const DEFAULT_HIERARCHY: WarningHierarchyNode = {
  id: 'lu-severny',
  label: 'Северный ЛУ',
  count: 4,
  criticality: 'critical',
  children: [
    {
      id: 'sys-sbor-severny',
      label: 'Система сбора Северный',
      count: 2,
      criticality: 'high',
      children: [
        {
          id: 'pipe-01',
          label: 'Нефтепровод 01',
          count: 1,
          criticality: 'high',
        },
        {
          id: 'facility-upn-2',
          label: 'УПН-2',
          count: 1,
          criticality: 'critical',
        },
      ],
    },
    {
      id: 'sys-podgotovka',
      label: 'Подготовка',
      count: 2,
      criticality: 'high',
      children: [
        {
          id: 'facility-gp-1',
          label: 'ГП-1',
          count: 1,
          criticality: 'medium',
        },
        {
          id: 'deliv-sikn-1525',
          label: 'СИКН-1525',
          count: 0,
          criticality: 'low',
        },
      ],
    },
  ],
};
