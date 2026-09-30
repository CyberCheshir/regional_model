/**
 * Типы для модуля «Гидравлические расчеты» (Activity Bar -> Расчеты).
 * Источник макетов: UI images/Activity bar/Расчеты/Гидравлические расчеты/
 */

export type HydraulicTabId = 'contour' | 'task' | 'results';

export type ContourFluid = 'oil' | 'gas' | 'water';

export type ContourObjectRole = 'source' | 'node' | 'route' | 'joint' | 'excluded';

export type ContourObjectItem = {
  id: string;
  name: string;
  type: string;
  kind: 'wellpad' | 'facility' | 'pipeline' | 'node' | 'delivery-point';
  fluid?: string;
  role: ContourObjectRole;
  statusLabel: string;
  lengthKm?: number;
};

export type SavedContourPreset = {
  id: string;
  title: string;
  description: string;
  fluid: ContourFluid;
  objectNames: string[];
};

export type ConnectivityCheckItem = {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
};

export type CalculationMode = 'thermal' | 'isothermal' | 'quasisteady';

export type PvtProperties = {
  densityKgM3: number;
  viscosityCSt: number;
  gasFactorM3T: number;
  waterCutPct: number;
};

export type HydraulicSectionItem = {
  id: string;
  name: string;
  lengthKm: number;
  diameterMm: string;
  roughnessMm: number;
  flowRateTDay: number;
};

export type CalculationHistoryStatus = 'success' | 'warning' | 'running' | 'failed';

export type CalculationHistoryItem = {
  id: string;
  title: string;
  status: CalculationHistoryStatus;
  statusLabel: string;
  timestamp: string;
  summary: string;
};

export type CalculationTaskParams = {
  year: number;
  mode: CalculationMode;
  outletPressureMpa: number;
  ambientTempC: number;
  pvt: PvtProperties;
  sections: HydraulicSectionItem[];
};

export type HydraulicResultPoint = {
  km: number;
  nodeLabel: string;
  pressureMpa: number;
  temperatureC: number;
  elevationM: number;
  velocityMS: number;
  status: 'optimal' | 'warning' | 'normal';
};

export type HydraulicResultsData = {
  deltaPressureMpa: number;
  inletPressureMpa: number;
  outletPressureMpa: number;
  outletTempC: number;
  maxVelocityMS: number;
  points: HydraulicResultPoint[];
  checks: Array<{ label: string; detail: string; ok: boolean }>;
};

