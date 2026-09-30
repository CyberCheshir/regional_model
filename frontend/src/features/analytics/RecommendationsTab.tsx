import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import type {
  CriticalityLevel,
  RecommendationFilterState,
  RecommendationItem,
  WarningHierarchyNode,
} from './types';
import './RecommendationsTab.css';

export type RecommendationsTabProps = {
  /** Переход к дорожной карте */
  onOpenRoadmap?: () => void;
  /** Идентификатор выбранной рекомендации при открытии */
  initialRecommendationId?: string;
};

/** Иерархия модели по макету */
const DEFAULT_HIERARCHY: WarningHierarchyNode = {
  id: 'lu-severny',
  label: 'Северный ЛУ',
  count: 4,
  criticality: 'critical',
  children: [
    {
      id: 'sys-sbor-severny',
      label: 'Система сбора Северный',
      count: 2,
      criticality: 'high',
      children: [
        {
          id: 'pipe-01',
          label: 'Нефтепровод 01',
          count: 1,
          criticality: 'high',
        },
        {
          id: 'facility-upn-2',
          label: 'УПН-2',
          count: 1,
          criticality: 'critical',
        },
      ],
    },
    {
      id: 'sys-podgotovka',
      label: 'Подготовка',
      count: 2,
      criticality: 'high',
      children: [
        {
          id: 'facility-gp-1',
          label: 'ГП-1',
          count: 1,
          criticality: 'medium',
        },
        {
          id: 'deliv-sikn-1525',
          label: 'СИКН-1525',
          count: 0,
          criticality: 'low',
        },
      ],
    },
  ],
};

/** Эталонный список рекомендаций по макету */
const DEFAULT_RECOMMENDATIONS: RecommendationItem[] = [
  {
    id: 'rec-1',
    title: 'Модернизация УПН-2',
    element: 'УПН-2',
    category: 'Оборудование подготовки',
    autoCategoryCode: 'PREP_EQUIPMENT_SMALL',
    requiredByDate: 'Январь 2033',
    startYear: 2031,
    startMonth: 'Январь',
    durationMonths: 24,
    isLinkedToCritical: true,
    stages: [
      { id: 'stg-1', name: 'Верификация нагрузки', durationMonths: 3 },
      { id: 'stg-2', name: 'Проектирование', durationMonths: 6 },
      { id: 'stg-3', name: 'Закуп / изготовление', durationMonths: 9 },
      { id: 'stg-4', name: 'СМР', durationMonths: 4 },
      { id: 'stg-5', name: 'ПНР / ввод', durationMonths: 2 },
    ],
  },
  {
    id: 'rec-2',
    title: 'Лупинг Нефтепровод 01',
    element: 'Нефтепровод 01',
    category: 'Лупинг системы сбора',
    autoCategoryCode: 'GATHERING_LOOPING',
    requiredByDate: 'Январь 2037',
    startYear: 2035,
    startMonth: 'Январь',
    durationMonths: 24,
    isLinkedToCritical: false,
    stages: [
      { id: 'stg-21', name: 'Гидравлический расчет', durationMonths: 2 },
      { id: 'stg-22', name: 'Проектирование трассы', durationMonths: 7 },
      { id: 'stg-23', name: 'Поставка трубы', durationMonths: 8 },
      { id: 'stg-24', name: 'Строительство лупинга', durationMonths: 5 },
      { id: 'stg-25', name: 'Испытания и опрессовка', durationMonths: 2 },
    ],
  },
  {
    id: 'rec-3',
    title: 'Переконфигурация сбора КП 22',
    element: 'КП 22 - т.вр. КП 21',
    category: 'Переконфигурация сбора',
    autoCategoryCode: 'GATHERING_RECONFIG',
    requiredByDate: 'Январь 2030',
    startYear: 2029,
    startMonth: 'Январь',
    durationMonths: 12,
    isLinkedToCritical: false,
    stages: [
      { id: 'stg-31', name: 'Анализ гидравлических потерь', durationMonths: 3 },
      { id: 'stg-32', name: 'Монтаж запорной арматуры', durationMonths: 6 },
      { id: 'stg-33', name: 'Переключение потоков', durationMonths: 3 },
    ],
  },
  {
    id: 'rec-4',
    title: 'Лупинг КП 24 - БМУПН',
    element: 'КП 24 - БМУПН',
    category: 'Лупинг внешнего транспорта',
    autoCategoryCode: 'TRUNK_LOOPING',
    requiredByDate: 'Январь 2026',
    startYear: 2025,
    startMonth: 'Январь',
    durationMonths: 12,
    isLinkedToCritical: true,
    stages: [
      { id: 'stg-41', name: 'ПИР и согласования', durationMonths: 3 },
      { id: 'stg-42', name: 'Заказ материально-технических ресурсов', durationMonths: 4 },
      { id: 'stg-43', name: 'СМР и сварочно-монтажные работы', durationMonths: 3 },
      { id: 'stg-44', name: 'ПНР и испытания', durationMonths: 2 },
    ],
  },
  {
    id: 'rec-5',
    title: 'Верификация Сила Сибири',
    element: 'Сила Сибири КУ208.2-КС-2',
    category: 'Верификация магистрали',
    autoCategoryCode: 'TRUNK_VERIFICATION',
    requiredByDate: 'Январь 2030',
    startYear: 2029,
    startMonth: 'Июнь',
    durationMonths: 6,
    isLinkedToCritical: false,
    stages: [{ id: 'stg-51', name: 'Согласование внешнего коридора', durationMonths: 6 }],
  },
];

/** 8 типовых категорий по макету */
const TYPICAL_CATEGORIES = [
  'Верификация мощности',
  'Изменение режима',
  'Оборудование подготовки',
  'Крупное оборудование',
  'Лупинг сбора',
  'Переконфигурация',
  'Новый внешний транспорт',
  'Вспом. системы',
];

export function RecommendationsTab({
  onOpenRoadmap,
  initialRecommendationId,
}: RecommendationsTabProps) {
  const { vertices, pipelines } = useMapDrawing();

  // Состояние фильтров
  const [filters, setFilters] = useState<RecommendationFilterState>({
    lu: 'все',
    system: 'все',
    category: 'все',
    criticality: 'все',
    showHidden: false,
  });

  const [selectedNodeId, setSelectedNodeId] = useState<string>('facility-upn-2');
  const [selectedRecId, setSelectedRecId] = useState<string>(
    initialRecommendationId || 'rec-1',
  );

  // Рекомендации с возможностью переопределения категории
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(() => {
    if (vertices.length === 0 && pipelines.length === 0) {
      return DEFAULT_RECOMMENDATIONS;
    }
    return DEFAULT_RECOMMENDATIONS.map((r) => {
      const match =
        vertices.find((v) => v.label.toLowerCase().includes(r.element.toLowerCase())) ??
        pipelines.find((p) => p.label.toLowerCase().includes(r.element.toLowerCase()));
      if (match) return { ...r, element: match.label };
      return r;
    });
  });

  // Выбранная рекомендация
  const activeRec = useMemo(() => {
    return recommendations.find((r) => r.id === selectedRecId) ?? recommendations[0];
  }, [recommendations, selectedRecId]);

  // Переопределение категории выбранной рекомендации
  const handleSelectCategory = (catName: string) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === activeRec.id ? { ...r, category: catName, manualCategory: catName } : r)),
    );
  };

  const critColor = (level: CriticalityLevel) =>
    level === 'critical' ? '#dc2626' : level === 'high' ? '#ea580c' : level === 'medium' ? '#ca8a04' : '#10b981';

  return (
    <div className="recommendations-tab">
      {/* 1. Верхняя полоса фильтров */}
      <div className="recommendations-tab__filterbar">
        <span className="recommendations-tab__filter-title">Фильтры</span>

        <button
          type="button"
          className={`recommendations-tab__filter-pill ${filters.lu === 'все' ? 'recommendations-tab__filter-pill--active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, lu: prev.lu === 'все' ? 'Северный' : 'все' }))}
        >
          ЛУ: {filters.lu}
        </button>

        <button
          type="button"
          className={`recommendations-tab__filter-pill ${filters.system === 'все' ? 'recommendations-tab__filter-pill--active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, system: prev.system === 'все' ? 'Сбор' : 'все' }))}
        >
          Система: {filters.system}
        </button>

        <button
          type="button"
          className="recommendations-tab__filter-pill"
          onClick={() => alert('Фильтр по категориям мероприятий')}
        >
          Категория
        </button>

        <button
          type="button"
          className="recommendations-tab__filter-pill"
          onClick={() => alert('Фильтр по критичности')}
        >
          Критичность
        </button>

        <button
          type="button"
          className="recommendations-tab__filter-pill"
          onClick={() => setFilters((prev) => ({ ...prev, showHidden: !prev.showHidden }))}
        >
          {filters.showHidden ? '✓ Скрытые включены' : 'Показывать скрытые'}
        </button>
      </div>

      {/* 2. Основная трехколоночная сетка */}
      <div className="recommendations-tab__grid">
        {/* Колонка 1: Иерархия модели */}
        <div className="recommendations-tab__card">
          <div className="recommendations-tab__eyebrow">ИЕРАРХИЯ МОДЕЛИ</div>

          <div className="recommendations-tab__tree">
            <div
              className={`recommendations-tab__tree-node ${selectedNodeId === DEFAULT_HIERARCHY.id ? 'recommendations-tab__tree-node--selected' : ''}`}
              onClick={() => setSelectedNodeId(DEFAULT_HIERARCHY.id)}
            >
              <div className="recommendations-tab__tree-left">
                <span
                  className="recommendations-tab__tree-dot"
                  style={{ backgroundColor: critColor(DEFAULT_HIERARCHY.criticality) }}
                />
                <span className="recommendations-tab__tree-label">{DEFAULT_HIERARCHY.label}</span>
              </div>
              <span className="recommendations-tab__tree-badge">{DEFAULT_HIERARCHY.count}</span>
            </div>

            <div className="recommendations-tab__tree-children">
              {DEFAULT_HIERARCHY.children?.map((subNode) => (
                <div key={subNode.id}>
                  <div
                    className={`recommendations-tab__tree-node ${selectedNodeId === subNode.id ? 'recommendations-tab__tree-node--selected' : ''}`}
                    onClick={() => setSelectedNodeId(subNode.id)}
                  >
                    <div className="recommendations-tab__tree-left">
                      <span
                        className="recommendations-tab__tree-dot"
                        style={{ backgroundColor: critColor(subNode.criticality) }}
                      />
                      <span className="recommendations-tab__tree-label">{subNode.label}</span>
                    </div>
                    <span className="recommendations-tab__tree-badge">{subNode.count}</span>
                  </div>

                  {subNode.children && (
                    <div className="recommendations-tab__tree-children">
                      {subNode.children.map((leaf) => (
                        <div
                          key={leaf.id}
                          className={`recommendations-tab__tree-node ${selectedNodeId === leaf.id ? 'recommendations-tab__tree-node--selected' : ''}`}
                          onClick={() => {
                            setSelectedNodeId(leaf.id);
                            const matchingRec = recommendations.find((r) =>
                              r.element.toLowerCase().includes(leaf.label.toLowerCase()),
                            );
                            if (matchingRec) setSelectedRecId(matchingRec.id);
                          }}
                        >
                          <div className="recommendations-tab__tree-left">
                            <span
                              className="recommendations-tab__tree-dot"
                              style={{ backgroundColor: critColor(leaf.criticality) }}
                            />
                            <span className="recommendations-tab__tree-label">{leaf.label}</span>
                          </div>
                          <span className="recommendations-tab__tree-badge">{leaf.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Колонка 2: Рекомендации и мероприятия */}
        <div className="recommendations-tab__card">
          <h2 className="recommendations-tab__heading">Рекомендации и мероприятия</h2>

          {/* Верхние 4 счетчика */}
          <div className="recommendations-tab__stats-row">
            <div className="recommendations-tab__stat-box">
              <span className="recommendations-tab__stat-label">Всего</span>
              <div className="recommendations-tab__stat-num recommendations-tab__stat-num--blue">31</div>
            </div>

            <div className="recommendations-tab__stat-box">
              <span className="recommendations-tab__stat-label">К 2033</span>
              <div className="recommendations-tab__stat-num recommendations-tab__stat-num--orange">12</div>
            </div>

            <div className="recommendations-tab__stat-box">
              <span className="recommendations-tab__stat-label">Старт ≤ 2 лет</span>
              <div className="recommendations-tab__stat-num recommendations-tab__stat-num--red">5</div>
            </div>

            <div className="recommendations-tab__stat-box">
              <span className="recommendations-tab__stat-label">Без категории</span>
              <div className="recommendations-tab__stat-num recommendations-tab__stat-num--yellow">1</div>
            </div>
          </div>

          {/* Таблица рекомендаций */}
          <div className="recommendations-tab__table-wrap">
            <table className="recommendations-tab__table">
              <thead>
                <tr>
                  <th>Элемент</th>
                  <th>Категория</th>
                  <th>Требуется к</th>
                  <th>Старт</th>
                  <th>Этапов</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((r) => {
                  const isSelected = r.id === activeRec?.id;
                  return (
                    <tr
                      key={r.id}
                      className={isSelected ? 'is-selected' : ''}
                      onClick={() => setSelectedRecId(r.id)}
                    >
                      <td className="recommendations-tab__col-elem">{r.element}</td>
                      <td>{r.category}</td>
                      <td className="recommendations-tab__col-num">{r.startYear + Math.ceil(r.durationMonths / 12)}</td>
                      <td className="recommendations-tab__col-num">{r.startYear}</td>
                      <td className="recommendations-tab__col-num">{r.stages.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Блок категоризации */}
          <div className="recommendations-tab__eyebrow">КАТЕГОРИЗАЦИЯ</div>
          <div className="recommendations-tab__categorization-box">
            <div className="recommendations-tab__cat-row">
              <span className="recommendations-tab__cat-label">Авто-категория:</span>
              <span className="recommendations-tab__cat-code">{activeRec?.autoCategoryCode}</span>
            </div>
            <div className="recommendations-tab__cat-row">
              <span className="recommendations-tab__cat-label">Результат:</span>
              <span className="recommendations-tab__cat-val">{activeRec?.category}</span>
            </div>
            <p className="recommendations-tab__cat-note">
              Пользователь может вручную переопределить категорию; после этого этапы и длительности
              перестраиваются по выбранному шаблону.
            </p>
          </div>

          {/* Сетка типовых категорий */}
          <div className="recommendations-tab__eyebrow">ТИПОВЫЕ КАТЕГОРИИ</div>
          <div className="recommendations-tab__categories-grid">
            {TYPICAL_CATEGORIES.map((cat) => {
              const isSelected = activeRec?.category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  className={`recommendations-tab__cat-btn ${isSelected ? 'recommendations-tab__cat-btn--selected' : ''}`}
                  onClick={() => handleSelectCategory(cat)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Колонка 3: Выбранная рекомендация */}
        <div className="recommendations-tab__card">
          <div className="recommendations-tab__eyebrow">ВЫБРАННАЯ РЕКОМЕНДАЦИЯ</div>

          {activeRec && (
            <>
              <h2 className="recommendations-tab__card-title">{activeRec.title}</h2>
              <div className="recommendations-tab__card-sub">
                {activeRec.isLinkedToCritical ? 'связано с критичным предупреждением' : 'плановое развитие актива'}
              </div>

              <div className="recommendations-tab__prop-block">
                <span className="recommendations-tab__prop-label">Категория</span>
                <span className="recommendations-tab__cat-badge">Авто: {activeRec.category}</span>
                <input
                  type="text"
                  className="recommendations-tab__cat-input"
                  placeholder="Вручную: не задано"
                  value={activeRec.manualCategory || ''}
                  onChange={(e) =>
                    setRecommendations((prev) =>
                      prev.map((r) =>
                        r.id === activeRec.id ? { ...r, manualCategory: e.target.value } : r,
                      ),
                    )
                  }
                />
              </div>

              <div className="recommendations-tab__prop-block">
                <span className="recommendations-tab__prop-label">Требуется готовность</span>
                <span className="recommendations-tab__prop-val">{activeRec.requiredByDate}</span>
              </div>

              <div className="recommendations-tab__timing-row">
                <div className="recommendations-tab__timing-col">
                  <span className="recommendations-tab__timing-label">Суммарная длительность</span>
                  <span className="recommendations-tab__timing-val">{activeRec.durationMonths} месяца</span>
                </div>
                <div className="recommendations-tab__timing-col">
                  <span className="recommendations-tab__timing-label">Рекомендуемый старт</span>
                  <span className="recommendations-tab__timing-val recommendations-tab__timing-val--blue">
                    {activeRec.startMonth} {activeRec.startYear}
                  </span>
                </div>
              </div>

              <div className="recommendations-tab__prop-block">
                <span className="recommendations-tab__prop-label">Этапы ({activeRec.stages.length})</span>
                <div className="recommendations-tab__stages-list">
                  {activeRec.stages.map((stg) => (
                    <div key={stg.id} className="recommendations-tab__stage-row">
                      <span className="recommendations-tab__stage-name">{stg.name}</span>
                      <span className="recommendations-tab__stage-dur">{stg.durationMonths} мес.</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Нижние кнопки */}
              <div className="recommendations-tab__actions-row">
                <button
                  type="button"
                  className="recommendations-tab__btn recommendations-tab__btn--outline"
                  onClick={() => alert(`Редактирование этапов для «${activeRec.title}»`)}
                >
                  Редактировать этапы
                </button>

                <button
                  type="button"
                  className="recommendations-tab__btn recommendations-tab__btn--primary"
                  onClick={onOpenRoadmap}
                >
                  В дорожную карту
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
