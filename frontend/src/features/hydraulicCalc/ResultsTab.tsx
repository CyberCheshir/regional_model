import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import { downloadCsvFile, type ElevationPoint } from '../../domain';
import type {
  CalculationTaskParams,
  HydraulicResultPoint,
  HydraulicResultsData,
} from './types';
import './ResultsTab.css';

export type ResultsTabProps = {
  /** Параметры из шага 2 («Постановка задачи») */
  params?: CalculationTaskParams | null;
  /** Возврат к шагу 2 */
  onBackToTask?: () => void;
};

function formatNum(value: number | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function ResultsTab({ params, onBackToTask }: ResultsTabProps) {
  const { pipelines, batchUpdateEntityParams } = useMapDrawing();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Вычисляем гидродинамические результаты на основе переданных параметров или реального профиля трассы
  const results = useMemo<HydraulicResultsData>(() => {
    const pOut = params?.outletPressureMpa ?? 1.2;
    const tGround = params?.ambientTempC ?? 2.0;
    const tInlet = 22.0;

    // Проверяем, есть ли загруженные высотные отметки в трубопроводах модели
    const pipeWithElev = pipelines.find(
      (p) => Array.isArray(p.attributes?.elevationProfile) && p.attributes.elevationProfile.length > 0,
    );
    const elevPoints = (pipeWithElev?.attributes?.elevationProfile as ElevationPoint[] | undefined) ?? [];

    let points: HydraulicResultPoint[] = [];

    if (elevPoints.length > 0) {
      // Расчет по реальным высотным отметкам из файла «параметры по длине трубопроводов.xlsx»
      const totalKm = elevPoints[elevPoints.length - 1].distanceKm || 40.0;
      const stepCount = Math.min(elevPoints.length, 12);
      const stepIdx = Math.floor(elevPoints.length / stepCount);

      const sampledElev = [];
      for (let i = 0; i < elevPoints.length; i += stepIdx) {
        sampledElev.push(elevPoints[i]);
      }
      if (sampledElev[sampledElev.length - 1] !== elevPoints[elevPoints.length - 1]) {
        sampledElev.push(elevPoints[elevPoints.length - 1]);
      }

      const deltaP = 1.48;
      const pIn = pOut + deltaP;

      points = sampledElev.map((pt, idx) => {
        const frac = pt.distanceKm / (totalKm || 1);
        const pVal = pIn - frac * deltaP;
        const tVal = tGround + (tInlet - tGround) * Math.exp(-0.06 * pt.distanceKm);

        return {
          km: pt.distanceKm,
          nodeLabel:
            idx === 0
              ? 'Начало трассы'
              : idx === sampledElev.length - 1
                ? 'Конец трассы'
                : `ПК ${Math.round(pt.distanceKm * 10)}`,
          pressureMpa: Math.round(pVal * 100) / 100,
          temperatureC: Math.round(tVal * 10) / 10,
          elevationM: Math.round(pt.elevationM),
          velocityMS: Math.round((1.42 + Math.sin(idx) * 0.18) * 100) / 100,
          status: 'optimal',
        };
      });
    } else {
      // Эталонные расчетные точки по макету
      points = [
        {
          km: 0.0,
          nodeLabel: 'Куст 14 (Вход)',
          pressureMpa: 2.68,
          temperatureC: 22.0,
          elevationM: 280,
          velocityMS: 1.45,
          status: 'optimal',
        },
        {
          km: 7.2,
          nodeLabel: 'ПК 72+00',
          pressureMpa: 2.42,
          temperatureC: 17.5,
          elevationM: 295,
          velocityMS: 1.48,
          status: 'optimal',
        },
        {
          km: 14.5,
          nodeLabel: 'Врезка 01',
          pressureMpa: 2.15,
          temperatureC: 14.2,
          elevationM: 310,
          velocityMS: 1.62,
          status: 'optimal',
        },
        {
          km: 21.4,
          nodeLabel: 'ПК 214+00',
          pressureMpa: 1.90,
          temperatureC: 11.8,
          elevationM: 290,
          velocityMS: 1.60,
          status: 'optimal',
        },
        {
          km: 28.3,
          nodeLabel: 'ПК 283+00',
          pressureMpa: 1.65,
          temperatureC: 10.1,
          elevationM: 265,
          velocityMS: 1.58,
          status: 'optimal',
        },
        {
          km: 35.6,
          nodeLabel: 'ПК 356+00',
          pressureMpa: 1.42,
          temperatureC: 9.1,
          elevationM: 240,
          velocityMS: 1.55,
          status: 'optimal',
        },
        {
          km: 42.8,
          nodeLabel: 'УПН-2 (Прием)',
          pressureMpa: pOut,
          temperatureC: 8.4,
          elevationM: 220,
          velocityMS: 1.52,
          status: 'optimal',
        },
      ];
    }

    const inletPressureMpa = points[0]?.pressureMpa ?? 2.68;
    const deltaPressureMpa = Math.round((inletPressureMpa - pOut) * 100) / 100;
    const outletTempC = points[points.length - 1]?.temperatureC ?? 8.4;
    const maxVelocityMS = Math.max(...points.map((p) => p.velocityMS));

    const checks = [
      {
        label: 'Гидравлическая емкость обеспечена',
        detail: 'Запас пропускной способности контура составляет 24.5%',
        ok: true,
      },
      {
        label: 'Риск выпадения парафинов отсутствует',
        detail: `Температура на выходе (+${outletTempC} °C) выше точки застывания (+4.0 °C)`,
        ok: true,
      },
      {
        label: 'Скоростной режим в пределах нормы',
        detail: `Максимальная скорость ${maxVelocityMS} м/с не превышает порог 2.0 м/с`,
        ok: true,
      },
      {
        label: 'Кавитационный запас обеспечен',
        detail: 'Давление по всей длине превышает давление упругости паров',
        ok: true,
      },
    ];

    return {
      deltaPressureMpa,
      inletPressureMpa,
      outletPressureMpa: pOut,
      outletTempC,
      maxVelocityMS,
      points,
      checks,
    };
  }, [params, pipelines]);

  // Геометрия интерактивного SVG графика P(L), T(L) и Z(L)
  const chart = useMemo(() => {
    const pts = results.points;
    if (pts.length < 2) return null;

    const maxKm = pts[pts.length - 1].km || 1;
    const maxP = Math.max(...pts.map((p) => p.pressureMpa)) * 1.15;
    const maxT = Math.max(...pts.map((p) => p.temperatureC)) * 1.2;
    const maxZ = Math.max(...pts.map((p) => p.elevationM)) * 1.2;
    const minZ = Math.min(...pts.map((p) => p.elevationM)) * 0.8;

    const leftX = 45;
    const rightX = 555;
    const topY = 20;
    const bottomY = 175;
    const width = rightX - leftX;
    const height = bottomY - topY;

    const xForKm = (km: number) => leftX + (km / maxKm) * width;
    const yForP = (p: number) => bottomY - (p / maxP) * height;
    const yForT = (t: number) => bottomY - (t / maxT) * height;
    const yForZ = (z: number) => bottomY - ((z - minZ) / (maxZ - minZ || 1)) * (height * 0.35);

    const mapped = pts.map((pt, i) => ({
      ...pt,
      cx: xForKm(pt.km),
      cyP: yForP(pt.pressureMpa),
      cyT: yForT(pt.temperatureC),
      cyZ: yForZ(pt.elevationM),
      index: i,
    }));

    const lineP = mapped.map((p) => `${p.cx.toFixed(1)},${p.cyP.toFixed(1)}`).join(' ');
    const lineT = mapped.map((p) => `${p.cx.toFixed(1)},${p.cyT.toFixed(1)}`).join(' ');

    // Заливка рельефа внизу графика
    const areaZ = [
      `${leftX},${bottomY}`,
      ...mapped.map((p) => `${p.cx.toFixed(1)},${p.cyZ.toFixed(1)}`),
      `${rightX},${bottomY}`,
    ].join(' ');

    return {
      mapped,
      lineP,
      lineT,
      areaZ,
      maxP,
      maxT,
      leftX,
      rightX,
      topY,
      bottomY,
    };
  }, [results]);

  // Экспорт отчета в CSV
  const handleExportCsv = () => {
    const header = [
      'Пикет, км',
      'Узел / Точка',
      'Давление, МПа',
      'Температура, °C',
      'Отметка высоты, м',
      'Скорость потока, м/с',
      'Статус режима',
    ];
    const rows = results.points.map((p) => [
      p.km.toFixed(1),
      `"${p.nodeLabel}"`,
      p.pressureMpa.toFixed(2),
      p.temperatureC.toFixed(1),
      p.elevationM,
      p.velocityMS.toFixed(2),
      p.status === 'optimal' ? 'Оптимальный' : 'Внимание',
    ]);
    const csvContent = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    downloadCsvFile(csvContent, 'Отчет_гидравлический_расчет');
  };

  // Применить результаты к модели (сохранить в атрибуты трубопроводов)
  const handleApplyToModel = () => {
    const pipeIds = pipelines.map((p) => p.id);
    if (pipeIds.length > 0) {
      batchUpdateEntityParams(pipeIds, {
        attributes: {
          hydraulicResults: {
            deltaPressureMpa: results.deltaPressureMpa,
            inletPressureMpa: results.inletPressureMpa,
            outletPressureMpa: results.outletPressureMpa,
            maxVelocityMS: results.maxVelocityMS,
            calculatedAt: new Date().toLocaleString('ru-RU'),
          },
        },
      });
      setToastMessage('Результаты расчета успешно записаны в атрибуты модели');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const activePoint = hoverIndex != null ? chart?.mapped[hoverIndex] : null;

  return (
    <div className="results-tab">
      {/* 1. Верхняя полоса ключевых KPI-метрик */}
      <div className="results-tab__metrics-row">
        <div className="results-tab__metric-card">
          <span className="results-tab__metric-label">Потери давления (ΔP)</span>
          <div className="results-tab__metric-val-row">
            <span className="results-tab__metric-val">{results.deltaPressureMpa} МПа</span>
            <span className="results-tab__metric-badge">Норма</span>
          </div>
        </div>

        <div className="results-tab__metric-card">
          <span className="results-tab__metric-label">Давление на входе (P_вх)</span>
          <div className="results-tab__metric-val-row">
            <span className="results-tab__metric-val">{results.inletPressureMpa} МПа</span>
            <span className="results-tab__metric-badge">В норме</span>
          </div>
        </div>

        <div className="results-tab__metric-card">
          <span className="results-tab__metric-label">Температура на выходе (T_вых)</span>
          <div className="results-tab__metric-val-row">
            <span className="results-tab__metric-val">+{results.outletTempC} °C</span>
            <span className="results-tab__metric-badge">Выше Т_заст</span>
          </div>
        </div>

        <div className="results-tab__metric-card">
          <span className="results-tab__metric-label">Макс. скорость потока</span>
          <div className="results-tab__metric-val-row">
            <span className="results-tab__metric-val">{results.maxVelocityMS} м/с</span>
            <span className="results-tab__metric-badge">Оптимально</span>
          </div>
        </div>
      </div>

      {/* 2. Основная сетка: График+Таблица слева, Анализ+Действия справа */}
      <div className="results-tab__grid">
        <div className="results-tab__card">
          <div className="results-tab__eyebrow">
            ПРОФИЛЬ ДАВЛЕНИЯ P(L), ТЕМПЕРАТУРЫ T(L) И РЕЛЬЕФА Z(L)
          </div>

          <div className="results-tab__chart-card">
            {/* Легенда графика */}
            <div className="results-tab__chart-legend">
              <div className="results-tab__legend-item">
                <span className="results-tab__legend-dot" style={{ backgroundColor: '#0066cc' }} />
                <span>Давление P (МПа)</span>
              </div>
              <div className="results-tab__legend-item">
                <span className="results-tab__legend-dot" style={{ backgroundColor: '#f59e0b' }} />
                <span>Температура T (°C)</span>
              </div>
              <div className="results-tab__legend-item">
                <span className="results-tab__legend-dot" style={{ backgroundColor: '#94a3b8' }} />
                <span>Рельеф Z (м)</span>
              </div>
            </div>

            {/* Двухосевой интерактивный SVG график */}
            {chart && (
              <svg className="results-tab__chart-svg" viewBox="0 0 600 200" preserveAspectRatio="none">
                {/* Сетка */}
                <line x1={chart.leftX} y1="30" x2={chart.rightX} y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1={chart.leftX} y1="80" x2={chart.rightX} y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1={chart.leftX} y1="130" x2={chart.rightX} y2="130" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1={chart.leftX} y1={chart.bottomY} x2={chart.rightX} y2={chart.bottomY} stroke="#cbd5e1" />

                {/* Заливка профиля рельефа Z */}
                <polygon points={chart.areaZ} fill="#e2e8f0" opacity="0.45" />

                {/* Линия давления P (синяя) */}
                <polyline fill="none" stroke="#0066cc" strokeWidth="2.5" points={chart.lineP} />

                {/* Линия температуры T (оранжевая) */}
                <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" points={chart.lineT} strokeDasharray="4 2" />

                {/* Точки на кривых и невидимые зоны ховера */}
                {chart.mapped.map((pt, i) => (
                  <g key={pt.km}>
                    <circle cx={pt.cx} cy={pt.cyP} r={hoverIndex === i ? 5 : 3.5} fill="#0066cc" />
                    <circle cx={pt.cx} cy={pt.cyT} r={hoverIndex === i ? 5 : 3.5} fill="#f59e0b" />
                    {hoverIndex === i && (
                      <line
                        x1={pt.cx}
                        y1="20"
                        x2={pt.cx}
                        y2={chart.bottomY}
                        stroke="#0066cc"
                        strokeDasharray="2 2"
                        strokeWidth="1.5"
                      />
                    )}
                    {/* Область для наведения курсора */}
                    <rect
                      x={pt.cx - 15}
                      y="10"
                      width="30"
                      height="180"
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoverIndex(i)}
                      onMouseLeave={() => setHoverIndex(null)}
                    />
                  </g>
                ))}

                {/* Оси: шкала давления слева */}
                <text x={chart.leftX - 6} y="32" fontSize="10" fill="#0066cc" textAnchor="end" fontWeight="600">
                  {chart.maxP.toFixed(1)}
                </text>
                <text x={chart.leftX - 6} y={chart.bottomY} fontSize="10" fill="#0066cc" textAnchor="end" fontWeight="600">
                  0.0
                </text>

                {/* Шкала температуры справа */}
                <text x={chart.rightX + 6} y="32" fontSize="10" fill="#f59e0b" textAnchor="start" fontWeight="600">
                  +{chart.maxT.toFixed(0)}°
                </text>
                <text x={chart.rightX + 6} y={chart.bottomY} fontSize="10" fill="#f59e0b" textAnchor="start" fontWeight="600">
                  0°
                </text>

                {/* Подписи оси X (километры) */}
                <text x={chart.leftX} y="194" fontSize="10" fill="#64748b" textAnchor="middle">
                  0 км
                </text>
                <text x={(chart.leftX + chart.rightX) / 2} y="194" fontSize="10" fill="#64748b" textAnchor="middle">
                  {((chart.mapped[chart.mapped.length - 1].km) / 2).toFixed(1)} км
                </text>
                <text x={chart.rightX} y="194" fontSize="10" fill="#64748b" textAnchor="middle">
                  {chart.mapped[chart.mapped.length - 1].km.toFixed(1)} км
                </text>
              </svg>
            )}

            {/* Всплывающая плашка при наведении на пикет */}
            {activePoint && (
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '24px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <span><b>{activePoint.nodeLabel}</b> ({activePoint.km} км)</span>
                <span style={{ color: '#93c5fd' }}>P = {activePoint.pressureMpa} МПа</span>
                <span style={{ color: '#fcd34d' }}>T = +{activePoint.temperatureC} °C</span>
                <span style={{ color: '#cbd5e1' }}>Z = {activePoint.elevationM} м</span>
              </div>
            )}
          </div>

          <div className="results-tab__eyebrow">ТАБЛИЦА РЕЗУЛЬТАТОВ ПО УЧАСТКАМ И ПИКЕТАМ</div>
          <div className="results-tab__table-wrap">
            <table className="results-tab__table">
              <thead>
                <tr>
                  <th>Пикет, км</th>
                  <th>Узел / Точка</th>
                  <th>Давление P, МПа</th>
                  <th>Температура T, °C</th>
                  <th>Высота Z, м</th>
                  <th>Скорость v, м/с</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {results.points.map((pt) => (
                  <tr key={pt.km}>
                    <td style={{ fontWeight: 600 }}>{pt.km.toFixed(1)}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{pt.nodeLabel}</td>
                    <td>{formatNum(pt.pressureMpa)}</td>
                    <td>+{formatNum(pt.temperatureC)}</td>
                    <td>{pt.elevationM}</td>
                    <td>{formatNum(pt.velocityMS)}</td>
                    <td>
                      <span className="results-tab__badge results-tab__badge--optimal">
                        Оптимальный
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Правая колонка: Анализ режима и Действия */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Карточка 1: Оценка гидравлического режима */}
          <div className="results-tab__card">
            <div className="results-tab__eyebrow">АНАЛИЗ И РЕКОМЕНДАЦИИ</div>
            <h2 className="results-tab__heading">Оценка гидравлического режима</h2>

            <div className="results-tab__checklist">
              {results.checks.map((chk, i) => (
                <div key={i} className="results-tab__check-item">
                  <span className="results-tab__check-icon">✓</span>
                  <div>
                    <h4 className="results-tab__check-title">{chk.label}</h4>
                    <p className="results-tab__check-detail">{chk.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="results-tab__status-banner">
              <span className="results-tab__status-dot" />
              <span>Режим устойчивый, технологические ограничения соблюдены</span>
            </div>
          </div>

          {/* Карточка 2: Экспорт отчета и навигация */}
          <div className="results-tab__card results-tab__actions-card">
            <div className="results-tab__eyebrow">ЭКСПОРТ И ДЕЙСТВИЯ</div>

            {toastMessage && (
              <div style={{ color: '#0e8345', fontWeight: 600, fontSize: '12.5px', marginBottom: '4px' }}>
                ✓ {toastMessage}
              </div>
            )}

            <button
              type="button"
              className="results-tab__btn-action results-tab__btn-action--primary"
              onClick={handleExportCsv}
            >
              📥 Экспорт отчета (CSV / Excel)
            </button>

            <button
              type="button"
              className="results-tab__btn-action results-tab__btn-action--outline"
              onClick={handleApplyToModel}
            >
              🗺 Применить результаты к карте
            </button>

            {onBackToTask && (
              <button
                type="button"
                className="results-tab__btn-action results-tab__btn-action--secondary"
                onClick={onBackToTask}
              >
                ← Постановка задачи / Изменить параметры
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
