/** Тип подложки карты (design description/components.md — BasemapSelector) */
export type Basemap = 'topo' | 'satellite';

/** Настройки отображения карты (этап 5, README 5.3) */
export type MapDisplaySettings = {
  /** Подписи объектов на карте */
  showLabels: boolean;
  /** Индикация предупреждений */
  showWarnings: boolean;
  /** Ориентированный граф: показывать направление потоков (стрелки на рёбрах) */
  directedGraph: boolean;
  /**
   * Анимация потока по рёбрам (бегущий dash offset). Если выключено — рёбра
   * рисуются сплошной линией.
   */
  flowAnimation: boolean;
  /** Активная подложка (default: topo) */
  basemap: Basemap;
};

export const DEFAULT_MAP_DISPLAY_SETTINGS: MapDisplaySettings = {
  showLabels: true,
  showWarnings: true,
  directedGraph: true,
  flowAnimation: false,
  basemap: 'topo',
};
