import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import { criticalityToneClass } from '../../domain';
import { StatGrid, type StatItem } from '../../components/ui/StatGrid';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { FilterBar, type FilterPill } from '../../components/ui/FilterBar';
import { PropList, type PropItem } from '../../components/ui/PropList';
import { CriticalityDot } from '../../components/ui/CriticalityDot';
import type {
  WarningDetailItem,
  WarningTypeSummaryItem,
  WarningsFilterState,
} from './types';
import { HierarchyTree } from './HierarchyTree';
import { enrichWithModelElements } from './modelMatch';
import '../../components/ui/ui.css';
import './WarningsTab.css';

export type WarningsTabProps = {
  /** Переход к связанной рекомендации (на вкладку «Рекомендации») */
  onOpenRecommendations?: (recId?: string) => void;
  /** Показать элемент на карте */
  onShowOnMap?: (elementName: string) => void;
};

/** Эталонный список детальных предупреждений по макету */
const DEFAULT_WARNINGS: WarningDetailItem[] = [
  {
    id: 'warn-1',
    levelType: 'ЛУ',
    element: 'Северный ЛУ',
    type: 'Ограничение подготовки',
    period: '2033–2035',
    duration: '3 года',
    criticality: 'Критичная',
    level: 'critical',
    description: 'Дефицит пропускной способности установок подготовки по жидкой фазе',
    hierarchyPath: 'Северный ЛУ · Подготовка',
    kpiLabel: 'Суммарный дефицит',
    kpiValue: '147,5%',
    kpiLimit: 'допустимо ≤ 100%',
    source: 'R-0042 · Базовый сценарий',
    relatedRecommendationId: 'rec-1',
  },
  {
    id: 'warn-2',
    levelType: 'Система',
    element: 'Система сбора Северный',
    type: 'Гидравлический резерв',
    period: '2037–2040',
    duration: '4 года',
    criticality: 'Высокая',
    level: 'high',
    description: 'Минимальный гидравлический резерв по напорным нефтепроводам сбора',
    hierarchyPath: 'Северный ЛУ · Система сбора Северный',
    kpiLabel: 'Потери давления dP/L',
    kpiValue: '0.048 МПа/км',
    kpiLimit: 'допустимо ≤ 0.035 МПа/км',
    source: 'R-0042 · Базовый сценарий',
    relatedRecommendationId: 'rec-2',
  },
  {
    id: 'warn-3',
    levelType: 'Объект',
    element: 'УПН-2',
    type: 'Перегруз по мощности',
    period: '2033–2035',
    duration: '3 года',
    criticality: 'Критичная',
    level: 'critical',
    description: 'Перегруз по паспортной производительности: жидкость',
    hierarchyPath: 'Северный ЛУ · Подготовка',
    kpiLabel: 'MAX загрузка',
    kpiValue: '147,5%',
    kpiLimit: 'допустимо ≤ 100%',
    source: 'R-0042 · Базовый сценарий',
    relatedRecommendationId: 'rec-1',
  },
  {
    id: 'warn-4',
    levelType: 'Объект',
    element: 'Нефтепровод 01',
    type: 'dP/L > допустимого',
    period: '2037–2040',
    duration: '4 года',
    criticality: 'Высокая',
    level: 'high',
    description: 'Удельные гидравлические потери превышают технологический норматив',
    hierarchyPath: 'Северный ЛУ · Система сбора Северный',
    kpiLabel: 'Удельный градиент dP/L',
    kpiValue: '0.042 МПа/км',
    kpiLimit: 'допустимо ≤ 0.030 МПа/км',
    source: 'R-0042 · Базовый сценарий',
    relatedRecommendationId: 'rec-2',
  },
  {
    id: 'warn-5',
    levelType: 'Объект',
    element: 'Газопровод 03',
    type: 'Vsg > допустимого',
    period: '2028–2029',
    duration: '2 года',
    criticality: 'Средняя',
    level: 'medium',
    description: 'Приведенная скорость газовой фазы превышает порог каплеуноса',
    hierarchyPath: 'Северный ЛУ · Подготовка',
    kpiLabel: 'Скорость Vsg',
    kpiValue: '8.4 м/с',
    kpiLimit: 'допустимо ≤ 7.0 м/с',
    source: 'R-0042 · Базовый сценарий',
    relatedRecommendationId: 'rec-3',
  },
];

/** Сводка по типам по макету */
const DEFAULT_TYPE_SUMMARIES: WarningTypeSummaryItem[] = [
  { id: 'sum-1', label: 'dP/L', count: 8 },
  { id: 'sum-2', label: 'Давление КП', count: 3 },
  { id: 'sum-3', label: 'Vsg', count: 2 },
  { id: 'sum-4', label: 'Перегруз мощности', count: 7 },
  { id: 'sum-5', label: 'Внешний транспорт', count: 1 },
  { id: 'sum-6', label: 'Вспом. системы', count: 1 },
];

export function WarningsTab({ onOpenRecommendations, onShowOnMap }: WarningsTabProps) {
  const { vertices, pipelines } = useMapDrawing();

  // Состояние фильтров
  const [filters, setFilters] = useState<WarningsFilterState>({
    lu: 'все',
    owner: 'все',
    system: 'все',
    criticality: 'все',
    period: 'все',
    type: 'все',
  });

  // Выбранный элемент в дереве иерархии
  const [selectedNodeId, setSelectedNodeId] = useState<string>('facility-upn-2');

  // Выбранное предупреждение для отображения в правой карточке
  const [selectedWarningId, setSelectedWarningId] = useState<string>('warn-3');

  // Формируем список предупреждений (обогащая реальными объектами, если они есть)
  const warningsList = useMemo<WarningDetailItem[]>(
    () => enrichWithModelElements(DEFAULT_WARNINGS, vertices, pipelines),
    [vertices, pipelines],
  );

  // Фильтрация предупреждений
  const filteredWarnings = useMemo(() => {
    return warningsList.filter((w) => {
      if (filters.criticality !== 'все' && w.criticality !== filters.criticality) return false;
      if (filters.type !== 'все' && !w.type.toLowerCase().includes(filters.type.toLowerCase())) return false;
      return true;
    });
  }, [warningsList, filters]);

  // Выбранное предупреждение
  const activeWarning = useMemo(() => {
    return warningsList.find((w) => w.id === selectedWarningId) ?? warningsList[0];
  }, [warningsList, selectedWarningId]);

  /** Переключение «все ↔ значение» для фильтра. */
  const toggleFilter = (key: 'lu' | 'owner' | 'system' | 'criticality', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === 'все' ? value : 'все' }));
  };

  const filterPills: FilterPill<'lu' | 'owner' | 'system' | 'criticality'>[] = [
    { key: 'lu', label: 'ЛУ', value: filters.lu, active: filters.lu === 'все', onToggle: () => toggleFilter('lu', 'Северный') },
    { key: 'owner', label: 'Владелец', value: filters.owner, active: filters.owner === 'все', onToggle: () => toggleFilter('owner', 'ГПН-3') },
    { key: 'system', label: 'Система', value: filters.system, active: filters.system === 'все', onToggle: () => toggleFilter('system', 'Сбор') },
    { key: 'criticality', label: 'Критичность', value: filters.criticality, active: filters.criticality !== 'все', onToggle: () => toggleFilter('criticality', 'Критична') },
  ];

  const statItems: StatItem[] = [
    { key: 'critical', label: 'Критичных', value: 4, tone: 'ui-tone-critical' },
    { key: 'high', label: 'Высоких', value: 8, tone: 'ui-tone-high' },
    { key: 'medium', label: 'Средних', value: 10, tone: 'ui-tone-medium' },
    { key: 'linked', label: 'С рекомендацией', value: 16, sub: 'из 22', tone: 'ui-tone-low' },
  ];

  const warningColumns: DataTableColumn<WarningDetailItem>[] = [
    { key: 'level', header: 'Уровень', cell: (w) => w.levelType, className: 'ui-table__level' },
    { key: 'element', header: 'Элемент', cell: (w) => w.element, className: 'ui-table__elem' },
    { key: 'type', header: 'Тип', cell: (w) => w.type },
    { key: 'period', header: 'Период', cell: (w) => w.period, numeric: true },
    {
      key: 'criticality',
      header: 'Критичность',
      cell: (w) => <span className={criticalityToneClass(w.level)}>{w.criticality}</span>,
      className: 'ui-table__level',
    },
  ];

  const warningProps: PropItem[] = activeWarning
    ? [
        { key: 'hierarchy', label: 'Иерархия', value: activeWarning.hierarchyPath },
        { key: 'period', label: 'Период', value: `${activeWarning.period} · ${activeWarning.duration}` },
        {
          key: 'kpi',
          label: 'Расчётный показатель',
          value: (
            <div className="warnings-tab__kpi-box">
              <div className="warnings-tab__kpi-box-head">
                <span className="warnings-tab__kpi-box-label">{activeWarning.kpiLabel}</span>
                <span className="warnings-tab__kpi-box-limit">{activeWarning.kpiLimit}</span>
              </div>
              <div className="warnings-tab__kpi-box-num">{activeWarning.kpiValue}</div>
            </div>
          ),
        },
        { key: 'source', label: 'Источник', value: activeWarning.source },
      ]
    : [];

  return (
    <div className="ui-stack">
      {/* 1. Верхняя полоса фильтров */}
      <FilterBar
        pills={filterPills}
        trailing={
          <>
            <button
              type="button"
              className="ui-pill"
              onClick={() => alert('Фильтр по периоду: 2026–2046')}
            >
              Период
            </button>
            <button
              type="button"
              className="ui-pill"
              onClick={() => alert('Фильтр по типу предупреждения')}
            >
              Тип предупреждения
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
              const matchingWarn = warningsList.find((w) =>
                w.element.toLowerCase().includes(leaf.label.toLowerCase()),
              );
              if (matchingWarn) setSelectedWarningId(matchingWarn.id);
            }}
          />
        </div>

        {/* Колонка 2: Предупреждения (таблица + счетчики) */}
        <div className="ui-card">
          <h2 className="ui-card__heading ui-card__heading--lg">Предупреждения</h2>

          {/* Верхние 4 счетчика критичности */}
          <StatGrid items={statItems} ariaLabel="Сводка по критичности" />

          {/* Таблица предупреждений */}
          <DataTable
            columns={warningColumns}
            rows={filteredWarnings}
            rowKey={(w) => w.id}
            selectedId={activeWarning?.id}
            onSelect={(w) => setSelectedWarningId(w.id)}
            ariaLabel="Список предупреждений"
          />

          {/* Сводка по типам */}
          <div className="ui-eyebrow">СВОДКА ПО ТИПАМ</div>
          <div className="warnings-tab__type-summary-row">
            {DEFAULT_TYPE_SUMMARIES.map((item) => (
              <span key={item.id} className="ui-badge--chip">
                <span>{item.label}:</span>
                <b>{item.count}</b>
              </span>
            ))}
          </div>

          {/* Принцип агрегации */}
          <div className="ui-note warnings-tab__aggregation-note">
            Первичная причина хранится на конкретном объекте. На уровне системы и ЛУ предупреждения
            агрегируются для навигации и сводки, но не теряют связь с исходным расчётом.
          </div>
        </div>

        {/* Колонка 3: Карточка предупреждения */}
        <div className="ui-card">
          <div className="ui-eyebrow">КАРТОЧКА ПРЕДУПРЕЖДЕНИЯ</div>

          {activeWarning && (
            <>
              <div className="warnings-tab__card-head">
                <span className="ui-badge">
                  <CriticalityDot level={activeWarning.level} />
                  <span>{activeWarning.criticality}</span>
                </span>
              </div>

              <h2 className="warnings-tab__card-title">{activeWarning.element}</h2>
              <p className="warnings-tab__card-desc">{activeWarning.description}</p>

              <PropList items={warningProps} />

              {/* Стек кнопок действий */}
              <div className="ui-btn-row">
                <button
                  type="button"
                  className="ui-btn ui-btn--secondary ui-btn--block"
                  onClick={() => alert(`Открытие расчета для ${activeWarning.element}`)}
                >
                  Открыть расчёт объекта
                </button>

                <button
                  type="button"
                  className="ui-btn ui-btn--primary ui-btn--block"
                  onClick={() =>
                    onOpenRecommendations &&
                    onOpenRecommendations(activeWarning.relatedRecommendationId)
                  }
                >
                  Связанная рекомендация
                </button>

                <button
                  type="button"
                  className="ui-btn ui-btn--secondary ui-btn--block"
                  onClick={() => onShowOnMap && onShowOnMap(activeWarning.element)}
                >
                  Показать на карте
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
