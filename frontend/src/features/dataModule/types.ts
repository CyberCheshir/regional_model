/**
 * Типы для модуля «Данные» (Activity Bar -> Данные).
 * Источник макетов: UI images/Activity bar/Данные/
 */

export type DataTabId = 'objects' | 'profiles' | 'connections' | 'import-export';

export type ObjectCategory = 'Объект добычи' | 'Площадной объект' | 'Трубопровод' | 'Узел';

export type ObjectTypeFilter = 'all' | 'wellpad' | 'facility' | 'pipeline' | 'node';

export type ObjectStatus = 'Готов' | 'Проверить';

export type ModelObject = {
  id: string;
  name: string;
  category: ObjectCategory;
  typeClass: string;
  period: string;
  source: string;
  status: ObjectStatus;
  owner?: string;
  condition?: string;
  kind?: string;
};

export type BatchEditScope = 'single' | 'selected' | 'filter';

export type BatchEditParams = {
  owner: string;
  period: string;
  condition: string;
  paramSource: string;
};
