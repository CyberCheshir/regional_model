import { useMemo } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
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

  // Геометрия SVG-графика
  const chart = useMemo(() => {
    const years = [2026, 2028, 2030, 2032, 2034, 2036, 2038, 2040, 2042, 2044, 2046];
    const leftX = 40;
    const rightX = 560;
    const topY = 25;
    const bottomY = 160;
    const width = rightX - leftX;
    const height = bottomY - topY;

    // Кривая ограничений: плавный рост с 2026 к 2046
    const curvePoints = [
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
    const maxVal = 32;

    const xForYear = (yr: number) => {
      const idx = years.indexOf(yr);
      const frac = idx >= 0 ? idx / (years.length - 1) : (yr - 2026) / 20;
      return leftX + frac * width;
    };

    const yForVal = (val: number) => bottomY - (val / maxVal) * height;

    const mappedCurve = curvePoints.map((p) => ({
      ...p,
      cx: xForYear(p.year),
      cy: yForVal(p.val),
    }));

    const linePath = mappedCurve.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
    const areaPath = [
      `${leftX},${bottomY}`,
      ...mappedCurve.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`),
      `${rightX},${bottomY}`,
    ].join(' ');

    const eventMarkers = TIMELINE_EVENTS.map((ev) => ({
      ...ev,
      x: xForYear(ev.year),
      yCurve: yForVal(curvePoints.find((cp) => cp.year === ev.year)?.val ?? 12),
    }));

    return {
      years,
      mappedCurve,
      linePath,
      areaPath,
      eventMarkers,
      leftX,
      rightX,
      bottomY,
    };
  }, []);

  return (
    <div className="overview-tab">
      {/* 1. Верхний ряд: 5 KPI-карточек */}
      <div className="overview-tab__kpi-row">
        <div className="overview-tab__kpi-card">
          <div className="overview-tab__kpi-head">
            <span className="overview-tab__kpi-title">Критичные предупреждения</span>
            <span className="overview-tab__kpi-delta">{kpi.warningsDelta}</span>
          </div>
          <div className="overview-tab__kpi-value overview-tab__kpi-value--critical">
            {kpi.criticalWarnings}
          </div>
          <span className="overview-tab__kpi-sub">по текущему сценарию</span>
        </div>

        <div className="overview-tab__kpi-card">
          <div className="overview-tab__kpi-head">
            <span className="overview-tab__kpi-title">Рекомендации к реализации</span>
          </div>
          <div className="overview-tab__kpi-value">{kpi.recommendationsTotal}</div>
          <span className="overview-tab__kpi-sub">{kpi.recommendationsPlanning} требуют планирования</span>
        </div>

        <div className="overview-tab__kpi-card">
          <div className="overview-tab__kpi-head">
            <span className="overview-tab__kpi-title">ЛУ с ограничениями</span>
          </div>
          <div className="overview-tab__kpi-value">
            {kpi.licenceAreasWithLimits} из {kpi.licenceAreasTotal}
          </div>
          <span className="overview-tab__kpi-sub">есть критичные зоны</span>
        </div>

        <div className="overview-tab__kpi-card">
          <div className="overview-tab__kpi-head">
            <span className="overview-tab__kpi-title">Ближайший старт мероприятия</span>
          </div>
          <div className="overview-tab__kpi-value overview-tab__kpi-value--blue">
            {kpi.nearestEventYear}
          </div>
          <span className="overview-tab__kpi-sub">для готовности к {kpi.nearestEventReadinessYear}</span>
        </div>

        <div className="overview-tab__kpi-card">
          <div className="overview-tab__kpi-head">
            <span className="overview-tab__kpi-title">Контекст</span>
          </div>
          <div className="overview-tab__kpi-value overview-tab__kpi-value--text">
            {kpi.scenarioName}
          </div>
          <span className="overview-tab__kpi-sub">{kpi.scenarioSubtitle}</span>
        </div>
      </div>

      {/* 2. Средний ряд: График ограничений + Состояние по ЛУ */}
      <div className="overview-tab__grid">
        {/* Карточка 1: График ограничений и стартов */}
        <div className="overview-tab__card">
          <h2 className="overview-tab__heading">
            Когда возникают ограничения и начинаются мероприятия
          </h2>
          <p className="overview-tab__desc">
            Количество активных предупреждений по годам и рекомендуемые старты мероприятий.
          </p>

          <div className="overview-tab__chart-wrap">
            <svg className="overview-tab__chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
              {/* Сетка */}
              <line x1={chart.leftX} y1="35" x2={chart.rightX} y2="35" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1={chart.leftX} y1="75" x2={chart.rightX} y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1={chart.leftX} y1="115" x2={chart.rightX} y2="115" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1={chart.leftX} y1={chart.bottomY} x2={chart.rightX} y2={chart.bottomY} stroke="#e2e8f0" />

              {/* Полупрозрачная заливка под кривой ограничений */}
              <polygon points={chart.areaPath} fill="#fed7aa" opacity="0.35" />

              {/* Кривая активных предупреждений */}
              <polyline fill="none" stroke="#ea580c" strokeWidth="2.5" points={chart.linePath} />

              {/* Точки на кривой */}
              {chart.mappedCurve.map((p) => (
                <circle
                  key={p.year}
                  cx={p.cx}
                  cy={p.cy}
                  r={3.5}
                  fill="#ea580c"
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
                    stroke="#0284c7"
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
                    fill="#0284c7"
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
              {[2026, 2030, 2034, 2038, 2042, 2046].map((yr) => {
                const frac = (yr - 2026) / 20;
                const x = chart.leftX + frac * (chart.rightX - chart.leftX);
                return (
                  <text key={yr} x={x} y="184" fontSize="11" fill="#64748b" textAnchor="middle">
                    {yr}
                  </text>
                );
              })}
            </svg>

            {/* Легенда под графиком */}
            <div className="overview-tab__chart-legend">
              <div className="overview-tab__legend-item">
                <span className="overview-tab__legend-dot" style={{ backgroundColor: '#ea580c' }} />
                <span>активные предупреждения</span>
              </div>
              <div className="overview-tab__legend-item">
                <span className="overview-tab__legend-dot" style={{ backgroundColor: '#0284c7' }} />
                <span>рекомендуемый старт</span>
              </div>
            </div>
          </div>
        </div>

        {/* Карточка 2: Состояние по ЛУ */}
        <div className="overview-tab__card">
          <h2 className="overview-tab__heading">Состояние по ЛУ</h2>
          <p className="overview-tab__desc">
            Количество предупреждений и максимальная критичность.
          </p>

          <div className="overview-tab__areas-list">
            {licenceAreasList.map((area) => {
              const barColor =
                area.level === 'critical'
                  ? '#dc2626'
                  : area.level === 'high'
                    ? '#ea580c'
                    : '#eab308';

              return (
                <div key={area.id} className="overview-tab__area-row">
                  <span className="overview-tab__area-name">{area.name}</span>
                  <div className="overview-tab__area-bar-wrap">
                    <div
                      className="overview-tab__area-bar"
                      style={{ width: `${area.percentage}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span className="overview-tab__area-count">{area.warningsCount}</span>
                  <span
                    className={`overview-tab__area-crit overview-tab__area-crit--${area.level}`}
                  >
                    {area.criticality}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Нижний ряд: Ключевые риски + Ближайшие решения */}
      <div className="overview-tab__grid">
        {/* Карточка 1: Ключевые риски текущего сценария */}
        <div className="overview-tab__card">
          <h2 className="overview-tab__heading">Ключевые риски текущего сценария</h2>
          <p className="overview-tab__desc">
            Приоритетные предупреждения, которые требуют управленческого внимания.
          </p>

          <div className="overview-tab__table-wrap">
            <table className="overview-tab__table">
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>Предупреждение</th>
                  <th>Период</th>
                  <th>Критичность</th>
                  <th>Решение</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((r) => {
                  const critColor =
                    r.level === 'critical'
                      ? '#dc2626'
                      : r.level === 'high'
                        ? '#ea580c'
                        : '#ca8a04';

                  return (
                    <tr key={r.id}>
                      <td className="overview-tab__table-element">{r.element}</td>
                      <td>{r.warning}</td>
                      <td>{r.period}</td>
                      <td className="overview-tab__table-crit" style={{ color: critColor }}>
                        {r.criticalityLabel}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="overview-tab__table-solution"
                          onClick={onOpenRoadmap}
                        >
                          {r.solution}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
        <div className="overview-tab__card">
          <h2 className="overview-tab__heading">Ближайшие решения</h2>
          <p className="overview-tab__desc">
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
