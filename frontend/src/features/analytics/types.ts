/**
 * Типы для модуля «Аналитика» (Activity Bar -> Аналитика).
 * Источник макетов: UI images/Activity bar/Аналитика/
 */

import type { CriticalityLevel } from '../../domain/types';

export type AnalyticsTabId = 'overview' | 'warnings' | 'recommendations' | 'scenarios' | 'roadmaps';

export type { CriticalityLevel };

export type OverviewKpiData = {
  criticalWarnings: number;
  warningsDelta: number;
  recommendationsTotal: number;
  recommendationsPlanning: number;
  licenceAreasWithLimits: number;
  licenceAreasTotal: number;
  nearestEventYear: number;
  nearestEventReadinessYear: number;
  scenarioName: string;
  scenarioSubtitle: string;
};

export type LicenceAreaStatusItem = {
  id: string;
  name: string;
  warningsCount: number;
  criticality: 'Критичная' | 'Высокая' | 'Средняя';
  level: CriticalityLevel;
  percentage: number;
};

export type KeyRiskItem = {
  id: string;
  element: string;
  warning: string;
  period: string;
  criticalityLabel: 'Критичная' | 'Высокая' | 'Средняя';
  level: CriticalityLevel;
  solution: string;
};

export type UpcomingSolutionItem = {
  id: string;
  startYear: number;
  target: string;
  action: string;
  readinessYear: number;
};

export type LimitationTimelineEvent = {
  year: number;
  label: string;
};

export type WarningHierarchyNode = {
  id: string;
  label: string;
  count: number;
  criticality: CriticalityLevel;
  children?: WarningHierarchyNode[];
};

export type WarningDetailItem = {
  id: string;
  levelType: 'ЛУ' | 'Система' | 'Объект';
  element: string;
  type: string;
  period: string;
  duration: string;
  criticality: 'Критичная' | 'Высокая' | 'Средняя';
  level: CriticalityLevel;
  description: string;
  hierarchyPath: string;
  kpiLabel: string;
  kpiValue: string;
  kpiLimit: string;
  source: string;
  relatedRecommendationId?: string;
};

export type WarningTypeSummaryItem = {
  id: string;
  label: string;
  count: number;
};

export type WarningsFilterState = {
  lu: string;
  owner: string;
  system: string;
  criticality: string;
  period: string;
  type: string;
};

export type RecommendationStage = {
  id: string;
  name: string;
  durationMonths: number;
};

export type RecommendationItem = {
  id: string;
  title: string;
  element: string;
  category: string;
  autoCategoryCode: string;
  manualCategory?: string;
  requiredByDate: string;
  startYear: number;
  startMonth: string;
  durationMonths: number;
  isLinkedToCritical: boolean;
  stages: RecommendationStage[];
  warningId?: string;
};

export type RecommendationFilterState = {
  lu: string;
  system: string;
  category: string;
  criticality: string;
  showHidden: boolean;
};

/* --- Сравнение сценариев --- */

export type ScenarioComparisonSubMode = 'restrictions' | 'production';

export type ScenarioProductionIndicatorItem = {
  id: string;
  name: string;
  unit: string;
  peakYear: number;
};

export type ScenarioControlYearRow = {
  year: number;
  baseVal: number;
  currentVal: number;
  delta: number;
};

export type ScenarioProductionComparisonData = {
  objectName: string;
  feature: string;
  product: string;
  accumulatedTotal: number;
  accumulatedUnit: string;
  peakTotal: number;
  peakUnit: string;
  peakYear: number;
  deltaAccumulated: number;
  deltaPeak: number;
  curvePoints: Array<{ year: number; v0: number; v1: number; delta: number }>;
  controlYears: ScenarioControlYearRow[];
};

export type ScenarioRestrictionsSummary = {
  newWarnings: number;
  resolvedWarnings: number;
  maxIncreased: number;
  maxDecreased: number;
  criticalityChanges: number;
  implementationYearChanges: number;
  recommendationChanges: number;
};

export type ScenarioLuSystemWarningRow = {
  id: string;
  lu: string;
  gathering: string;
  preparation: string;
  transport: string;
  totalDelta: number;
};

export type ScenarioDetailChangeItem = {
  id: string;
  luSystem: string;
  objectName: string;
  status: 'Устранено' | 'MAX снизилась' | 'MAX выросла' | 'Без изменений';
  maxLoadBaseToScen: string;
  criticalityBaseToScen: string;
  yearBaseToScen: string;
  warningTitle: string;
  maxLoadInfo: string;
  durationInfo: string;
  recommendationInfo: string;
};




/* --- Дорожные карты мероприятий --- */

export type RoadmapKpiSummary = {
  totalEvents: number;
  criticalEvents: number;
  inPlanning: number;
  totalInvestmentEstimated: string;
  nearestStartYear: number;
};

export type RoadmapEventStage = {
  id: string;
  name: string;
  startMonthYear: string;
  durationMonths: number;
  startYearOffset: number; // год относительно начала (для отрисовки на шкале)
  durationFraction: number; // доля длительности
};

export type RoadmapEventItem = {
  id: string;
  title: string;
  element: string;
  lu: string;
  system: string;
  category: string;
  criticality: CriticalityLevel;
  criticalityLabel: 'Критичная' | 'Высокая' | 'Средняя';
  status: 'Планируется' | 'В графике' | 'Требует внимания' | 'Завершено';
  startYear: number;
  readinessYear: number;
  durationMonths: number;
  totalCost?: string;
  warningSource?: string;
  stages: RoadmapEventStage[];
};

export type RoadmapFilterState = {
  lu: string;
  system: string;
  criticality: string;
  category: string;
  viewScale: 'years' | 'quarters';
};
