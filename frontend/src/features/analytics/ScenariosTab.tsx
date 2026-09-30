import { useState, useMemo } from 'react';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { StatGrid, type StatItem } from '../../components/ui/StatGrid';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { FilterBar } from '../../components/ui/FilterBar';
import { PropList } from '../../components/ui/PropList';
import type {
  ScenarioComparisonSubMode,
  ScenarioProductionIndicatorItem,
  ScenarioProductionComparisonData,
  ScenarioRestrictionsSummary,
  ScenarioLuSystemWarningRow,
  ScenarioDetailChangeItem,
} from './types';
import '../../components/ui/ui.css';
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

/** Форматирование числа в русской локали (запятая как разделитель). */
function fmtRu(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

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

  /* --- Производные представления для примитивов UI --- */

  /** Сводка изменений (7 плашек). */
  const summaryItems: StatItem[] = [
    { key: 'new', label: 'Новые', value: DEFAULT_SUMMARY.newWarnings, sub: 'предупреждений' },
    { key: 'resolved', label: 'Устранены', value: DEFAULT_SUMMARY.resolvedWarnings, sub: 'предупреждений', tone: 'ui-tone-low' },
    { key: 'maxUp', label: 'MAX выросла', value: DEFAULT_SUMMARY.maxIncreased, sub: 'объекта', tone: 'ui-tone-high' },
    { key: 'maxDown', label: 'MAX снизилась', value: DEFAULT_SUMMARY.maxDecreased, sub: 'объекта', tone: 'ui-tone-low' },
    { key: 'crit', label: 'Критичность', value: DEFAULT_SUMMARY.criticalityChanges, sub: 'изменений' },
    { key: 'year', label: 'Год реализации', value: DEFAULT_SUMMARY.implementationYearChanges, sub: 'изменений' },
    { key: 'rec', label: 'Рекомендация', value: DEFAULT_SUMMARY.recommendationChanges, sub: 'изменений' },
  ];

  /** Классы тона для статуса детального изменения. */
  const changeTone: Record<ScenarioDetailChangeItem['status'], string> = {
    'Устранено': 'ui-tone-low',
    'MAX снизилась': 'ui-tone-low',
    'MAX выросла': 'ui-tone-high',
    'Без изменений': 'ui-tone-medium',
  };

  const luSystemColumns: DataTableColumn<ScenarioLuSystemWarningRow>[] = [
    { key: 'lu', header: 'ЛУ', cell: (r) => r.lu },
    { key: 'gathering', header: 'Сбор', cell: (r) => r.gathering },
    { key: 'preparation', header: 'Подготовка', cell: (r) => r.preparation },
    { key: 'transport', header: 'Внеш. тр.', cell: (r) => r.transport },
    {
      key: 'total',
      header: 'Итог',
      cell: (r) => (
        <span className={r.totalDelta < 0 ? 'ui-tone-low' : undefined}>
          {r.totalDelta !== 0 ? r.totalDelta : 0}
        </span>
      ),
      numeric: true,
      className: 'ui-table__level',
    },
  ];

  const detailColumns: DataTableColumn<ScenarioDetailChangeItem>[] = [
    { key: 'luSystem', header: 'ЛУ / система', cell: (r) => r.luSystem },
    { key: 'object', header: 'Объект', cell: (r) => r.objectName, className: 'ui-table__elem' },
    {
      key: 'status',
      header: 'Статус',
      cell: (r) => <span className={`ui-table__level ${changeTone[r.status]}`}>{r.status}</span>,
    },
    { key: 'max', header: 'MAX база → сцен.', cell: (r) => r.maxLoadBaseToScen, numeric: true },
    { key: 'crit', header: 'Критичность', cell: (r) => r.criticalityBaseToScen },
    { key: 'year', header: 'Год', cell: (r) => r.yearBaseToScen, numeric: true },
  ];

  const controlYearsColumns: DataTableColumn<ScenarioProductionComparisonData['controlYears'][number]>[] = [
    { key: 'year', header: 'Год', cell: (r) => r.year, numeric: true },
    { key: 'base', header: 'КПРА_v0', cell: (r) => fmtRu(r.baseVal), numeric: true },
    { key: 'current', header: 'КПРА_v1', cell: (r) => fmtRu(r.currentVal), numeric: true },
    { key: 'delta', header: 'Δ', cell: (r) => fmtRu(r.delta), numeric: true },
  ];

  const kpiItems: StatItem[] = [
    {
      key: 'accumulated',
      label: 'Накопленный объём',
      value: activeProdData.accumulatedTotal.toLocaleString('ru-RU'),
      sub: `${activeProdData.accumulatedUnit} · без изменений`,
      size: 'md',
    },
    {
      key: 'peak',
      label: 'Пиковый объём',
      value: activeProdData.peakTotal.toLocaleString('ru-RU'),
      sub: activeProdData.peakUnit,
      size: 'md',
    },
    {
      key: 'peakYear',
      label: 'Год пика',
      value: activeProdData.peakYear,
      sub: 'без изменений',
      size: 'md',
    },
    {
      key: 'dAccum',
      label: 'Δ накопленного',
      value: fmtRu(activeProdData.deltaAccumulated, 1),
      sub: activeProdData.accumulatedUnit,
      tone: 'ui-tone-low',
      size: 'md',
    },
    {
      key: 'dPeak',
      label: 'Δ пика',
      value: fmtRu(activeProdData.deltaPeak, 1),
      sub: activeProdData.peakUnit,
      tone: 'ui-tone-low',
      size: 'md',
    },
  ];

  return (
    <div className="ui-stack">
      {/* 1. Верхняя панель управления */}
      <section className="ui-card ui-card--flat" aria-label="Панель сравнения">
        <div className="scenarios-tab__control-row">
          <div className="scenarios-tab__selectors">
            <div className="ui-field">
              <label className="ui-field__label">Текущий сценарий</label>
              <select
                className="ui-select"
                value={currentScenario}
                onChange={(e) => setCurrentScenario(e.target.value)}
              >
                <option value="КПРА_v1">КПРА_v1</option>
                <option value="КПРА_v2">КПРА_v2</option>
              </select>
            </div>

            <div className="ui-field">
              <label className="ui-field__label">Сравнить с</label>
              <select
                className="ui-select"
                value={compareScenario}
                onChange={(e) => setCompareScenario(e.target.value)}
              >
                <option value="КПРА_v0">Базовый сценарий · КПРА_v0</option>
                <option value="КПРА_opt">Оптимистичный · КПРА_opt</option>
              </select>
            </div>
          </div>

          <SegmentedControl<ScenarioComparisonSubMode>
            ariaLabel="Режим сравнения"
            value={subMode}
            onChange={setSubMode}
            options={[
              { value: 'restrictions', label: 'Ограничения и рекомендации' },
              { value: 'production', label: 'Производственные показатели' },
            ]}
          />

          <button type="button" className="ui-btn ui-btn--primary">
            Сравнить
          </button>
        </div>
      </section>

      {/* 2. Подрежим: Ограничения и рекомендации */}
      {subMode === 'restrictions' && (
        <>
          {/* Сводка изменения: 7 плашек */}
          <section className="ui-card ui-card--flat" aria-label="Сводка изменений">
            <StatGrid items={summaryItems} columns={7} flat stackSub />
          </section>

          {/* Полоса фильтров подрежима ограничений */}
          <FilterBar
            pills={[
              { key: 'lu', label: 'ЛУ', value: 'все', active: true },
              { key: 'owner', label: 'Владелец', value: 'все', active: true },
              { key: 'system', label: 'Система', value: 'все', active: true },
              { key: 'status', label: 'Статус изменения', value: 'все' },
              { key: 'crit', label: 'Критичность', value: 'все' },
            ]}
          />

          {/* Сетка: Предупреждения по ЛУ и системам + Детальные изменения */}
          <section className="ui-grid ui-grid--list-detail">
            {/* Левая карточка: таблица ЛУ / системы */}
            <div className="ui-card">
              <h2 className="ui-card__heading">Предупреждения по ЛУ и системам</h2>
              <p className="ui-card__desc">критичные / некритичные · база → выбранный сценарий</p>

              <DataTable
                columns={luSystemColumns}
                rows={DEFAULT_LU_SYSTEM_ROWS}
                rowKey={(r) => r.id}
                wrapClassName="ui-table-wrap"
                ariaLabel="Предупреждения по ЛУ и системам"
              />
            </div>

            {/* Правая карточка: детальные изменения */}
            <div className="ui-card">
              <h2 className="ui-card__heading">Детальные изменения</h2>

              <DataTable
                columns={detailColumns}
                rows={DEFAULT_DETAIL_CHANGES}
                rowKey={(r) => r.id}
                selectedId={selectedChangeId}
                onSelect={(r) => setSelectedChangeId(r.id)}
                ariaLabel="Детальные изменения"
              />

              {/* Выбранное изменение */}
              {selectedChange && (
                <div className="scenarios-tab__detail-box">
                  <span className="scenarios-tab__selected-eyebrow">ВЫБРАННОЕ ИЗМЕНЕНИЕ</span>
                  <h3 className="scenarios-tab__detail-title">{selectedChange.objectName}</h3>
                  <p className="scenarios-tab__detail-sub">
                    Предупреждение: {selectedChange.warningTitle}
                  </p>

                  <PropList
                    layout="grid"
                    items={[
                      {
                        key: 'max',
                        label: 'MAX загрузка:',
                        value: <span className="ui-tone-low">{selectedChange.maxLoadInfo}</span>,
                      },
                      { key: 'rec', label: 'Рекомендация:', value: selectedChange.recommendationInfo },
                      { key: 'dur', label: 'Длительность:', value: selectedChange.durationInfo },
                    ]}
                  />
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
          {/* Полоса фильтров подрежима показателей */}
          <FilterBar
            pills={[
              { key: 'lu', label: 'ЛУ', value: 'Верхневилючанский', active: true },
              { key: 'owner', label: 'Владелец', value: 'ГПН-Заполярье', active: true },
              { key: 'feature', label: 'Признак', value: 'Добыча', active: true },
              { key: 'object', label: 'Объект', value: 'Верхневилючанское НФ', active: true },
              { key: 'product', label: 'Продукт', value: 'Нефть', active: true },
            ]}
          />

          {/* Карточка выбранного показателя */}
          <section className="ui-card ui-card--flat" aria-label="Выбранный показатель">
            <div className="scenarios-tab__selected-info">
              <span className="scenarios-tab__selected-eyebrow">ВЫБРАННЫЙ ПОКАЗАТЕЛЬ</span>
              <span className="scenarios-tab__selected-title">
                {activeProdData.objectName} · {activeProdData.feature} · {activeProdData.product}
              </span>
            </div>
            <StatGrid items={kpiItems} flat />
          </section>

          {/* Двухколоночная сетка: График + Список доступных показателей */}
          <section className="ui-grid ui-grid--wide-left">
            {/* Левая карточка: График динамики + таблица контрольных годов */}
            <div className="ui-card">
              <h2 className="ui-card__heading">Динамика показателя</h2>
              <p className="ui-card__desc">KПРА_v0 / KПРА_v1 / разница</p>

              {/* Векторный график SVG */}
              <div className="scenarios-tab__chart-wrap">
                <svg
                  className="ui-chart scenarios-tab__chart-svg"
                  viewBox="0 0 800 200"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Динамика показателя по сценариям"
                >
                  {/* Горизонтальные направляющие сетки */}
                  {[30, 75, 120, 165].map((y) => (
                    <line
                      key={y}
                      x1="20"
                      y1={y}
                      x2="780"
                      y2={y}
                      stroke="var(--slate-100)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Нулевая пунктирная линия разницы */}
                  <line
                    x1="20"
                    y1="165"
                    x2="780"
                    y2="165"
                    stroke="var(--slate-400)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Кривые показателей */}
                  {chartPaths.pathV0 && (
                    <path
                      d={chartPaths.pathV0}
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                  {chartPaths.pathV1 && (
                    <path
                      d={chartPaths.pathV1}
                      fill="none"
                      stroke="var(--marker-delivery)"
                      strokeWidth="2.5"
                      strokeDasharray="6 3"
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                {/* Легенда графика */}
                <div className="ui-legend">
                  <div className="ui-legend__item">
                    <span className="ui-legend__line" style={{ backgroundColor: 'var(--color-primary)' }} />
                    <span>КПРА_v0</span>
                  </div>
                  <div className="ui-legend__item">
                    <span className="ui-legend__line" style={{ backgroundColor: 'var(--marker-delivery)' }} />
                    <span>КПРА_v1</span>
                  </div>
                  <div className="ui-legend__item">
                    <span className="ui-legend__line ui-legend__line--dashed" />
                    <span>Разница</span>
                  </div>
                </div>
              </div>

              {/* Таблица контрольных годов */}
              <div className="ui-eyebrow ui-eyebrow--tight">КОНТРОЛЬНЫЕ ГОДЫ</div>
              <DataTable
                columns={controlYearsColumns}
                rows={activeProdData.controlYears}
                rowKey={(r) => r.year}
                wrapClassName="ui-table-wrap"
                ariaLabel="Контрольные годы"
              />
            </div>

            {/* Правая карточка: Доступные показатели */}
            <div className="ui-card">
              <h2 className="ui-eyebrow">ДОСТУПНЫЕ ПОКАЗАТЕЛИ</h2>

              <div className="scenarios-tab__indicators-list">
                {DEFAULT_INDICATORS.map((ind) => (
                  <button
                    key={ind.id}
                    type="button"
                    className={`ui-pill${selectedIndicatorId === ind.id ? ' ui-pill--active' : ''}`}
                    onClick={() => setSelectedIndicatorId(ind.id)}
                  >
                    {ind.name}
                    <span className="scenarios-tab__indicator-unit">{ind.unit}</span>
                    <span className="scenarios-tab__indicator-peak">пик {ind.peakYear}</span>
                  </button>
                ))}
              </div>

              <button type="button" className="ui-btn ui-btn--secondary ui-btn--block">
                Сравнить на графике
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
