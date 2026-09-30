import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import { StatGrid, type StatItem } from '../../components/ui/StatGrid';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { FilterBar } from '../../components/ui/FilterBar';
import { PropList } from '../../components/ui/PropList';
import type {
  RecommendationFilterState,
  RecommendationItem,
} from './types';
import { HierarchyTree } from './HierarchyTree';
import { enrichWithModelElements } from './modelMatch';
import '../../components/ui/ui.css';
import './RecommendationsTab.css';

export type RecommendationsTabProps = {
  /** Переход к дорожной карте */
  onOpenRoadmap?: () => void;
  /** Идентификатор выбранной рекомендации при открытии */
  initialRecommendationId?: string;
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
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(() =>
    enrichWithModelElements(DEFAULT_RECOMMENDATIONS, vertices, pipelines),
  );

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

  /** Переключение «все ↔ значение» для фильтра. */
  const toggleFilter = (key: 'lu' | 'system', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === 'все' ? value : 'все' }));
  };

  /** Ручное переопределение категории выбранной рекомендации. */
  const setManualCategory = (value: string) => {
    if (!activeRec) return;
    setRecommendations((prev) =>
      prev.map((r) => (r.id === activeRec.id ? { ...r, manualCategory: value } : r)),
    );
  };

  // Счётчики по макету
  const statItems: StatItem[] = [
    { key: 'total', label: 'Всего', value: 31, tone: 'ui-tone-primary' },
    { key: 'by2033', label: 'К 2033', value: 12, tone: 'ui-tone-high' },
    { key: 'soon', label: 'Старт ≤ 2 лет', value: 5, tone: 'ui-tone-critical' },
    { key: 'no-category', label: 'Без категория', value: 1, tone: 'ui-tone-medium' },
  ];

  const recColumns: DataTableColumn<RecommendationItem>[] = [
    { key: 'element', header: 'Элемент', cell: (r) => r.element, className: 'ui-table__elem' },
    { key: 'category', header: 'Категория', cell: (r) => r.category },
    {
      key: 'required',
      header: 'Требуется к',
      cell: (r) => r.startYear + Math.ceil(r.durationMonths / 12),
      numeric: true,
    },
    { key: 'start', header: 'Старт', cell: (r) => r.startYear, numeric: true },
    { key: 'stages', header: 'Этапов', cell: (r) => r.stages.length, numeric: true },
  ];

  return (
    <div className="ui-stack">
      {/* 1. Верхняя полоса фильтров */}
      <FilterBar
        pills={[
          { key: 'lu', label: 'ЛУ', value: filters.lu, active: filters.lu === 'все', onToggle: () => toggleFilter('lu', 'Северный') },
          { key: 'system', label: 'Система', value: filters.system, active: filters.system === 'все', onToggle: () => toggleFilter('system', 'Сбор') },
        ]}
        trailing={
          <>
            <button
              type="button"
              className="ui-pill"
              onClick={() => alert('Фильтр по категориям мероприятий')}
            >
              Категория
            </button>
            <button
              type="button"
              className="ui-pill"
              onClick={() => alert('Фильтр по критичности')}
            >
              Критичность
            </button>
            <button
              type="button"
              className={`ui-pill${filters.showHidden ? ' ui-pill--active' : ''}`}
              onClick={() => setFilters((prev) => ({ ...prev, showHidden: !prev.showHidden }))}
            >
              {filters.showHidden ? '✓ Скрытые включены' : 'Показывать скрытые'}
            </button>
          </>
        }
      />

      {/* 2. Основная трехколоночная сетка */}
      <div className="ui-grid ui-grid--3">
        {/* Колонка 1: Иерархия модели */}
        <div className="ui-card">
          <div className="ui-eyebrow">ИЕРАРХИЯ МОДЕЛИ</div>

          <HierarchyTree
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onSelectLeaf={(leaf) => {
              const matchingRec = recommendations.find((r) =>
                r.element.toLowerCase().includes(leaf.label.toLowerCase()),
              );
              if (matchingRec) setSelectedRecId(matchingRec.id);
            }}
          />
        </div>

        {/* Колонка 2: Рекомендации и мероприятия */}
        <div className="ui-card">
          <h2 className="ui-card__heading ui-card__heading--lg">Рекомендации и мероприятия</h2>

          {/* Верхние 4 счетчика */}
          <StatGrid items={statItems} ariaLabel="Сводка по рекомендациям" />

          {/* Таблица рекомендаций */}
          <DataTable
            columns={recColumns}
            rows={recommendations}
            rowKey={(r) => r.id}
            selectedId={activeRec?.id}
            onSelect={(r) => setSelectedRecId(r.id)}
            ariaLabel="Список рекомендаций"
          />

          {/* Блок категоризации */}
          <div className="ui-eyebrow">КАТЕГОРИЗАЦИЯ</div>
          <div className="ui-note ui-note--box">
            <div className="recommendations-tab__cat-row">
              <span className="recommendations-tab__cat-label">Авто-категория:</span>
              <span className="ui-note--code">{activeRec?.autoCategoryCode}</span>
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
          <div className="ui-eyebrow">ТИПОВЫЕ КАТЕГОРИИ</div>
          <div className="recommendations-tab__categories-grid">
            {TYPICAL_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`ui-pill${activeRec?.category === cat ? ' ui-pill--active' : ''}`}
                onClick={() => handleSelectCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Колонка 3: Выбранная рекомендация */}
        <div className="ui-card">
          <div className="ui-eyebrow">ВЫБРАННАЯ РЕКОМЕНДАЦИЯ</div>

          {activeRec && (
            <>
              <h2 className="recommendations-tab__card-title">{activeRec.title}</h2>
              <div className="recommendations-tab__card-sub">
                {activeRec.isLinkedToCritical
                  ? 'связано с критичным предупреждением'
                  : 'плановое развитие актива'}
              </div>

              <PropList
                items={[
                  {
                    key: 'category',
                    label: 'Категория',
                    value: (
                      <>
                        <span className="ui-badge--tag">Авто: {activeRec.category}</span>
                        <input
                          type="text"
                          className="ui-input"
                          placeholder="Вручную: не задано"
                          value={activeRec.manualCategory || ''}
                          onChange={(e) => setManualCategory(e.target.value)}
                        />
                      </>
                    ),
                  },
                  { key: 'ready', label: 'Требуется готовность', value: activeRec.requiredByDate },
                ]}
              />

              <div className="recommendations-tab__timing-row">
                <PropList
                  layout="grid"
                  items={[
                    { key: 'duration', label: 'Суммарная длительность', value: `${activeRec.durationMonths} месяца` },
                    { key: 'start', label: 'Рекомендуемый старт', value: `${activeRec.startMonth} ${activeRec.startYear}` },
                  ]}
                />
              </div>

              <div className="ui-eyebrow ui-eyebrow--tight">ЭТАПЫ ({activeRec.stages.length})</div>
              <div className="recommendations-tab__stages-list">
                {activeRec.stages.map((stg) => (
                  <div key={stg.id} className="recommendations-tab__stage-row">
                    <span className="recommendations-tab__stage-name">{stg.name}</span>
                    <span className="recommendations-tab__stage-dur">{stg.durationMonths} мес.</span>
                  </div>
                ))}
              </div>

              {/* Нижние кнопки */}
              <div className="ui-btn-row ui-btn-row--inline">
                <button
                  type="button"
                  className="ui-btn ui-btn--outline"
                  onClick={() => alert(`Редактирование этапов для «${activeRec.title}»`)}
                >
                  Редактировать этапы
                </button>

                <button type="button" className="ui-btn ui-btn--primary" onClick={onOpenRoadmap}>
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
