import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import { buildElementGroups } from '../../domain/elementGroups';
import { downloadDomainProfile, matchName } from '../../domain';
import type { ProductProfile } from '../../domain/types';
import './ProfilesTab.css';

const PRODUCT_LABEL: Record<string, string> = {
  oil: 'Нефть',
  gas: 'Газ',
  water: 'Вода',
  liquid: 'СГК / Жидкость',
};

const PRODUCT_COLOR: Record<string, string> = {
  oil: '#8b5a2b',
  gas: '#eab308',
  water: '#0284c7',
  liquid: '#9333ea',
};

function formatNum(value: number | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}

export function ProfilesTab({ onNotify }: { onNotify?: (message: string) => void }) {
  const { vertices, pipelines, segments, taps } = useMapDrawing();

  // Список объектов добычи, подготовки и трубопроводов из «Групп элементов»
  const availableEntities = useMemo(() => {
    const groups = buildElementGroups({ vertices, pipelines, segments, taps });
    const targetGroups = groups.filter(
      (g) =>
        g.id === 'group-wellpads' ||
        g.id === 'group-facilities' ||
        g.id === 'group-pipelines',
    );
    return targetGroups.flatMap((g) => g.children.map((c) => c.label));
  }, [vertices, pipelines, segments, taps]);

  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [profileSource, setProfileSource] = useState('АКСИОМА (базовый вариант)');
  const [autoBalance, setAutoBalance] = useState(true);
  const [showSecondaryGas, setShowSecondaryGas] = useState(true);

  // Если выбранный объект отсутствует в списке, мягко переключаем на первый доступный
  const currentEntity = availableEntities.includes(selectedEntity)
    ? selectedEntity
    : availableEntities[0] || '';

  // Извлекаем объект и его профиль из domain layer
  const activeEntityObj = useMemo(() => {
    return (
      vertices.find((v) => matchName(v.label, currentEntity)) ??
      pipelines.find((p) => matchName(p.label, currentEntity))
    );
  }, [vertices, pipelines, currentEntity]);

  const activeProfile = (activeEntityObj?.attributes?.productProfile as ProductProfile | undefined) ?? null;

  // Все серии текущего профиля из domain layer
  const activeSeries = useMemo(() => {
    if (!activeProfile || !activeProfile.series) return [];
    return activeProfile.series;
  }, [activeProfile]);

  // Все доступные годы из domain layer
  const allYears = useMemo(() => {
    if (!activeProfile || activeSeries.length === 0) return [];
    const yearSet = new Set<number>();
    for (const s of activeSeries) {
      for (const p of s.points) yearSet.add(p.year);
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [activeProfile, activeSeries]);

  // Контрольные годы для таблицы (выбираем равномерные вехи)
  const milestoneYears = useMemo(() => {
    if (allYears.length <= 8) return allYears;
    const step = Math.ceil((allYears.length - 1) / 5);
    const set = new Set<number>();
    set.add(allYears[0]);
    for (let i = step; i < allYears.length - 1; i += step) {
      set.add(allYears[i]);
    }
    set.add(allYears[allYears.length - 1]);
    return Array.from(set).sort((a, b) => a - b);
  }, [allYears]);

  // Геометрия SVG-графика для отображения кривых
  const chartGeometry = useMemo(() => {
    if (!activeProfile || activeSeries.length === 0 || allYears.length < 2) {
      return null;
    }
    const maxVal = Math.max(
      1,
      ...activeSeries.flatMap((s) => s.points.map((p) => p.value)),
    );
    const leftX = 48;
    const rightX = 560;
    const topY = 24;
    const bottomY = 156;
    const width = rightX - leftX;
    const height = bottomY - topY;

    const xForIndex = (i: number) => leftX + (i / (allYears.length - 1)) * width;
    const yForVal = (val: number) => bottomY - (val / maxVal) * height;

    const seriesData = activeSeries.map((s) => {
      const pts = allYears.map((yr, i) => {
        const pt = s.points.find((p) => p.year === yr);
        const val = pt?.value ?? 0;
        return {
          year: yr,
          value: val,
          cx: xForIndex(i),
          cy: yForVal(val),
        };
      });
      const pointsString = pts.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
      return {
        product: s.product,
        pointsString,
        points: pts,
        color: PRODUCT_COLOR[s.product] || '#0066cc',
      };
    });

    const axisYears = [
      allYears[0],
      allYears[Math.floor(allYears.length / 3)],
      allYears[Math.floor((allYears.length * 2) / 3)],
      allYears[allYears.length - 1],
    ];

    return {
      maxVal,
      seriesData,
      axisYears,
      leftX,
      rightX,
      topY,
      bottomY,
    };
  }, [activeProfile, activeSeries, allYears]);

  return (
    <div className="profiles-tab">
      {/* 1. Верхняя панель фильтрации профиля */}
      <div className="profiles-tab__topbar">
        <div className="profiles-tab__topbar-left">
          <div className="profiles-tab__field">
            <span className="profiles-tab__label">Объект:</span>
            <select
              className="profiles-tab__select"
              value={currentEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              disabled={availableEntities.length === 0}
            >
              {availableEntities.length > 0 ? (
                availableEntities.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              ) : (
                <option value="">Нет объектов</option>
              )}
            </select>
          </div>

          <div className="profiles-tab__field">
            <span className="profiles-tab__label">Источник профиля:</span>
            <select
              className="profiles-tab__select"
              value={activeEntityObj?.source || profileSource}
              onChange={(e) => setProfileSource(e.target.value)}
            >
              <option value="АКСИОМА (базовый вариант)">АКСИОМА (базовый вариант)</option>
              <option value="ГДМ Расчёт 2026">ГДМ Расчёт 2026</option>
              <option value="Импорт (добыча-поставка.xlsx)">Импорт (добыча-поставка.xlsx)</option>
            </select>
          </div>

          <div className="profiles-tab__field">
            <span className="profiles-tab__label">Период:</span>
            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
              {activeProfile ? `${activeProfile.startYear}–${activeProfile.endYear}` : (activeEntityObj?.period || '2026–2040')}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="profiles-tab__btn-export"
          disabled={!activeProfile}
          onClick={() => {
            if (activeProfile) {
              downloadDomainProfile(activeProfile, `Профиль_${currentEntity}.json`);
              onNotify?.(`Профиль выгружен: «${currentEntity}»`);
            }
          }}
        >
          Экспорт профиля
        </button>
      </div>

      {/* 2. Основная сетка: График + Таблица слева и Настройки справа */}
      <div className="profiles-tab__grid">
        <div className="profiles-tab__card">
          <div className="profiles-tab__eyebrow">
            {activeProfile?.measureLabel === 'Поставка' ? 'ДИНАМИКА ПОСТАВКИ' : 'ДИНАМИКА ДОБЫЧИ'}
          </div>

          <div className="profiles-tab__chart-card">
            {/* Динамическая легенда по продуктам профиля */}
            <div className="profiles-tab__chart-legend">
              {activeSeries.length > 0 ? (
                activeSeries.map((s) => {
                  const unit = activeProfile?.products.find((p) => p.product === s.product)?.unit || '';
                  return (
                    <div className="profiles-tab__legend-item" key={s.product}>
                      <span
                        className="profiles-tab__legend-dot"
                        style={{ backgroundColor: PRODUCT_COLOR[s.product] || '#0066cc' }}
                      />
                      <span>
                        {PRODUCT_LABEL[s.product] || s.product} ({unit})
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '12px' }}>Нет данных рядов продукции</div>
              )}
            </div>

            {/* SVG линейный график или пустое состояние */}
            {chartGeometry ? (
              <svg className="profiles-tab__chart-svg" viewBox="0 0 600 190" preserveAspectRatio="none">
                {/* Сетка */}
                <line x1={chartGeometry.leftX} y1="30" x2={chartGeometry.rightX} y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1={chartGeometry.leftX} y1="75" x2={chartGeometry.rightX} y2="75" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1={chartGeometry.leftX} y1="120" x2={chartGeometry.rightX} y2="120" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1={chartGeometry.leftX} y1="160" x2={chartGeometry.rightX} y2="160" stroke="#cbd5e1" />

                {/* Ось Y */}
                <text x={chartGeometry.leftX - 8} y="34" fontSize="10" fill="#94a3b8" textAnchor="end">
                  {Math.round(chartGeometry.maxVal)}
                </text>
                <text x={chartGeometry.leftX - 8} y="95" fontSize="10" fill="#94a3b8" textAnchor="end">
                  {Math.round(chartGeometry.maxVal / 2)}
                </text>
                <text x={chartGeometry.leftX - 8} y="160" fontSize="10" fill="#94a3b8" textAnchor="end">
                  0
                </text>

                {/* Линии графиков по флюидам */}
                {chartGeometry.seriesData.map((s) => (
                  <g key={s.product}>
                    <polyline fill="none" stroke={s.color} strokeWidth="2.5" points={s.pointsString} />
                    {s.points.map((pt) => (
                      <circle key={pt.year} cx={pt.cx} cy={pt.cy} r={3.5} fill={s.color} />
                    ))}
                  </g>
                ))}

                {/* Ось X */}
                {chartGeometry.axisYears.map((yr, idx) => {
                  const x =
                    chartGeometry.leftX +
                    (idx / (chartGeometry.axisYears.length - 1)) *
                      (chartGeometry.rightX - chartGeometry.leftX);
                  return (
                    <text key={yr} x={x} y="182" fontSize="10" fill="#64748b" textAnchor="middle">
                      {yr}
                    </text>
                  );
                })}
              </svg>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b', fontSize: '13.5px' }}>
                Данные динамики продукции отсутствуют для выбранного объекта
              </div>
            )}
          </div>

          <div className="profiles-tab__eyebrow">КОНТРОЛЬНЫЕ ЗНАЧЕНИЯ ПО ГОДАМ</div>
          <div className="profiles-tab__table-wrap">
            <table className="profiles-tab__table">
              <thead>
                <tr>
                  <th>Год</th>
                  {activeSeries.map((s) => {
                    const unit = activeProfile?.products.find((p) => p.product === s.product)?.unit || '';
                    return (
                      <th key={s.product}>
                        {activeProfile?.measureLabel === 'Поставка' ? 'Поставка ' : 'Добыча '}
                        {PRODUCT_LABEL[s.product] || s.product} ({unit})
                      </th>
                    );
                  })}
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {milestoneYears.length > 0 && activeSeries.length > 0 ? (
                  milestoneYears.map((year) => (
                    <tr key={year}>
                      <td className="profiles-tab__col-year">{year}</td>
                      {activeSeries.map((s) => {
                        const pt = s.points.find((p) => p.year === year);
                        return <td key={s.product}>{pt != null ? formatNum(pt.value) : '—'}</td>;
                      })}
                      <td>{activeEntityObj?.source || 'Импорт'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={2 + Math.max(1, activeSeries.length)}
                      style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}
                    >
                      Данные контрольных значений отсутствуют
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Правая карточка: Параметры расчета */}
        <div className="profiles-tab__card">
          <div className="profiles-tab__eyebrow">ПАРАМЕТРЫ РАСЧЁТА</div>
          <h2 className="profiles-tab__heading">Учёт баланса продукции</h2>

          <div className="profiles-tab__calc-opts">
            <label className="profiles-tab__opt-label">
              <input
                type="checkbox"
                className="profiles-tab__opt-checkbox"
                checked={autoBalance}
                onChange={(e) => setAutoBalance(e.target.checked)}
              />
              <span>Автоматический баланс входящих и исходящих потоков</span>
            </label>

            <label className="profiles-tab__opt-label">
              <input
                type="checkbox"
                className="profiles-tab__opt-checkbox"
                checked={showSecondaryGas}
                onChange={(e) => setShowSecondaryGas(e.target.checked)}
              />
              <span>Учитывать ПНГ при расчёте гидравлики</span>
            </label>
          </div>

          <div className="profiles-tab__eyebrow">ПИКОВАЯ ЗАГРУЗКА ИНФРАСТРУКТУРЫ</div>
          <div className="profiles-tab__bars-card">
            {availableEntities.length > 0 ? (
              availableEntities.map((name) => {
                const ent =
                  vertices.find((v) => matchName(v.label, name)) ??
                  pipelines.find((p) => matchName(p.label, name));
                const prof = ent?.attributes?.productProfile as ProductProfile | undefined;
                const peak = prof
                  ? Math.max(0, ...prof.series.flatMap((s) => s.points.map((p) => p.value)))
                  : 0;
                const isGas = ent && 'fluid' in ent && ent.fluid === 'gas';
                const isPipe = pipelines.some((p) => matchName(p.label, name));
                const unit = prof?.products[0]?.unit || (isGas ? 'млн м³/год' : 'тыс. т/год');

                const pct = peak > 0 ? Math.min(100, Math.max(25, Math.round((peak / (peak * 1.25)) * 100))) : 0;
                const barColor = isGas ? '#eab308' : isPipe ? '#0066cc' : '#10b981';

                return (
                  <div key={name} className="profiles-tab__bar-row">
                    <div className="profiles-tab__bar-labels">
                      <span>
                        {name} {peak > 0 ? `(пик ${formatNum(peak)} ${unit})` : ''}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="profiles-tab__bar-track">
                      <div
                        className="profiles-tab__bar-fill"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px', margin: '8px 0' }}>
                Инфраструктурные объекты отсутствуют в модели
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
