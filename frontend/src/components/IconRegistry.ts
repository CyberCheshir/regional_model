/**
 * Реестр иконок — источник истины: design description/icons.md
 * Каждая иконка — чистый inline SVG без внешних зависимостей.
 */

export type IconName =
  // Activity Bar
  | 'nav-map'
  | 'nav-data'
  | 'nav-calc'
  | 'nav-analytics'
  // Left Sidebar
  | 'tree-wellpad'
  | 'tree-facility'
  | 'tree-delivery-point'
  | 'tree-pipeline'
  | 'chevron'
  | 'action-chart'
  | 'action-visibility'
  | 'action-add'
  | 'trash'
  | 'basemap-topo'
  | 'basemap-satellite'
  | 'basemap-none'
  | 'licence-area'
  | 'import'
  | 'export'
  | 'dev-mode'
  | 'collapse-panel'
  // Inspector tabs
  | 'tab-general'
  | 'tab-params'
  | 'tab-calendar'
  | 'tab-trends'
  | 'tab-alerts'
  // Parameter panel tabs (UI images/parameter panel)
  | 'pp-object'
  | 'pp-connections'
  | 'pp-period'
  | 'pp-product'
  | 'pp-calc'
  | 'pp-analytics'
  // Parameter panel actions
  | 'chevron-right'
  | 'chevron-down'
  | 'plus'
  | 'pencil'
  // Misc actions
  | 'close'
  // Status & flows
  | 'check-success'
  | 'flow-physical'
  | 'flow-logical';

type IconDefinition = {
  viewBox: string;
  fill?: boolean;
  stroke?: boolean;
  strokeWidth?: number;
  dasharray?: string;
  paths: string;
};

const ICONS: Record<IconName, IconDefinition> = {
  // --- Activity Bar (24x24) ---
  'nav-map': {
    viewBox: '0 0 24 24',
    stroke: true,
    strokeWidth: 1.75,
    paths:
      '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>',
  },
  'nav-data': {
    viewBox: '0 0 24 24',
    stroke: true,
    strokeWidth: 1.75,
    paths:
      '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/><path d="M4 11.5v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
  },
  'nav-calc': {
    viewBox: '0 0 24 24',
    stroke: true,
    strokeWidth: 1.75,
    paths:
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  },
  'nav-analytics': {
    viewBox: '0 0 24 24',
    stroke: true,
    strokeWidth: 1.75,
    paths:
      '<path d="M3.5 20.5h17"/><rect x="5.5" y="12" width="3.5" height="8.5"/><rect x="11" y="8" width="3.5" height="12.5"/><path d="M5 8.5 10 5l4.5 2.5L20 3"/><path d="M16.5 3H20v3.5"/>',
  },

  // --- Left Sidebar (18x18 / 20x20) ---
  'tree-wellpad': {
    viewBox: '0 0 20 20',
    fill: true,
    paths:
      '<path d="M9 2h2l1 4h-4l1-4zm-1.5 5h5l1 4h-7l1-4zm-2 5h9l1.2 5.5H15l-.8-3.5H5.8L5 17.5H3.3L4.5 12z"/>',
  },
  'tree-facility': {
    viewBox: '0 0 20 20',
    fill: true,
    paths:
      '<path d="M3 17V9l4 2.5V9l4 2.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v12H3zm12-10.5h-2V8h2V6.5z"/>',
  },
  'tree-delivery-point': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.5,
    paths:
      '<circle cx="10" cy="10" r="3"/><path d="M10 1.5V4M10 16v2.5M1.5 10H4M16 10h2.5"/><circle cx="10" cy="10" r="7" stroke-dasharray="2.5 2.5" opacity="0.5"/>',
  },
  'chevron': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  },
  'tree-pipeline': {
    viewBox: '0 0 20 20',
    fill: true,
    paths:
      '<path d="M2 8h5l3-3h8v3h-7.5L8 11H2V8zm0 5h6.5l2.5-2.5H18V14h-6l-3 3H2v-4z" opacity=".9"/>',
  },
  'action-chart': {
    viewBox: '0 0 16 16',
    fill: true,
    paths:
      '<rect x="2" y="8" width="3" height="6" rx="0.75"/><rect x="6.5" y="4" width="3" height="10" rx="0.75"/><rect x="11" y="2" width="3" height="12" rx="0.75"/>',
  },
  'action-visibility': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths:
      '<path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  },
  'action-add': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.6,
    paths: '<path d="M8 3v10M3 8h10"/>',
  },
  // Режим разработчика — «баг»/код
  'dev-mode': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths:
      '<path d="M5 2 3.5 4M11 2l1.5 2"/><rect x="4.5" y="5" width="7" height="8" rx="3"/><path d="M2 7h2.5M11.5 7H14M2 10h2.5M11.5 10H14M4 4h8"/>',
  },
  // Топографический план — карта со горизонталями
  'basemap-topo': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<path d="M1.5 4.5 6 2.5l4 2 4.5-2v9L10 13.5l-4-2-4.5 2z"/><path d="M6 2.5v9M10 4.5v9"/><path d="M6.2 6.2c1.2.4 2.6.4 3.6 0"/><path d="M6.2 8.4c1.2.4 2.6.4 3.6 0"/>',
  },
  // Космоснимки — спутник
  'basemap-satellite': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<path d="M5.5 5.5 3 8l2.5 2.5"/><path d="M10.5 5.5 13 8l-2.5 2.5"/><rect x="6" y="6" width="4" height="4" rx="0.6"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8"/>',
  },
  // Без подложки — пустой серый прямоугольник
  'basemap-none': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<rect x="1.5" y="2.5" width="13" height="11" rx="1.2"/><path d="M1.5 11 5 7.5l3 3 2.5-2.5 4 4" opacity="0.35"/>',
  },
  // Импорт — стрелка, входящая ВНИЗ в «коробку/папку»
  import: {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<path d="M8 2.2v8.3"/><path d="M5.2 7.7 8 10.5 10.8 7.7"/><path d="M2.5 9.5v3.2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5"/>',
  },
  // Экспорт — стрелка, исходящая ВВЕРХ из «коробки/папки» (зеркало import)
  export: {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<path d="M8 13.8V5.5"/><path d="M5.2 8.3 8 5.5 10.8 8.3"/><path d="M2.5 9.5v3.2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5"/>',
  },
  // Лицензионный участок — замкнутая полилиния (полигон) с вершинами
  'licence-area': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5z"/><circle cx="8" cy="1.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.5" cy="5" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="8" cy="14.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="2.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="2.5" cy="5" r="1.1" fill="currentColor" stroke="none"/>',
  },
  trash: {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths:
      '<path d="M3 4.5h10"/><path d="M6.5 4.5V3h3v1.5"/><path d="M4.5 4.5 5 13h6l.5-8.5"/><path d="M7 7v4M9 7v4"/>',
  },
  'collapse-panel': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths: '<path d="M10 3 5 8l5 5"/>',
  },

  // --- Inspector tabs (20x20) ---
  'tab-general': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<rect x="3.5" y="2.5" width="13" height="15" rx="2"/><path d="M6.5 6.5h7M6.5 10h7M6.5 13.5h4"/>',
  },
  'tab-params': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M3 6h14M3 14h14"/><circle cx="8" cy="6" r="2.2" fill="var(--bg-panel)"/><circle cx="13" cy="14" r="2.2" fill="var(--bg-panel)"/>',
  },
  'tab-calendar': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/><path d="M6.5 12h3M6.5 14.5h5"/>',
  },
  'tab-trends': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M2.5 15.5c2.5 0 3-9 6-9s3 5.5 5 5.5 3.5-4 4-7"/><circle cx="8.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="13.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  },
  'tab-alerts': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M10 3 18.5 17h-17L10 3z"/><path d="M10 8.5v4"/><circle cx="10" cy="15" r="0.4" fill="currentColor"/>',
  },

  // --- Parameter panel tabs (20x20) ---
  // Объект: прямоугольник площадки с точками
  'pp-object': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<rect x="3" y="3.5" width="14" height="13" rx="2"/><circle cx="7.5" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12.5" cy="8" r="1.2" fill="currentColor" stroke="none"/><path d="M6.5 13h7"/>',
  },
  // Связи: ползунки (sliders)
  'pp-connections': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M3 6h14M3 14h14"/><circle cx="8" cy="6" r="2.2" fill="var(--bg-panel)"/><circle cx="13" cy="14" r="2.2" fill="var(--bg-panel)"/>',
  },
  // Период работы: флажок на оси времени
  'pp-period': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M5 18V3"/><path d="M5 4h10l-2.2 3L15 10H5"/>',
  },
  // Профиль продукции: восходящие столбцы графика
  'pp-product': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M3 17h14"/><rect x="4.5" y="10" width="3" height="6" rx="0.6"/><rect x="9" y="6" width="3" height="10" rx="0.6"/><rect x="13.5" y="12" width="3" height="4" rx="0.6"/>',
  },
  // Расчёт: шеврон в круге (алгоритм)
  'pp-calc': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<circle cx="10" cy="10" r="7.2"/><path d="M7.5 7.5 11 10l-3.5 2.5" fill="none"/>',
  },
  // Аналитика: предупреждение в треугольнике
  'pp-analytics': {
    viewBox: '0 0 20 20',
    stroke: true,
    strokeWidth: 1.6,
    paths:
      '<path d="M10 3 18.5 17h-17L10 3z"/><path d="M10 8v3.5"/><circle cx="10" cy="14.4" r="0.5" fill="currentColor"/>',
  },
  'chevron-right': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.6,
    paths: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  },
  'chevron-down': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.6,
    paths: '<path d="M3.5 6 8 10.5 12.5 6"/>',
  },
  plus: {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.6,
    paths: '<path d="M8 3v10M3 8h10"/>',
  },
  pencil: {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.4,
    paths:
      '<path d="M11.2 2.6 13.4 4.8 5.6 12.6 2.6 13.4l.8-3z"/><path d="M9.9 3.9l2.2 2.2"/>',
  },

  // --- Status & flows ---
  'check-success': {
    viewBox: '0 0 16 16',
    fill: true,
    paths:
      '<circle cx="8" cy="8" r="8"/><path d="M4.5 8.2l2.3 2.3 4.7-4.7" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  },
  'flow-physical': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths:
      '<rect x="1" y="6" width="11" height="4" rx="1.5"/><path d="M11 8h4M13 6l2 2-2 2"/>',
  },
  'flow-logical': {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    dasharray: '2 2',
    paths:
      '<path d="M2 12c3-1 4-7 8-7h4"/><path d="M12 2l3 3-3 3" stroke-dasharray="none"/>',
  },
  close: {
    viewBox: '0 0 16 16',
    stroke: true,
    strokeWidth: 1.5,
    paths: '<path d="M4 4l8 8M12 4l-8 8"/>',
  },
};

export { ICONS as ICON_REGISTRY };
export type { IconDefinition };
