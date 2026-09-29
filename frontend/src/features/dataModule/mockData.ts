import type { ConnectionItem, ModelObject, ProfileControlValue } from './types';

export const INITIAL_MODEL_OBJECTS: ModelObject[] = [];

export const INITIAL_SELECTED_OBJECT_IDS: string[] = [];

/** Данные профилей (по умолчанию пустые до загрузки/расчёта) */
export const PROFILES_CONTROL_VALUES: ProfileControlValue[] = [];

/** Данные связей модели (по умолчанию пустые до проектирования связей) */
export const CONNECTIONS_DATA: ConnectionItem[] = [];

/** Данные шаблонов импорта/экспорта (UI images/Activity bar/Данные/импорт экспорт.png) */
export const IMPORT_TEMPLATES = [
  {
    id: 'tpl-objects',
    title: 'Объекты и координаты',
    description: 'Создание или обновление объектов по коду, типу и координатам.',
    filename: 'площадки.xlsx',
  },
  {
    id: 'tpl-profiles',
    title: 'Профили',
    description: 'Добыча, поступление и поставка по периодам.',
    filename: 'добыча-поставка.xlsx',
  },
  {
    id: 'tpl-elevations',
    title: 'Высотные отметки трубопроводов',
    description: 'Пикетаж и отметки вдоль существующего трубопровода.',
    filename: 'параметры по длине трубопроводов.xlsx',
  },
  {
    id: 'tpl-params',
    title: 'Параметры объектов',
    description: 'Групповое обновление поддерживаемых параметров существующих объектов.',
    filename: 'Параметры_ПДИМ.xlsx',
  },
];
