import { useMemo } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import { criticalityToneClass } from '../../domain';
import { StatGrid, type StatItem } from '../../components/ui/StatGrid';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import type {
  KeyRiskItem,
  LicenceAreaStatusItem,
  LimitationTimelineEvent,
  OverviewKpiData,
  UpcomingSolutionItem,
} from './types';
import './OverviewTab.css';

export type OverviewTabProps = {
  /** Переход ко вкладке «Предупреждения» */
  onOpenWarnings?: () => void;
  /** Переход ко вкладке «Дорожные карты» */
  onOpenRoadmap?: () => void;
};

/** Базовые KPI по макету */
const DEFAULT_KPI: OverviewKpiData = {
  criticalWarnings: 4,
  warningsDelta: -5,
  recommendationsTotal: 3,
  recommendationsPlanning: 2,
  licenceAreasWithLimits: 2,
  licenceAreasTotal: 5,
  nearestEventYear: 2031,
  nearestEventReadinessYear: 2033,
  scenarioName: 'Базовый сценарий',
  scenarioSubtitle: '2026–2046 · R-0042 · данные rev. 18',
};

/** Состояние по ЛУ по макету */
const DEFAULT_AREAS: LicenceAreaStatusItem[] = [
  {
    id: 'la-1',
    name: 'Чаяндинский',
    warningsCount: 9,
    criticality: 'Критичная',
    level: 'critical',
    percentage: 85,
  },
  {
    id: 'la-2',
    name: 'Тас-Юряхский',
    warningsCount: 10,
    criticality: 'Высокая',
    level: 'high',
    percentage: 75,
  },
  {
    id: 'la-3',
    name: 'Игнялинский',
    warningsCount: 5,
    criticality: 'Высокая',
    level: 'high',
    percentage: 45,
  },
  {
    id: 'la-4',
    name: 'Верхневилючанский',
    warningsCount: 2,
    criticality: 'Средняя',
    level: 'medium',
    percentage: 20,
  },
  {
    id: 'la-5',
    name: 'Талаканский',
    warningsCount: 1,
    criticality: 'Средняя',
    level: 'medium',
    percentage: 10,
  },
];

/** Ключевые риски по макету */
const DEFAULT_RISKS: KeyRiskItem[] = [
  {
    id: 'risk-1',
    element: 'УПН-2',
    warning: 'Недостаточный резерв мощности',
    period: '2033–2035',
    criticalityLabel: 'Критичная',
    level: 'critical',
    solution: 'Модернизация',
  },
  {
    id: 'risk-2',
    element: 'Нефтепровод 01',
    warning: 'Минимальный гидравлический резерв',
    period: '2037–2040',
    criticalityLabel: 'Высокая',
    level: 'high',
    solution: 'Лупинг / маршрут',
  },
  {
    id: 'risk-3',
    element: 'Газопровод 03',
    warning: 'Vsg выше допустимого',
    period: '2028–2029',
    criticalityLabel: 'Средняя',
    level: 'medium',
    solution: 'Проверка режима',
  },
];

/** Ближайшие решения по макету */
const DEFAULT_SOLUTIONS: UpcomingSolutionItem[] = [
  {
    id: 'sol-1',
    startYear: 2031,
    target: 'УПН-2',
    action: 'Модернизация',
    readinessYear: 2033,
  },
  {
    id: 'sol-2',
    startYear: 2035,
    target: 'Нефтепровод 01',
    action: 'Лупинг / изменение маршрута',
    readinessYear: 2037,
  },
  {
    id: 'sol-3',
    startYear: 2029,
    target: 'ГП-1',
    action: 'Проверка режима / сроков',
    readinessYear: 2030,
  },
];

/** Старты мероприятий по годам для графика */
const TIMELINE_EVENTS: LimitationTimelineEvent[] = [
  { year: 2031, label: 'старт 2031' },
  { year: 2035, label: 'старт 2035' },
  { year: 2039, label: 'старт 2039' },
];

/** Кривая ограничений: плавный рост с 2026 к 2046. */
const CHART_YEARS = [2026, 2028, 2030, 2032, 2034, 2036, 2038, 2040, 2042, 2044, 2046];
const CHART_CURVE = [
  { year: 2026, val: 2 },
  { year: 2028, val: 3 },
  { year: 2030, val: 4 },
  { year: 2032, val: 8 },
  { year: 2034, val: 12 },
  { year: 2036, val: 15 },
  { year: 2038, val: 18 },
  { year: 2040, val: 22 },
  { year: 2042, val: 25 },
  { year: 2044, val: 27 },
  { year: 2046, val: 29 },
];
/** Подписи лет на оси X. */
const X_AXIS_YEARS = [2026, 2030, 2034, 2038, 2042, 2046];
const FIRST_YEAR = 2026;
const LAST_YEAR = 2046;
/** Геометрия области построения графика (viewBox 600×200). */
const CHART = { leftX: 40, rightX: 560, topY: 25, bottomY: 160, maxVal: 32 };

export function OverviewTab({ onOpenWarnings, onOpenRoadmap }: OverviewTabProps) {
  const { vertices, pipelines, areas } = useMapDrawing();

  // Динамически обогащаем KPI данными из доменной модели
  const kpi = useMemo<OverviewKpiData>(() => {
    const criticalCount = vertices.filter((v) => v.status === 'warning').length;
    return {
      ...DEFAULT_KPI,
      criticalWarnings: criticalCount > 0 ? criticalCount : DEFAULT_KPI.criticalWarnings,
      licenceAreasTotal: areas.length > 0 ? areas.length : DEFAULT_KPI.licenceAreasTotal,
    };
  }, [vertices, areas]);

  // Список ЛУ
  const licenceAreasList = useMemo<LicenceAreaStatusItem[]>(() => {
    if (areas.length === 0) return DEFAULT_AREAS;
    return areas.map((a, idx) => ({
      id: a.id,
      name: a.label,
      warningsCount: Math.max(1, 10 - idx * 2),
      criticality: idx === 0 ? 'Критичная' : idx < 3 ? 'Высокая' : 'Средняя',
      level: idx === 0 ? 'critical' : idx < 3 ? 'high' : 'medium',
      percentage: Math.max(15, 85 - idx * 18),
    }));
  }, [areas]);

  // Риски текущего сценария
  const risks = useMemo<KeyRiskItem[]>(() => {
    if (vertices.length === 0 && pipelines.length === 0) return DEFAULT_RISKS;
    const items: KeyRiskItem[] = [];
    const upn = vertices.find((v) => v.label.toLowerCase().includes('упн') || v.label.toLowerCase().includes('бмупн'));
    if (upn) {
      items.push({
        id: `risk-${upn.id}`,
        element: upn.label,
        warning: 'Недостаточный резерв мощности',
        period: '2033–2035',
        criticalityLabel: 'Критичная',
        level: 'critical',
        solution: 'Модернизация',
      });
    }
    const pipe = pipelines[0];
    if (pipe) {
      items.push({
        id: `risk-${pipe.id}`,
        element: pipe.label,
        warning: 'Минимальный гидравлический резерв',
        period: '2037–2040',
        criticalityLabel: 'Высокая',
        level: 'high',
        solution: 'Лупинг / маршрут',
      });
    }
    return items.length > 0 ? items : DEFAULT_RISKS;
  }, [vertices, pipelines]);

  // Геометрия SVG-графика (координаты вынесены в константы выше)
  const chart = useMemo(() => {
    const { leftX, rightX, topY, bottomY, maxVal } = CHART;
    const width = rightX - leftX;
    const height = bottomY - topY;

    const xForYear = (yr: number) => {
      const idx = CHART_YEARS.indexOf(yr);
      const frac = idx >= 0 ? idx / (CHART_YEARS.length - 1) : (yr - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR);
      return leftX + frac * width;
    };

    const yForVal = (val: number) => bottomY - (val / maxVal) * height;
    return {
      mappedCurve,
      linePath,
      areaPath,
      eventMarkers: TIMELINE_EVENTS.map((ev) => ({
        ...ev,
        x: xForYear(ev.year),
        y: yForVal(curvePoints.find((cp) => cp.year === ev.year)?.val ?? 12),
      })),
      xAxis: X_AXIS_YEARS.map((yr) => ({
        year: yr,
        x: leftX + ((yr - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * width,
      })),
      leftX,
      rightX,
      bottomY,
    };
  }, []);

  const kpiItems: StatItem[] = [
    {
      key: 'critical',
      label: 'Критичные предупреждения',
      value: kpi.criticalWarnings,
      sub: `по текущему сценарию · Δ ${kpi.warningsDelta}`,
      tone: 'ui-tone-critical',
      size: 'lg',
    },
    {
      key: 'recommendations',
      label: 'Рекомендации к реализации',
      value: kpi.recommendationsTotal,
      sub: `${kpi.recommendationsPlanning} требуют планирования`,
      size: 'lg',
    },
    {
      key: 'areas',
      label: 'ЛУ с ограничениями',
      value: `${kpi.licenceAreasWithLimits} из ${kpi.licenceAreasTotal}`,
      sub: 'есть критичные зоны',
      size: 'lg',
    },
    {
      key: 'next-event',
      label: 'Ближайший старт мероприятия',
      value: kpi.nearestEventYear,
      sub: `для готовности к ${kpi.nearestEventReadinessYear}`,
      tone: 'ui-tone-primary',
      size: 'lg',
    },
    {
      key: 'context',
      label: 'Контекст',
      value: kpi.scenarioName,
      sub: kpi.scenarioSubtitle,
      size: 'text',
    },
  ];

  const riskColumns: DataTableColumn<KeyRiskItem>[] = [
    { key: 'element', header: 'Элемент', cell: (r) => r.element, className: 'ui-table__elem' },
    { key: 'warning', header: 'Предупреждение', cell: (r) => r.warning },
    { key: 'period', header: 'Период', cell: (r) => r.period, numeric: true },
    {
      key: 'criticality',
      header: 'Критичность',
      cell: (r) => (
        <span className={`ui-table__level ${criticalityToneClass(r.level)}`}>{r.criticalityLabel}</span>
      ),
    },
    {
      key: 'solution',
      header: 'Решение',
      cell: (r) => (
        <button type="button" className="overview-tab__table-solution" onClick={onOpenRoadmap}>
          {r.solution}
        </button>
      ),
    },
  ];

  return (
    <div className="overview-tab">
      {/* 1. Верхний ряд: 5 KPI-карточек */}
      <StatGrid items={kpiItems} columns={5} stackSub ariaLabel="Ключевые показатели сценария" />

      {/* 2. Средний ряд: График ограничений + Состояние по ЛУ */}
      <div className="ui-grid ui-grid--2">
        {/* Карточка 1: График ограничений и стартов */}
        <div className="ui-card">
          <h2 className="ui-card__heading">
            Когда возникают ограничения и начинаются мероприятия
          </h2>
          <p className="ui-card__desc">
            Количество активных предупреждений по годам и рекомендуемые старты мероприятия.
          </p>

          <div className="overview-tab__chart-wrap">
            <svg
              className="ui-chart"
              viewBox="0 0 600 200"
              preserveAspectRatio="none"
              role="img"
              aria-label="График ограничений и стартов мероприятий"
            >
              {/* Сетка */}
              {[35, 75, 115].map((y) => (
                <line
                  key={y}
                  x1={chart.leftX}
                  y1={y}
                  x2={chart.rightX}
                  y2={y}
                  stroke="var(--slate-100)"
                  strokeDasharray="3 3"
                />
              ))}
              <line
                x1={chart.leftX}
                y1={chart.bottomY}
                x2={chart.rightX}
                y2={chart.bottomY}
                stroke="var(--slate-200)"
              />

              {/* Полупрозрачная заливка под кривой ограничений */}
              <polygon points={chart.areaPath} fill="var(--level-high)" opacity="0.25" />

              {/* Кривая активных предупреждений */}
              <polyline
                fill="none"
                stroke="var(--level-high)"
                strokeWidth="2.5"
                points={chart.linePath}
              />

              {/* Точки на кривой */}
              {chart.mappedCurve.map((p) => (
                <circle
                  key={p.year}
                  cx={p.cx}
                  cy={p.cy}
                  r={3.5}
                  fill="var(--level-high)"
                />
              ))}

              {/* Вертикальные линии рекомендуемых стартов мероприятий */}
              {chart.eventMarkers.map((ev) => (
                <g key={ev.year}>
                  <line
                    x1={ev.x}
                    y1="20"
                    x2={ev.x}
                    y2={chart.bottomY}
                    stroke="var(--chart-accent)"
                    strokeDasharray="3 2"
                    strokeWidth="1.5"
                  />
                  <circle cx={ev.x} cy="20" r="4.5" fill="#0284c7" />
                  <rect
                    x={ev.x - 38}
                    y="4"
                    width="76"
                    height="18"
                    rx="4"
                    fill="var(--chart-accent)"
                  />
                  <text
                    x={ev.x}
                    y="16"
                    fontSize="10"
                    fontWeight="700"
                    fill="#ffffff"
                    textAnchor="middle"
                  >
                    {ev.label}
                  </text>
                </g>
              ))}

              {/* Временная шкала X */}
              {chart.xAxis.map(({ year, x }) => (
                <text
                  key={year}
                  x={x}
                  y="184"
                  fontSize="11"
                  fill="var(--slate-500)"
                  textAnchor="middle"
                >
                  {year}
                </text>
              ))}
            </svg>

            {/* Легенда под графиком */}
            <div className="ui-legend">
              <div className="ui-legend__item">
                <span className="ui-legend__dot" style={{ backgroundColor: 'var(--level-high)' }} />
                <span>активные предупреждения</span>
              </div>
              <div className="ui-legend__item">
                <span className="ui-legend__dot" style={{ backgroundColor: 'var(--chart-accent)' }} />
                <span>рекомендуемый старт</span>
              </div>
            </div>
          </div>
        </div>

        {/* Карточка 2: Состояние по ЛУ */}
        <div className="ui-card">
          <h2 className="ui-card__heading">Состояние по ЛУ</h2>
          <p className="ui-card__desc">Количество предупреждений и максимальная критичность.</p>

          <div className="overview-tab__areas-list">
            {licenceAreasList.map((area) => (
              <div key={area.id} className="overview-tab__area-row">
                <span className="overview-tab__area-name">{area.name}</span>
                <div className="overview-tab__area-bar-wrap">
                  <div
                    className={`overview-tab__area-bar ${criticalityToneClass(area.level)}`}
                    style={{ width: `${area.percentage}%` }}
                  />
                </div>
                <span className="overview-tab__area-count">{area.warningsCount}</span>
                <span className={`overview-tab__area-crit ${criticalityToneClass(area.level)}`}>
                  {area.criticality}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Нижний ряд: Ключевые риски + Ближайшие решения */}
      <div className="ui-grid ui-grid--2">
        {/* Карточка 1: Ключевые риски текущего сценария */}
        <div className="ui-card">
          <h2 className="ui-card__heading">Ключевые риски текущего сценария</h2>
          <p className="ui-card__desc">
            Приоритетные предупреждения, которые требуют управленческого внимания.
          </p>

          <DataTable
            columns={riskColumns}
            rows={risks}
            rowKey={(r) => r.id}
            ariaLabel="Ключевые риски"
          />

          {onOpenWarnings && (
            <button
              type="button"
              className="overview-tab__btn-link"
              onClick={onOpenWarnings}
            >
              Открыть все предупреждения
            </button>
          )}
        </div>

        {/* Карточка 2: Ближайшие решения */}
        <div className="ui-card">
          <h2 className="ui-card__heading">Ближайшие решения</h2>
          <p className="ui-card__desc">
            Мероприятия, для которых срок начала следует контролировать в первую очередь.
          </p>

          <div className="overview-tab__solutions-list">
            {DEFAULT_SOLUTIONS.map((sol) => (
              <div key={sol.id} className="overview-tab__solution-item">
                <div className="overview-tab__solution-badge">{sol.startYear}</div>
                <div className="overview-tab__solution-info">
                  <div className="overview-tab__solution-title">
                    {sol.target} · {sol.action}
                  </div>
                  <div className="overview-tab__solution-sub">
                    готовность: {sol.readinessYear}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {onOpenRoadmap && (
            <button
              type="button"
              className="overview-tab__btn-link"
              onClick={onOpenRoadmap}
            >
              Открыть дорожную карту
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
