import { useState, useMemo } from 'react';
import type {
  ScenarioComparisonSubMode,
  ScenarioProductionIndicatorItem,
  ScenarioProductionComparisonData,
  ScenarioRestrictionsSummary,
  ScenarioLuSystemWarningRow,
  ScenarioDetailChangeItem,
} from './types';
import './ScenariosTab.css';

/* ================================================================== */
/* Эталонные моковые данные по дизайн-макетам                         */
/* ================================================================== */

const DEFAULT_SUMMARY: ScenarioRestrictionsSummary = {
  newWarnings: 0,
  resolvedWarnings: 5,
  maxIncreased: 2,
  maxDecreased: 3,
  criticalityChanges: 0,
  implementationYearChanges: 0,
  recommendationChanges: 0,
};

const DEFAULT_LU_SYSTEM_ROWS: ScenarioLuSystemWarningRow[] = [
  {
    id: 'chayand',
    lu: 'Чаяндинский',
    gathering: '3/0 → 2/0',
    preparation: '1/7 → 1/3',
    transport: '1/0 → 1/0',
    totalDelta: -5,
  },
  {
    id: 'tasyur',
    lu: 'Тас-Юряхский',
    gathering: '5/0 → 5/0',
    preparation: '0/5 → 0/5',
    transport: '0/0 → 0/0',
    totalDelta: 0,
  },
  {
    id: 'ignyal',
    lu: 'Игнялинский',
    gathering: '4/0 → 4/0',
    preparation: '0/1 → 0/1',
    transport: '0/0 → 0/0',
    totalDelta: 0,
  },
  {
    id: 'verkhne',
    lu: 'Верхневилючанский',
    gathering: '0/0 → 0/0',
    preparation: '0/1 → 0/1',
    transport: '0/0 → 0/0',
    totalDelta: 0,
  },
  {
    id: 'talakan',
    lu: 'Талаканский',
    gathering: '0/0 → 0/0',
    preparation: '0/1 → 0/1',
    transport: '0/0 → 0/0',
    totalDelta: 0,
  },
];

const DEFAULT_DETAIL_CHANGES: ScenarioDetailChangeItem[] = [
  {
    id: 'ch-1',
    luSystem: 'Чаяндинский · сбор',
    objectName: 'т.вр.КП 1 - БМУПН',
    status: 'Устранено',
    maxLoadBaseToScen: '— → —',
    criticalityBaseToScen: 'Крит. → —',
    yearBaseToScen: '2028 → —',
    warningTitle: 'Ликвидировано узкое место по пропускной способности',
    maxLoadInfo: '—',
    durationInfo: 'Устранено полностью',
    recommendationInfo: 'Мероприятие выполнено в сценарии',
  },
  {
    id: 'ch-2',
    luSystem: 'Чаяндинский · подготовка',
    objectName: 'Дегазатор 10Д-1',
    status: 'MAX снизилась',
    maxLoadBaseToScen: '147,5% → 133,9%',
    criticalityBaseToScen: 'Крит. → Крит.',
    yearBaseToScen: '2033 → 2033',
    warningTitle: 'Перегруз по производительности: жидкость',
    maxLoadInfo: '147,5% → 133,9% (-13,6%)',
    durationInfo: '22 → 10 лет',
    recommendationInfo: 'Ввод Дегазатор — 2 ед.',
  },
  {
    id: 'ch-3',
    luSystem: 'Чаяндинский · подготовка',
    objectName: 'НГС УПН 10С-1',
    status: 'MAX выросла',
    maxLoadBaseToScen: '267,9% → 272,7%',
    criticalityBaseToScen: 'Некр. → Некр.',
    yearBaseToScen: '2026 → 2026',
    warningTitle: 'Перегруз сепаратора по попутному газу',
    maxLoadInfo: '267,9% → 272,7% (+4,8%)',
    durationInfo: '15 → 16 лет',
    recommendationInfo: 'Модернизация входного сепаратора',
  },
  {
    id: 'ch-4',
    luSystem: 'Чаяндинский · подготовка',
    objectName: 'СК-1',
    status: 'MAX снизилась',
    maxLoadBaseToScen: '112,2% → 107,7%',
    criticalityBaseToScen: 'Некр. → Некр.',
    yearBaseToScen: '2026 → 2029',
    warningTitle: 'Гидравлический подпор на приеме насосной',
    maxLoadInfo: '112,2% → 107,7% (-4,5%)',
    durationInfo: '12 → 8 лет',
    recommendationInfo: 'Замена насосного агрегата',
  },
];

const DEFAULT_INDICATORS: ScenarioProductionIndicatorItem[] = [
  { id: 'oil', name: 'Нефть', unit: 'тыс. т/год', peakYear: 2032 },
  { id: 'water', name: 'Вода', unit: 'тыс. т/год', peakYear: 2030 },
  { id: 'condensate', name: 'Конденсат', unit: 'тыс. т/год', peakYear: 2031 },
  { id: 'png', name: 'ПНГ', unit: 'млн м³/год', peakYear: 2032 },
  { id: 'pg', name: 'ПГ', unit: 'млн м³/год', peakYear: 2034 },
  { id: 'sog', name: 'СОГ', unit: 'млн м³/год', peakYear: 2026 },
];

const DEFAULT_PROD_DATA: Record<string, ScenarioProductionComparisonData> = {
  oil: {
    objectName: 'Верхневилючанское НФ',
    feature: 'Добыча',
    product: 'Нефть',
    accumulatedTotal: 3298.9,
    accumulatedUnit: 'тыс. т',
    peakTotal: 598.7,
    peakUnit: 'тыс. т/год',
    peakYear: 2032,
    deltaAccumulated: 0.0,
    deltaPeak: 0.0,
    curvePoints: [
      { year: 2026, v0: 10, v1: 10, delta: 0 },
      { year: 2027, v0: 12, v1: 12, delta: 0 },
      { year: 2028, v0: 25, v1: 25, delta: 0 },
      { year: 2029, v0: 56.0, v1: 56.0, delta: 0 },
      { year: 2030, v0: 206.5, v1: 206.5, delta: 0 },
      { year: 2031, v0: 566.3, v1: 566.3, delta: 0 },
      { year: 2032, v0: 598.7, v1: 598.7, delta: 0 },
      { year: 2033, v0: 450, v1: 450, delta: 0 },
      { year: 2034, v0: 360, v1: 360, delta: 0 },
      { year: 2035, v0: 280, v1: 280, delta: 0 },
      { year: 2036, v0: 220, v1: 220, delta: 0 },
      { year: 2037, v0: 180, v1: 180, delta: 0 },
      { year: 2038, v0: 150, v1: 150, delta: 0 },
      { year: 2039, v0: 130, v1: 130, delta: 0 },
      { year: 2040, v0: 110, v1: 110, delta: 0 },
      { year: 2042, v0: 80, v1: 80, delta: 0 },
      { year: 2044, v0: 60, v1: 60, delta: 0 },
      { year: 2046, v0: 40, v1: 40, delta: 0 },
    ],
    controlYears: [
      { year: 2029, baseVal: 56.0, currentVal: 56.0, delta: 0.0 },
      { year: 2030, baseVal: 206.5, currentVal: 206.5, delta: 0.0 },
      { year: 2031, baseVal: 566.3, currentVal: 566.3, delta: 0.0 },
      { year: 2032, baseVal: 598.7, currentVal: 598.7, delta: 0.0 },
    ],
  },
};

export function ScenariosTab() {
  // Выбор сценариев
  const [currentScenario, setCurrentScenario] = useState('КПРА_v1');
  const [compareScenario, setCompareScenario] = useState('КПРА_v0');

  // Режим: 'restrictions' (Ограничения и рекомендации) | 'production' (Производственные показатели)
  const [subMode, setSubMode] = useState<ScenarioComparisonSubMode>('restrictions');

  // Выбранный показатель для графика
  const [selectedIndicatorId, setSelectedIndicatorId] = useState('oil');

  // Выбранное детальное изменение в подрежиме ограничений
  const [selectedChangeId, setSelectedChangeId] = useState('ch-2');

  // Данные выбранного показателя
  const activeProdData = useMemo(() => {
    return DEFAULT_PROD_DATA[selectedIndicatorId] || DEFAULT_PROD_DATA.oil;
  }, [selectedIndicatorId]);

  // Выбранное детальное изменение
  const selectedChange = useMemo(() => {
    return (
      DEFAULT_DETAIL_CHANGES.find((c) => c.id === selectedChangeId) ||
      DEFAULT_DETAIL_CHANGES[0]
    );
  }, [selectedChangeId]);

  // Генерация путей SVG графика для производственных показателей
  const chartPaths = useMemo(() => {
    const points = activeProdData.curvePoints;
    if (!points || points.length === 0) return { pathV0: '', pathV1: '', zeroY: 180 };

    const minYear = 2026;
    const maxYear = 2046;
    const maxVal = 700; // верхняя граница шкалы

    const width = 800;
    const height = 180;
    const padX = 20;
    const padTop = 15;
    const padBottom = 25;

    const scaleX = (y: number) =>
      padX + ((y - minYear) / (maxYear - minYear)) * (width - padX * 2);
    const scaleY = (v: number) =>
      padTop + (height - padTop - padBottom) * (1 - v / maxVal);

    const zeroY = scaleY(0);

    const lineV0 = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(p.year)} ${scaleY(p.v0)}`)
      .join(' ');

    const lineV1 = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(p.year)} ${scaleY(p.v1)}`)
      .join(' ');

    return { pathV0: lineV0, pathV1: lineV1, zeroY };
  }, [activeProdData]);

  return (
    <div className="scenarios-tab">
      {/* 1. Верхняя панель управления */}
      <section className="scenarios-tab__control-card" aria-label="Панель сравнения">
        <div className="scenarios-tab__control-row">
          <div className="scenarios-tab__selectors">
            <div className="scenarios-tab__field">
              <label className="scenarios-tab__label">Текущий сценарий</label>
              <select
                className="scenarios-tab__select"
                value={currentScenario}
                onChange={(e) => setCurrentScenario(e.target.value)}
              >
                <option value="КПРА_v1">КПРА_v1</option>
                <option value="КПРА_v2">КПРА_v2</option>
              </select>
            </div>

            <div className="scenarios-tab__field">
              <label className="scenarios-tab__label">Сравнить с</label>
              <select
                className="scenarios-tab__select"
                value={compareScenario}
                onChange={(e) => setCompareScenario(e.target.value)}
              >
                <option value="КПРА_v0">Базовый сценарий · КПРА_v0</option>
                <option value="КПРА_opt">Оптимистичный · КПРА_opt</option>
              </select>
            </div>
          </div>

          <div className="scenarios-tab__segmented" role="tablist">
            <button
              type="button"
              className={`scenarios-tab__seg-btn${subMode === 'restrictions' ? ' scenarios-tab__seg-btn--active' : ''
                }`}
              onClick={() => setSubMode('restrictions')}
              role="tab"
              aria-selected={subMode === 'restrictions'}
            >
              Ограничения и рекомендации
            </button>
            <button
              type="button"
              className={`scenarios-tab__seg-btn${subMode === 'production' ? ' scenarios-tab__seg-btn--active' : ''
                }`}
              onClick={() => setSubMode('production')}
              role="tab"
              aria-selected={subMode === 'production'}
            >
              Производственные показатели
            </button>
          </div>

          <button type="button" className="scenarios-tab__btn-compare">
            Сравнить
          </button>
        </div>
      </section>

      {/* 2. Подрежим: Ограничения и рекомендации */}
      {subMode === 'restrictions' && (
        <>
          {/* Сводка изменений: 7 блоков */}
          <section className="scenarios-tab__summary-card" aria-label="Сводка изменений">
            <div className="scenarios-tab__summary-row">
              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">Новые</span>
                <span className="scenarios-tab__summary-val">
                  {DEFAULT_SUMMARY.newWarnings}
                </span>
                <span className="scenarios-tab__summary-sub">предупреждений</span>
              </div>

              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">Устранены</span>
                <span className="scenarios-tab__summary-val scenarios-tab__summary-val--green">
                  {DEFAULT_SUMMARY.resolvedWarnings}
                </span>
                <span className="scenarios-tab__summary-sub">предупреждений</span>
              </div>

              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">MAX выросла</span>
                <span className="scenarios-tab__summary-val scenarios-tab__summary-val--orange">
                  {DEFAULT_SUMMARY.maxIncreased}
                </span>
                <span className="scenarios-tab__summary-sub">объекта</span>
              </div>

              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">MAX снизилась</span>
                <span className="scenarios-tab__summary-val scenarios-tab__summary-val--green">
                  {DEFAULT_SUMMARY.maxDecreased}
                </span>
                <span className="scenarios-tab__summary-sub">объекта</span>
              </div>

              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">Критичность</span>
                <span className="scenarios-tab__summary-val">
                  {DEFAULT_SUMMARY.criticalityChanges}
                </span>
                <span className="scenarios-tab__summary-sub">изменений</span>
              </div>

              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">Год реализации</span>
                <span className="scenarios-tab__summary-val">
                  {DEFAULT_SUMMARY.implementationYearChanges}
                </span>
                <span className="scenarios-tab__summary-sub">изменений</span>
              </div>

              <div className="scenarios-tab__summary-box">
                <span className="scenarios-tab__summary-label">Рекомендация</span>
                <span className="scenarios-tab__summary-val">
                  {DEFAULT_SUMMARY.recommendationChanges}
                </span>
                <span className="scenarios-tab__summary-sub">изменений</span>
              </div>
            </div>
          </section>

          {/* Полоса фильтров подрежима ограничений */}
          <nav className="scenarios-tab__filterbar" aria-label="Фильтры">
            <span className="scenarios-tab__filter-title">Фильтры</span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              ЛУ: все
            </span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              Владелец: все
            </span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              Система: все
            </span>
            <span className="scenarios-tab__filter-pill">Статус изменения</span>
            <span className="scenarios-tab__filter-pill">Критичность</span>
          </nav>

          {/* Сетка: Предупреждения по ЛУ и системам + Детальные изменения */}
          <section className="scenarios-tab__limits-grid">
            {/* Левая карточка: таблица ЛУ / системы */}
            <div className="scenarios-tab__card">
              <h2 className="scenarios-tab__heading">Предупреждения по ЛУ и системам</h2>
              <p className="scenarios-tab__desc">критичные / некритичные · база → выбранный сценарий</p>

              <div className="scenarios-tab__table-wrap">
                <table className="scenarios-tab__table">
                  <thead>
                    <tr>
                      <th>ЛУ</th>
                      <th>Сбор</th>
                      <th>Подготовка</th>
                      <th>Внеш. тр.</th>
                      <th>Итог</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_LU_SYSTEM_ROWS.map((row) => (
                      <tr key={row.id}>
                        <td>{row.lu}</td>
                        <td>{row.gathering}</td>
                        <td>{row.preparation}</td>
                        <td>{row.transport}</td>
                        <td
                          style={{
                            color: row.totalDelta < 0 ? '#10b981' : undefined,
                            fontWeight: 600,
                          }}
                        >
                          {row.totalDelta !== 0 ? row.totalDelta : 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Правая карточка: детальные изменения */}
            <div className="scenarios-tab__card">
              <h2 className="scenarios-tab__heading">Детальные изменения</h2>

              <div className="scenarios-tab__table-wrap">
                <table className="scenarios-tab__table">
                  <thead>
                    <tr>
                      <th>ЛУ / система</th>
                      <th>Объект</th>
                      <th>Статус</th>
                      <th>MAX база → сцен.</th>
                      <th>Критичность</th>
                      <th>Год</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_DETAIL_CHANGES.map((row) => {
                      const isSelected = row.id === selectedChangeId;
                      return (
                        <tr
                          key={row.id}
                          className={isSelected ? 'scenarios-tab__row-highlight' : ''}
                          onClick={() => setSelectedChangeId(row.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{row.luSystem}</td>
                          <td>{row.objectName}</td>
                          <td>
                            <span
                              className={`scenarios-tab__badge-status ${row.status === 'Устранено'
                                  ? 'scenarios-tab__badge-status--resolved'
                                  : row.status === 'MAX снизилась'
                                    ? 'scenarios-tab__badge-status--decreased'
                                    : 'scenarios-tab__badge-status--grown'
                                }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td>{row.maxLoadBaseToScen}</td>
                          <td>{row.criticalityBaseToScen}</td>
                          <td>{row.yearBaseToScen}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Выбранное изменение */}
              {selectedChange && (
                <div className="scenarios-tab__detail-box">
                  <span className="scenarios-tab__selected-eyebrow">ВЫБРАННОЕ ИЗМЕНЕНИЕ</span>
                  <h3 className="scenarios-tab__detail-title">{selectedChange.objectName}</h3>
                  <p className="scenarios-tab__detail-sub">
                    Предупреждение: {selectedChange.warningTitle}
                  </p>

                  <div className="scenarios-tab__detail-grid">
                    <div className="scenarios-tab__detail-prop">
                      <span className="scenarios-tab__detail-label">MAX загрузка:</span>
                      <span className="scenarios-tab__detail-value scenarios-tab__detail-value--green">
                        {selectedChange.maxLoadInfo}
                      </span>
                    </div>

                    <div className="scenarios-tab__detail-prop">
                      <span className="scenarios-tab__detail-label">Рекомендация:</span>
                      <span className="scenarios-tab__detail-value">
                        {selectedChange.recommendationInfo}
                      </span>
                    </div>

                    <div className="scenarios-tab__detail-prop">
                      <span className="scenarios-tab__detail-label">Длительность:</span>
                      <span className="scenarios-tab__detail-value">
                        {selectedChange.durationInfo}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* 3. Подрежим: Производственные показатели */}
      {subMode === 'production' && (
        <>
          {/* Полоса фильтров подрежима показателей */}
          <nav className="scenarios-tab__filterbar" aria-label="Фильтры">
            <span className="scenarios-tab__filter-title">Фильтры</span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              ЛУ: Верхневилючанский
            </span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              Владелец: ГПН-Заполярье
            </span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              Признак: Добыча
            </span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              Объект: Верхневилючанское НФ
            </span>
            <span className="scenarios-tab__filter-pill scenarios-tab__filter-pill--active">
              Продукт: Нефть
            </span>
          </nav>

          {/* Карточка выбранного показателя */}
          <section className="scenarios-tab__selected-kpi-card" aria-label="Выбранный показатель">
            <div className="scenarios-tab__selected-info">
              <span className="scenarios-tab__selected-eyebrow">ВЫБРАННЫЙ ПОКАЗАТЕЛЬ</span>
              <span className="scenarios-tab__selected-title">
                {activeProdData.objectName} · {activeProdData.feature} · {activeProdData.product}
              </span>
            </div>

            <div className="scenarios-tab__kpi-box">
              <span className="scenarios-tab__kpi-label">Накопленный объём</span>
              <span className="scenarios-tab__kpi-value">
                {activeProdData.accumulatedTotal.toLocaleString('ru-RU')}
              </span>
              <span className="scenarios-tab__kpi-sub">{activeProdData.accumulatedUnit} · без изменений</span>
            </div>

            <div className="scenarios-tab__kpi-box">
              <span className="scenarios-tab__kpi-label">Пиковый объём</span>
              <span className="scenarios-tab__kpi-value">
                {activeProdData.peakTotal.toLocaleString('ru-RU')}
              </span>
              <span className="scenarios-tab__kpi-sub">{activeProdData.peakUnit}</span>
            </div>

            <div className="scenarios-tab__kpi-box">
              <span className="scenarios-tab__kpi-label">Год пика</span>
              <span className="scenarios-tab__kpi-value">{activeProdData.peakYear}</span>
              <span className="scenarios-tab__kpi-sub">без изменений</span>
            </div>

            <div className="scenarios-tab__kpi-box">
              <span className="scenarios-tab__kpi-label">Δ накопленного</span>
              <span className="scenarios-tab__kpi-value scenarios-tab__kpi-value--green">
                {activeProdData.deltaAccumulated.toFixed(1).replace('.', ',')}
              </span>
              <span className="scenarios-tab__kpi-sub">{activeProdData.accumulatedUnit}</span>
            </div>

            <div className="scenarios-tab__kpi-box">
              <span className="scenarios-tab__kpi-label">Δ пика</span>
              <span className="scenarios-tab__kpi-value scenarios-tab__kpi-value--green">
                {activeProdData.deltaPeak.toFixed(1).replace('.', ',')}
              </span>
              <span className="scenarios-tab__kpi-sub">{activeProdData.peakUnit}</span>
            </div>
          </section>

          {/* Двухколоночная сетка: График + Список доступных показателей */}
          <section className="scenarios-tab__prod-grid">
            {/* Левая карточка: График динамики + таблица контрольных годов */}
            <div className="scenarios-tab__card">
              <h2 className="scenarios-tab__heading">Динамика показателя</h2>
              <p className="scenarios-tab__desc">КПРА_v0 / КПРА_v1 / разница</p>

              {/* Векторный график SVG */}
              <div className="scenarios-tab__chart-wrap">
                <svg
                  className="scenarios-tab__chart-svg"
                  viewBox="0 0 800 200"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="gridLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>

                  {/* Горизонтальные направляющие сетки */}
                  <line x1="20" y1="30" x2="780" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="20" y1="75" x2="780" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="20" y1="120" x2="780" y2="120" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="20" y1="165" x2="780" y2="165" stroke="#f1f5f9" strokeWidth="1" />

                  {/* Нулевая пунктирная линия разницы */}
                  <line
                    x1="20"
                    y1="165"
                    x2="780"
                    y2="165"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Кривые показателей */}
                  {chartPaths.pathV0 && (
                    <path
                      d={chartPaths.pathV0}
                      fill="none"
                      stroke="#0066cc"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                  {chartPaths.pathV1 && (
                    <path
                      d={chartPaths.pathV1}
                      fill="none"
                      stroke="#7c3aed"
                      strokeWidth="2.5"
                      strokeDasharray="6 3"
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {/* Легенда графика */}
                <div className="scenarios-tab__chart-legend">
                  <div className="scenarios-tab__legend-item">
                    <span
                      className="scenarios-tab__legend-marker"
                      style={{ backgroundColor: '#0066cc' }}
                    />
                    <span>КПРА_v0</span>
                  </div>
                  <div className="scenarios-tab__legend-item">
                    <span
                      className="scenarios-tab__legend-marker"
                      style={{ backgroundColor: '#7c3aed' }}
                    />
                    <span>КПРА_v1</span>
                  </div>
                  <div className="scenarios-tab__legend-item">
                    <span className="scenarios-tab__legend-marker scenarios-tab__legend-marker--dashed" />
                    <span>Разница</span>
                  </div>
                </div>
              </div>

              {/* Таблица контрольных годов */}
              <h3 className="scenarios-tab__section-title">КОНТРОЛЬНЫЕ ГОДЫ</h3>
              <div className="scenarios-tab__table-wrap">
                <table className="scenarios-tab__table">
                  <thead>
                    <tr>
                      <th>Год</th>
                      <th>КПРА_v0</th>
                      <th>КПРА_v1</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProdData.controlYears.map((row) => (
                      <tr key={row.year}>
                        <td>{row.year}</td>
                        <td>{row.baseVal.toFixed(1).replace('.', ',')}</td>
                        <td>{row.currentVal.toFixed(1).replace('.', ',')}</td>
                        <td>{row.delta.toFixed(1).replace('.', ',')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Правая карточка: Доступные показатели */}
            <div className="scenarios-tab__card">
              <h2 className="scenarios-tab__heading" style={{ fontSize: '13px', color: '#64748b' }}>
                ДОСТУПНЫЕ ПОКАЗАТЕЛИ
              </h2>

              <div className="scenarios-tab__indicators-list">
                {DEFAULT_INDICATORS.map((ind) => {
                  const isActive = ind.id === selectedIndicatorId;
                  return (
                    <div
                      key={ind.id}
                      className={`scenarios-tab__indicator-item${isActive ? ' scenarios-tab__indicator-item--active' : ''
                        }`}
                      onClick={() => setSelectedIndicatorId(ind.id)}
                    >
                      <span className="scenarios-tab__indicator-name">{ind.name}</span>
                      <span className="scenarios-tab__indicator-unit">{ind.unit}</span>
                      <span className="scenarios-tab__indicator-peak">пик {ind.peakYear}</span>
                    </div>
                  );
                })}
              </div>

              <button type="button" className="scenarios-tab__btn-graph">
                Сравнить на графике
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
