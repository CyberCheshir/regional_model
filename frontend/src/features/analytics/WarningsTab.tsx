import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import type {
  CriticalityLevel,
  WarningDetailItem,
  WarningHierarchyNode,
  WarningTypeSummaryItem,
  WarningsFilterState,
} from './types';
import './WarningsTab.css';

export type WarningsTabProps = {
  /** Переход к связанной рекомендации (на вкладку «Рекомендации») */
  onOpenRecommendations?: (recId?: string) => void;
  /** Показать элемент на карте */
  onShowOnMap?: (elementName: string) => void;
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
  const warningsList = useMemo<WarningDetailItem[]>(() => {
    if (vertices.length === 0 && pipelines.length === 0) {
      return DEFAULT_WARNINGS;
    }

    // Сохраняем макетные предупреждения и привязываем к реальным объектам
    return DEFAULT_WARNINGS.map((w) => {
      const match =
        vertices.find((v) => v.label.toLowerCase().includes(w.element.toLowerCase())) ??
        pipelines.find((p) => p.label.toLowerCase().includes(w.element.toLowerCase()));
      if (match) {
        return {
          ...w,
          element: match.label,
        };
      }
      return w;
    });
  }, [vertices, pipelines]);

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

  const critColor = (level: CriticalityLevel) =>
    level === 'critical' ? '#dc2626' : level === 'high' ? '#ea580c' : level === 'medium' ? '#ca8a04' : '#10b981';

  return (
    <div className="warnings-tab">
      {/* 1. Верхняя полоса фильтров */}
      <div className="warnings-tab__filterbar">
        <span className="warnings-tab__filter-title">Фильтры</span>

        <button
          type="button"
          className={`warnings-tab__filter-pill ${filters.lu === 'все' ? 'warnings-tab__filter-pill--active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, lu: prev.lu === 'все' ? 'Северный' : 'все' }))}
        >
          ЛУ: {filters.lu}
        </button>

        <button
          type="button"
          className={`warnings-tab__filter-pill ${filters.owner === 'все' ? 'warnings-tab__filter-pill--active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, owner: prev.owner === 'все' ? 'ГПН-3' : 'все' }))}
        >
          Владелец: {filters.owner}
        </button>

        <button
          type="button"
          className={`warnings-tab__filter-pill ${filters.system === 'все' ? 'warnings-tab__filter-pill--active' : ''}`}
          onClick={() => setFilters((prev) => ({ ...prev, system: prev.system === 'все' ? 'Сбор' : 'все' }))}
        >
          Система: {filters.system}
        </button>

        <button
          type="button"
          className={`warnings-tab__filter-pill ${filters.criticality !== 'все' ? 'warnings-tab__filter-pill--active' : ''}`}
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              criticality: prev.criticality === 'все' ? 'Критичная' : 'все',
            }))
          }
        >
          Критичность {filters.criticality !== 'все' ? `(${filters.criticality})` : ''}
        </button>

        <button
          type="button"
          className="warnings-tab__filter-pill"
          onClick={() => alert('Фильтр по периоду: 2026–2046')}
        >
          Период
        </button>

        <button
          type="button"
          className="warnings-tab__filter-pill"
          onClick={() => alert('Фильтр по типу предупреждения')}
        >
          Тип предупреждения
        </button>
      </div>

      {/* 2. Основная трехколоночная сетка */}
      <div className="warnings-tab__grid">
        {/* Колонка 1: Иерархия модели */}
        <div className="warnings-tab__card">
          <div className="warnings-tab__eyebrow">ИЕРАРХИЯ МОДЕЛИ</div>

          <div className="warnings-tab__tree">
            {/* Корневой узел: Северный ЛУ */}
            <div
              className={`warnings-tab__tree-node ${selectedNodeId === DEFAULT_HIERARCHY.id ? 'warnings-tab__tree-node--selected' : ''}`}
              onClick={() => setSelectedNodeId(DEFAULT_HIERARCHY.id)}
            >
              <div className="warnings-tab__tree-left">
                <span
                  className="warnings-tab__tree-dot"
                  style={{ backgroundColor: critColor(DEFAULT_HIERARCHY.criticality) }}
                />
                <span className="warnings-tab__tree-label">{DEFAULT_HIERARCHY.label}</span>
              </div>
              <span className="warnings-tab__tree-badge">{DEFAULT_HIERARCHY.count}</span>
            </div>

            {/* Вложенные узлы */}
            <div className="warnings-tab__tree-children">
              {DEFAULT_HIERARCHY.children?.map((subNode) => (
                <div key={subNode.id}>
                  <div
                    className={`warnings-tab__tree-node ${selectedNodeId === subNode.id ? 'warnings-tab__tree-node--selected' : ''}`}
                    onClick={() => setSelectedNodeId(subNode.id)}
                  >
                    <div className="warnings-tab__tree-left">
                      <span
                        className="warnings-tab__tree-dot"
                        style={{ backgroundColor: critColor(subNode.criticality) }}
                      />
                      <span className="warnings-tab__tree-label">{subNode.label}</span>
                    </div>
                    <span className="warnings-tab__tree-badge">{subNode.count}</span>
                  </div>

                  {subNode.children && (
                    <div className="warnings-tab__tree-children">
                      {subNode.children.map((leaf) => (
                        <div
                          key={leaf.id}
                          className={`warnings-tab__tree-node ${selectedNodeId === leaf.id ? 'warnings-tab__tree-node--selected' : ''}`}
                          onClick={() => {
                            setSelectedNodeId(leaf.id);
                            // Если кликнули по УПН-2 или Нефтепроводу, активируем соответствующее предупреждение
                            const matchingWarn = warningsList.find((w) =>
                              w.element.toLowerCase().includes(leaf.label.toLowerCase()),
                            );
                            if (matchingWarn) setSelectedWarningId(matchingWarn.id);
                          }}
                        >
                          <div className="warnings-tab__tree-left">
                            <span
                              className="warnings-tab__tree-dot"
                              style={{ backgroundColor: critColor(leaf.criticality) }}
                            />
                            <span className="warnings-tab__tree-label">{leaf.label}</span>
                          </div>
                          <span className="warnings-tab__tree-badge">{leaf.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Колонка 2: Предупреждения (таблица + счетчики) */}
        <div className="warnings-tab__card">
          <h2 className="warnings-tab__heading">Предупреждения</h2>

          {/* Верхние 4 счетчика критичности */}
          <div className="warnings-tab__stats-row">
            <div className="warnings-tab__stat-box">
              <span className="warnings-tab__stat-label">Критичных</span>
              <div className="warnings-tab__stat-val-row">
                <span className="warnings-tab__stat-num warnings-tab__stat-num--critical">4</span>
              </div>
            </div>

            <div className="warnings-tab__stat-box">
              <span className="warnings-tab__stat-label">Высоких</span>
              <div className="warnings-tab__stat-val-row">
                <span className="warnings-tab__stat-num warnings-tab__stat-num--high">8</span>
              </div>
            </div>

            <div className="warnings-tab__stat-box">
              <span className="warnings-tab__stat-label">Средних</span>
              <div className="warnings-tab__stat-val-row">
                <span className="warnings-tab__stat-num warnings-tab__stat-num--medium">10</span>
              </div>
            </div>

            <div className="warnings-tab__stat-box">
              <span className="warnings-tab__stat-label">С рекомендацией</span>
              <div className="warnings-tab__stat-val-row">
                <span className="warnings-tab__stat-num warnings-tab__stat-num--green">16</span>
                <span className="warnings-tab__stat-sub">из 22</span>
              </div>
            </div>
          </div>

          {/* Таблица предупреждений */}
          <div className="warnings-tab__table-wrap">
            <table className="warnings-tab__table">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Элемент</th>
                  <th>Тип</th>
                  <th>Период</th>
                  <th>Критичность</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarnings.map((w) => {
                  const isSelected = w.id === activeWarning?.id;
                  return (
                    <tr
                      key={w.id}
                      className={isSelected ? 'is-selected' : ''}
                      onClick={() => setSelectedWarningId(w.id)}
                    >
                      <td className="warnings-tab__col-level">{w.levelType}</td>
                      <td className="warnings-tab__col-elem">{w.element}</td>
                      <td>{w.type}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{w.period}</td>
                      <td>
                        <span
                          className={`warnings-tab__crit-tag warnings-tab__crit-tag--${w.level}`}
                        >
                          {w.criticality}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Сводка по типам */}
          <div className="warnings-tab__eyebrow">СВОДКА ПО ТИПАМ</div>
          <div className="warnings-tab__type-summary-row">
            {DEFAULT_TYPE_SUMMARIES.map((item) => (
              <span key={item.id} className="warnings-tab__type-pill">
                <span>{item.label}:</span>
                <b>{item.count}</b>
              </span>
            ))}
          </div>

          {/* Принцип агрегации */}
          <div className="warnings-tab__aggregation-note">
            Первичная причина хранится на конкретном объекте. На уровне системы и ЛУ предупреждения
            агрегируются для навигации и сводки, но не теряют связь с исходным расчётом.
          </div>
        </div>

        {/* Колонка 3: Карточка предупреждения */}
        <div className="warnings-tab__card">
          <div className="warnings-tab__eyebrow">КАРТОЧКА ПРЕДУПРЕЖДЕНИЯ</div>

          {activeWarning && (
            <>
              <div className="warnings-tab__card-head">
                <span className="warnings-tab__card-crit-badge">
                  <span
                    className="warnings-tab__tree-dot"
                    style={{ backgroundColor: critColor(activeWarning.level) }}
                  />
                  <span>{activeWarning.criticality}</span>
                </span>
              </div>

              <h2 className="warnings-tab__card-title">{activeWarning.element}</h2>
              <p className="warnings-tab__card-desc">{activeWarning.description}</p>

              <div className="warnings-tab__prop-block">
                <span className="warnings-tab__prop-label">Иерархия</span>
                <span className="warnings-tab__prop-val">{activeWarning.hierarchyPath}</span>
              </div>

              <div className="warnings-tab__prop-block">
                <span className="warnings-tab__prop-label">Период</span>
                <span className="warnings-tab__prop-val">
                  {activeWarning.period} · {activeWarning.duration}
                </span>
              </div>

              <div className="warnings-tab__prop-block">
                <span className="warnings-tab__prop-label">Расчётный показатель</span>
                <div className="warnings-tab__kpi-box">
                  <div className="warnings-tab__kpi-box-head">
                    <span className="warnings-tab__kpi-box-label">{activeWarning.kpiLabel}</span>
                    <span className="warnings-tab__kpi-box-limit">{activeWarning.kpiLimit}</span>
                  </div>
                  <div className="warnings-tab__kpi-box-num">{activeWarning.kpiValue}</div>
                </div>
              </div>

              <div className="warnings-tab__prop-block">
                <span className="warnings-tab__prop-label">Источник</span>
                <span className="warnings-tab__prop-val">{activeWarning.source}</span>
              </div>

              {/* Стек кнопок действий */}
              <div className="warnings-tab__actions-stack">
                <button
                  type="button"
                  className="warnings-tab__btn-action warnings-tab__btn-action--secondary"
                  onClick={() => alert(`Открытие расчета для ${activeWarning.element}`)}
                >
                  Открыть расчёт объекта
                </button>

                <button
                  type="button"
                  className="warnings-tab__btn-action warnings-tab__btn-action--primary"
                  onClick={() =>
                    onOpenRecommendations && onOpenRecommendations(activeWarning.relatedRecommendationId)
                  }
                >
                  Связанная рекомендация
                </button>

                <button
                  type="button"
                  className="warnings-tab__btn-action warnings-tab__btn-action--secondary"
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
