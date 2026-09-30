import { useState, useMemo } from 'react';
import type {
  RoadmapEventItem,
  RoadmapKpiSummary,
  CriticalityLevel,
} from './types';
import './RoadmapsTab.css';

export type RoadmapsTabProps = {
  /** Переход к конкретной рекомендации */
  onOpenRecommendation?: (recId: string) => void;
  /** Показать объект на карте */
  onShowOnMap?: (elementName: string) => void;
};

/** Эталонный список мероприятий дорожной карты */
const DEFAULT_ROADMAP_EVENTS: RoadmapEventItem[] = [
  {
    id: 'event-1',
    title: 'Модернизация УПН-2',
    element: 'УПН-2',
    lu: 'Северный ЛУ',
    system: 'Подготовка',
    category: 'Оборудование подготовки',
    criticality: 'critical',
    criticalityLabel: 'Критичная',
    status: 'В графике',
    startYear: 2031,
    readinessYear: 2033,
    durationMonths: 24,
    totalCost: '480 млн ₽',
    warningSource: 'Дефицит пропускной способности (147,5%)',
    stages: [
      { id: 's1', name: 'Верификация нагрузки', startMonthYear: '01.2031', durationMonths: 3, startYearOffset: 0, durationFraction: 0.12 },
      { id: 's2', name: 'Проектирование', startMonthYear: '04.2031', durationMonths: 6, startYearOffset: 0.25, durationFraction: 0.25 },
      { id: 's3', name: 'Закуп и поставка оборудования', startMonthYear: '10.2031', durationMonths: 9, startYearOffset: 0.75, durationFraction: 0.38 },
      { id: 's4', name: 'СМР', startMonthYear: '07.2032', durationMonths: 4, startYearOffset: 1.5, durationFraction: 0.17 },
      { id: 's5', name: 'ПНР и ввод в эксплуатацию', startMonthYear: '11.2032', durationMonths: 2, startYearOffset: 1.83, durationFraction: 0.08 },
    ],
  },
  {
    id: 'event-2',
    title: 'Строительство лупинга Нефтепровод 01',
    element: 'Нефтепровод 01',
    lu: 'Северный ЛУ',
    system: 'Система сбора',
    category: 'Лупинг системы сбора',
    criticality: 'high',
    criticalityLabel: 'Высокая',
    status: 'Планируется',
    startYear: 2035,
    readinessYear: 2037,
    durationMonths: 24,
    totalCost: '320 млн ₽',
    warningSource: 'Минимальный гидравлический резерв (0.048 МПа/км)',
    stages: [
      { id: 's21', name: 'Гидравлический расчет', startMonthYear: '01.2035', durationMonths: 2, startYearOffset: 0, durationFraction: 0.08 },
      { id: 's22', name: 'Проектирование трассы', startMonthYear: '03.2035', durationMonths: 7, startYearOffset: 0.17, durationFraction: 0.29 },
      { id: 's23', name: 'Поставка трубной продукции', startMonthYear: '10.2035', durationMonths: 8, startYearOffset: 0.75, durationFraction: 0.33 },
      { id: 's24', name: 'СМР лупинга', startMonthYear: '06.2036', durationMonths: 5, startYearOffset: 1.42, durationFraction: 0.21 },
      { id: 's25', name: 'Опрессовка и ввод', startMonthYear: '11.2036', durationMonths: 2, startYearOffset: 1.83, durationFraction: 0.08 },
    ],
  },
  {
    id: 'event-3',
    title: 'Режимная оптимизация ГП-1',
    element: 'ГП-1',
    lu: 'Северный ЛУ',
    system: 'Подготовка',
    category: 'Оптимизация режима',
    criticality: 'medium',
    criticalityLabel: 'Средняя',
    status: 'Планируется',
    startYear: 2029,
    readinessYear: 2030,
    durationMonths: 12,
    totalCost: '45 млн ₽',
    warningSource: 'Превышение допустимой скорости газа Vsg',
    stages: [
      { id: 's31', name: 'Анализ гидравлических потерь', startMonthYear: '01.2029', durationMonths: 3, startYearOffset: 0, durationFraction: 0.25 },
      { id: 's32', name: 'Техническое решение', startMonthYear: '04.2029', durationMonths: 4, startYearOffset: 0.25, durationFraction: 0.33 },
      { id: 's33', name: 'Переврезка и наладка', startMonthYear: '08.2029', durationMonths: 5, startYearOffset: 0.58, durationFraction: 0.42 },
    ],
  },
  {
    id: 'event-4',
    title: 'Переконфигурация сбора КП 22',
    element: 'КП 22 - т.вр. КП 21',
    lu: 'Северный ЛУ',
    system: 'Система сбора',
    category: 'Переконфигурация сбора',
    criticality: 'medium',
    criticalityLabel: 'Средняя',
    status: 'Планируется',
    startYear: 2028,
    readinessYear: 2029,
    durationMonths: 12,
    totalCost: '60 млн ₽',
    warningSource: 'Ограничение пропускной способности врезки',
    stages: [
      { id: 's41', name: 'Проверочный гидравлический расчет', startMonthYear: '01.2028', durationMonths: 2, startYearOffset: 0, durationFraction: 0.17 },
      { id: 's42', name: 'Монтаж перемычки', startMonthYear: '03.2028', durationMonths: 6, startYearOffset: 0.17, durationFraction: 0.5 },
      { id: 's43', name: 'Пусконаладка', startMonthYear: '09.2028', durationMonths: 4, startYearOffset: 0.67, durationFraction: 0.33 },
    ],
  },
];

const TIMELINE_YEARS = Array.from({ length: 21 }, (_, i) => 2026 + i); // 2026–2046

export function RoadmapsTab({ onOpenRecommendation, onShowOnMap }: RoadmapsTabProps) {

  const [selectedEventId, setSelectedEventId] = useState<string>('event-1');
  const [filterLu, setFilterLu] = useState<string>('Все');
  const [filterSystem, setFilterSystem] = useState<string>('Все');
  const [filterCriticality, setFilterCriticality] = useState<string>('Все');
  const [viewScale, setViewScale] = useState<'years' | 'quarters'>('years');

  // Обогащаем список мероприятий
  const events = useMemo(() => {
    return DEFAULT_ROADMAP_EVENTS.filter((ev) => {
      if (filterLu !== 'Все' && ev.lu !== filterLu) return false;
      if (filterSystem !== 'Все' && ev.system !== filterSystem) return false;
      if (filterCriticality !== 'Все' && ev.criticalityLabel !== filterCriticality) return false;
      return true;
    });
  }, [filterLu, filterSystem, filterCriticality]);

  // Выбранное мероприятие
  const activeEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0] || DEFAULT_ROADMAP_EVENTS[0];
  }, [events, selectedEventId]);

  // Сводные KPI
  const kpiSummary = useMemo<RoadmapKpiSummary>(() => {
    const totalEvents = events.length;
    const criticalEvents = events.filter((e) => e.criticality === 'critical').length;
    const inPlanning = events.filter((e) => e.status === 'Планируется').length;
    const nearestStartYear = Math.min(...events.map((e) => e.startYear));

    return {
      totalEvents,
      criticalEvents,
      inPlanning,
      totalInvestmentEstimated: '905 млн ₽',
      nearestStartYear: isFinite(nearestStartYear) ? nearestStartYear : 2028,
    };
  }, [events]);

  // Вычисление позиции полосы на временной шкале (2026..2046)
  const getEventBarStyle = (startYear: number, durationMonths: number) => {
    const totalYears = 21; // 2026 - 2046
    const minYear = 2026;
    const durationYears = durationMonths / 12;

    const leftPercent = Math.max(0, ((startYear - minYear) / totalYears) * 100);
    const widthPercent = Math.max(2.5, (durationYears / totalYears) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  };

  const critColor = (level: CriticalityLevel) =>
    level === 'critical' ? '#dc2626' : level === 'high' ? '#ea580c' : level === 'medium' ? '#ca8a04' : '#10b981';

  return (
    <div className="roadmaps-tab">
      {/* 1. Верхняя панель KPI дорожной карты */}
      <section className="roadmaps-tab__kpi-card" aria-label="Сводка дорожной карты">
        <div className="roadmaps-tab__kpi-box">
          <span className="roadmaps-tab__kpi-label">Всего мероприятий</span>
          <span className="roadmaps-tab__kpi-val">{kpiSummary.totalEvents}</span>
          <span className="roadmaps-tab__kpi-sub">в активном сценарии</span>
        </div>

        <div className="roadmaps-tab__kpi-box">
          <span className="roadmaps-tab__kpi-label">Критичные</span>
          <span className="roadmaps-tab__kpi-val roadmaps-tab__kpi-val--red">
            {kpiSummary.criticalEvents}
          </span>
          <span className="roadmaps-tab__kpi-sub">прямой риск недостижения</span>
        </div>

        <div className="roadmaps-tab__kpi-box">
          <span className="roadmaps-tab__kpi-label">В планировании</span>
          <span className="roadmaps-tab__kpi-val roadmaps-tab__kpi-val--blue">
            {kpiSummary.inPlanning}
          </span>
          <span className="roadmaps-tab__kpi-sub">требуют запуска ТЭО</span>
        </div>

        <div className="roadmaps-tab__kpi-box">
          <span className="roadmaps-tab__kpi-label">Оценка CAPEX</span>
          <span className="roadmaps-tab__kpi-val">
            {kpiSummary.totalInvestmentEstimated}
          </span>
          <span className="roadmaps-tab__kpi-sub">ориентировочный объём</span>
        </div>

        <div className="roadmaps-tab__kpi-box">
          <span className="roadmaps-tab__kpi-label">Ближайший старт</span>
          <span className="roadmaps-tab__kpi-val">
            {kpiSummary.nearestStartYear} г.
          </span>
          <span className="roadmaps-tab__kpi-sub">первое проектное решение</span>
        </div>
      </section>

      {/* 2. Полоса фильтров и масштаба шкалы */}
      <nav className="roadmaps-tab__filterbar" aria-label="Параметры фильтрации">
        <div className="roadmaps-tab__filters-group">
          <span className="roadmaps-tab__filter-title">Фильтры</span>

          <button
            type="button"
            className={`roadmaps-tab__filter-pill ${filterLu === 'Все' ? 'roadmaps-tab__filter-pill--active' : ''}`}
            onClick={() => setFilterLu((prev) => (prev === 'Все' ? 'Северный ЛУ' : 'Все'))}
          >
            ЛУ: {filterLu}
          </button>

          <button
            type="button"
            className={`roadmaps-tab__filter-pill ${filterSystem === 'Все' ? 'roadmaps-tab__filter-pill--active' : ''}`}
            onClick={() => setFilterSystem((prev) => (prev === 'Все' ? 'Подготовка' : 'Все'))}
          >
            Система: {filterSystem}
          </button>

          <button
            type="button"
            className={`roadmaps-tab__filter-pill ${filterCriticality === 'Все' ? 'roadmaps-tab__filter-pill--active' : ''}`}
            onClick={() => setFilterCriticality((prev) => (prev === 'Все' ? 'Критичная' : 'Все'))}
          >
            Критичность: {filterCriticality}
          </button>
        </div>

        <div className="roadmaps-tab__scale-group">
          <span className="roadmaps-tab__scale-label">Масштаб:</span>
          <div className="roadmaps-tab__segmented">
            <button
              type="button"
              className={`roadmaps-tab__seg-btn ${viewScale === 'years' ? 'roadmaps-tab__seg-btn--active' : ''}`}
              onClick={() => setViewScale('years')}
            >
              По годам
            </button>
            <button
              type="button"
              className={`roadmaps-tab__seg-btn ${viewScale === 'quarters' ? 'roadmaps-tab__seg-btn--active' : ''}`}
              onClick={() => setViewScale('quarters')}
            >
              Кварталы
            </button>
          </div>
        </div>
      </nav>

      {/* 3. Двухколоночная рабочая зона: Диаграмма Ганта + Карточка выбранного мероприятия */}
      <section className="roadmaps-tab__grid">
        {/* Левая колонка: Календарный план Ганта */}
        <div className="roadmaps-tab__card">
          <div className="roadmaps-tab__header-row">
            <div>
              <div className="roadmaps-tab__eyebrow">КАЛЕНДАРНЫЙ ГРАФИК РЕАЛИЗАЦИИ</div>
              <h2 className="roadmaps-tab__heading">Мероприятия по устранению узких мест</h2>
            </div>
          </div>

          <div className="roadmaps-tab__gantt-container">
            {/* Заголовок шкалы Ганта */}
            <div className="roadmaps-tab__gantt-header">
              <div className="roadmaps-tab__gantt-header-title">Мероприятие / Объект</div>
              <div className="roadmaps-tab__gantt-timeline-header">
                {TIMELINE_YEARS.map((year) => (
                  <div key={year} className="roadmaps-tab__timeline-year-mark">
                    {year.toString().slice(2)}
                  </div>
                ))}
              </div>
            </div>

            {/* Строки мероприятий */}
            {events.map((ev) => {
              const isSelected = ev.id === selectedEventId;
              const barPos = getEventBarStyle(ev.startYear, ev.durationMonths);

              return (
                <div
                  key={ev.id}
                  className={`roadmaps-tab__gantt-row ${isSelected ? 'roadmaps-tab__gantt-row--selected' : ''}`}
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <div className="roadmaps-tab__row-info">
                    <span className="roadmaps-tab__row-name" title={ev.title}>
                      {ev.title}
                    </span>
                    <span className="roadmaps-tab__row-sub">
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: critColor(ev.criticality),
                          display: 'inline-block',
                        }}
                      />
                      {ev.element} · готовность к {ev.readinessYear}
                    </span>
                  </div>

                  <div className="roadmaps-tab__gantt-timeline-body">
                    {/* Фоновые вертикальные направляющие */}
                    <div className="roadmaps-tab__grid-lines">
                      {TIMELINE_YEARS.map((y) => (
                        <div key={y} className="roadmaps-tab__grid-col" />
                      ))}
                    </div>

                    {/* Полоса мероприятия */}
                    <div
                      className={`roadmaps-tab__bar ${ev.criticality === 'critical'
                          ? 'roadmaps-tab__bar--critical'
                          : ev.criticality === 'medium'
                            ? 'roadmaps-tab__bar--medium'
                            : ''
                        }`}
                      style={barPos}
                      title={`${ev.title}: ${ev.startYear} - ${ev.readinessYear} (${ev.durationMonths} мес.)`}
                    >
                      <span>{ev.durationMonths} мес.</span>
                      <div className="roadmaps-tab__bar-marker-end" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Правая колонка: Детали выбранного мероприятия */}
        <div className="roadmaps-tab__card">
          <div className="roadmaps-tab__eyebrow">ПАСПОРТ МЕРОПРИЯТИЯ</div>

          {activeEvent ? (
            <div className="roadmaps-tab__details">
              <div>
                <h3 className="roadmaps-tab__detail-title">{activeEvent.title}</h3>
                <span
                  className={`roadmaps-tab__badge-status ${activeEvent.criticality === 'critical'
                      ? 'roadmaps-tab__badge-status--critical'
                      : 'roadmaps-tab__badge-status--planning'
                    }`}
                  style={{ marginTop: '6px' }}
                >
                  {activeEvent.status} · {activeEvent.criticalityLabel} важность
                </span>
              </div>

              <div className="roadmaps-tab__props-grid">
                <div className="roadmaps-tab__prop-item">
                  <span className="roadmaps-tab__prop-label">Объект:</span>
                  <span className="roadmaps-tab__prop-val">{activeEvent.element}</span>
                </div>

                <div className="roadmaps-tab__prop-item">
                  <span className="roadmaps-tab__prop-label">ЛУ / Система:</span>
                  <span className="roadmaps-tab__prop-val">{activeEvent.lu}</span>
                </div>

                <div className="roadmaps-tab__prop-item">
                  <span className="roadmaps-tab__prop-label">Период:</span>
                  <span className="roadmaps-tab__prop-val">
                    {activeEvent.startYear} — {activeEvent.readinessYear} гг.
                  </span>
                </div>

                <div className="roadmaps-tab__prop-item">
                  <span className="roadmaps-tab__prop-label">Длительность:</span>
                  <span className="roadmaps-tab__prop-val">{activeEvent.durationMonths} мес.</span>
                </div>

                {activeEvent.totalCost && (
                  <div className="roadmaps-tab__prop-item">
                    <span className="roadmaps-tab__prop-label">Оценка CAPEX:</span>
                    <span className="roadmaps-tab__prop-val">{activeEvent.totalCost}</span>
                  </div>
                )}

                {activeEvent.warningSource && (
                  <div className="roadmaps-tab__prop-item roadmaps-tab__prop-item--full">
                    <span className="roadmaps-tab__prop-label">Основание (дефицит):</span>
                    <span className="roadmaps-tab__prop-val">{activeEvent.warningSource}</span>
                  </div>
                )}
              </div>

              {/* Декомпозиция этапов */}
              <div className="roadmaps-tab__stages-title">
                Этапы реализации ({activeEvent.stages.length})
              </div>
              <div className="roadmaps-tab__stages-list">
                {activeEvent.stages.map((stg) => (
                  <div key={stg.id} className="roadmaps-tab__stage-card">
                    <span className="roadmaps-tab__stage-name">{stg.name}</span>
                    <span className="roadmaps-tab__stage-meta">
                      старт {stg.startMonthYear} · {stg.durationMonths} мес.
                    </span>
                  </div>
                ))}
              </div>

              {/* Нижние кнопки взаимодействия */}
              <div className="roadmaps-tab__actions">
                {onOpenRecommendation && (
                  <button
                    type="button"
                    className="roadmaps-tab__btn roadmaps-tab__btn--outline"
                    onClick={() => onOpenRecommendation(activeEvent.id)}
                  >
                    К рекомендации
                  </button>
                )}

                {onShowOnMap && (
                  <button
                    type="button"
                    className="roadmaps-tab__btn roadmaps-tab__btn--primary"
                    onClick={() => onShowOnMap(activeEvent.element)}
                  >
                    Показать на карте
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>Мероприятие не выбрано</p>
          )}
        </div>
      </section>
    </div>
  );
}
