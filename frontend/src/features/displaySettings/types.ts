/**
 * Тип подложки карты (design description/components.md — BasemapSelector).
 *  - topo — OSM;
 *  - satellite — космоснимки Esri;
 *  - none — пустой серый фон без тайлов (чтобы видеть отрисовку графа).
 */
export type Basemap = 'topo' | 'satellite' | 'none';

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
  /** Показывать лицензионные участки на карте */
  showLicenceAreas: boolean;
  /** Показывать стыки трубопроводов (вершины на концах рёбер) */
  showEdgeJoints: boolean;
  /** Активная подложка (default: topo) */
  basemap: Basemap;
};

export const DEFAULT_MAP_DISPLAY_SETTINGS: MapDisplaySettings = {
  showLabels: true,
  showWarnings: true,
  directedGraph: true,
  flowAnimation: false,
  showLicenceAreas: true,
  showEdgeJoints: true,
  basemap: 'topo',
};
