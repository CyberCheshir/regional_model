import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { BatchEditParams, BatchEditScope, ModelObject, ObjectTypeFilter, ObjectStatus } from './types';
import { useMapDrawing } from '../map/mapDrawing';
import { buildElementGroups, buildModelObjects } from '../../domain/elementGroups';
import './ObjectsTab.css';

export type ObjectsTabProps = {
  /** Переход к объекту на карте */
  onShowOnMap?: (obj: ModelObject) => void;
  /** Открыть карточку объекта / инспектор */
  onOpenObject?: (obj: ModelObject) => void;
};

type ObjectSortKey = 'name' | 'category' | 'status' | 'period';
type SortDirection = 'asc' | 'desc';

function uniqueValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, 'ru-RU', { sensitivity: 'base' }),
  );
}

function sortValue(item: ModelObject, key: ObjectSortKey): string {
  return item[key] || '—';
}

export function ObjectsTab({ onShowOnMap, onOpenObject }: ObjectsTabProps) {
  const { vertices, pipelines, segments, taps, batchUpdateEntityParams } = useMapDrawing();

  // Список объектов формируется через доменную проекцию buildModelObjects —
  // единый источник истины в domain layer.
  const initialItemsFromGroups = useMemo<ModelObject[]>(() => {
    const groups = buildElementGroups({ vertices, pipelines, segments, taps });
    const entityParamMap = new Map<string, Partial<ModelObject>>();
    for (const v of vertices) {
      entityParamMap.set(v.id, {
        owner: v.owner || (v.attributes?.owner as string) || '—',
        condition: v.condition || (v.attributes?.condition as string) || 'Работает',
        period: v.period || (v.attributes?.period as string) || '2026–2040',
        source: v.source || (v.attributes?.source as string) || 'Модель',
        status: v.status === 'warning' ? 'Проверить' : 'Готов',
      });
    }
    for (const p of pipelines) {
      entityParamMap.set(p.id, {
        owner: p.owner || (p.attributes?.owner as string) || '—',
        condition: p.condition || (p.attributes?.condition as string) || 'Работает',
        period: p.period || (p.attributes?.period as string) || '2026–2040',
        source: p.source || (p.attributes?.source as string) || 'Модель',
        status: p.status === 'warning' ? 'Проверить' : 'Готов',
      });
    }
    for (const t of taps) {
      entityParamMap.set(t.id, {
        owner: t.owner || (t.attributes?.owner as string) || '—',
        condition: t.condition || (t.attributes?.condition as string) || 'Работает',
        period: t.period || (t.attributes?.period as string) || '2026–2040',
        source: t.source || (t.attributes?.source as string) || 'Модель',
        status: t.status === 'warning' ? 'Проверить' : 'Готов',
      });
    }
    return buildModelObjects(groups, entityParamMap);
  }, [vertices, pipelines, segments, taps]);

  const [items, setItems] = useState<ModelObject[]>(initialItemsFromGroups);

  // Синхронизируем состояние items при изменении элементов на карте/в группах,
  // сохраняя пользовательские правки
  useEffect(() => {
    setItems((prevItems) => {
      const prevMap = new Map<string, ModelObject>(prevItems.map((item) => [item.id, item]));
      return initialItemsFromGroups.map((fresh) => {
        const existing = prevMap.get(fresh.id);
        if (!existing) return fresh;
        return {
          ...fresh,
          period: existing.period || fresh.period,
          source: existing.source || fresh.source,
          status: existing.status || fresh.status,
          owner: existing.owner || fresh.owner,
          condition: existing.condition || fresh.condition,
        };
      });
    });
  }, [initialItemsFromGroups]);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ObjectTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ObjectStatus>('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortKey, setSortKey] = useState<ObjectSortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Состояние блока группового редактирования
  const [editScope, setEditScope] = useState<BatchEditScope>('selected');
  const [batchParams, setBatchParams] = useState<BatchEditParams>({
    owner: 'ГПН-3',
    period: '2026–2040',
    condition: 'Работает',
    paramSource: 'Не изменять',
  });
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  const filterOptions = useMemo(() => ({
    owners: uniqueValues(items.map((item) => item.owner)),
    sources: uniqueValues(items.map((item) => item.source)),
  }), [items]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || typeFilter !== 'all' || statusFilter || ownerFilter !== 'all' || sourceFilter !== 'all',
  );

  // Фильтрация и сортировка выполняются только на представлении списка; доменные данные не изменяются.
  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU');
    const result = items.filter((item) => {
      if (typeFilter === 'wellpad' && item.category !== 'Объект добычи') return false;
      if (typeFilter === 'facility' && item.category !== 'Площадной объект') return false;
      if (typeFilter === 'pipeline' && item.category !== 'Трубопровод') return false;
      if (typeFilter === 'node' && item.category !== 'Узел') return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (ownerFilter !== 'all' && item.owner !== ownerFilter) return false;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;

      if (normalizedQuery) {
        const searchable = [item.name, item.category, item.typeClass, item.source, item.owner ?? '']
          .join(' ')
          .toLocaleLowerCase('ru-RU');
        if (!searchable.includes(normalizedQuery)) return false;
      }
      return true;
    });

    return result.sort((left, right) => {
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      const comparison = leftValue.localeCompare(rightValue, 'ru-RU', { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, typeFilter, statusFilter, ownerFilter, sourceFilter, searchQuery, sortKey, sortDirection]);

  // Выбор объектов чекбоксами
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((item) => next.add(item.id));
        return next;
      });
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Список выбранных объектов для футера
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const selectedNamesText = selectedItems.map((i) => i.name).join(' · ') || '—';

  // Целевое количество объектов для кнопки группового применения
  const targetCount = useMemo(() => {
    if (editScope === 'selected') return selectedIds.size;
    if (editScope === 'filter') return filteredItems.length;
    return 1;
  }, [editScope, selectedIds.size, filteredItems.length]);

  // Применить групповые параметры
  const handleApplyBatch = () => {
    const targetIds: string[] = [];
    if (editScope === 'selected') {
      selectedIds.forEach((id) => targetIds.push(id));
    } else if (editScope === 'filter') {
      filteredItems.forEach((item) => targetIds.push(item.id));
    } else {
      const first = selectedIds.size > 0 ? Array.from(selectedIds)[0] : items[0]?.id;
      if (first) targetIds.push(first);
    }

    if (targetIds.length === 0) return;

    const conditionToStatus = (cond?: string): 'running' | 'warning' | 'stopped' => {
      if (cond === 'Остановлен') return 'stopped';
      if (cond === 'Предупреждение') return 'warning';
      return 'running';
    };

    // 1. Обновляем ДОМЕННЫЙ СЛОЙ (useMapDrawing)
    batchUpdateEntityParams(targetIds, {
      owner: batchParams.owner,
      period: batchParams.period,
      condition: batchParams.condition,
      source: batchParams.paramSource,
      status: conditionToStatus(batchParams.condition),
    });

    // 2. Обновляем локальное табличное состояние
    setItems((prev) =>
      prev.map((item) => {
        if (targetIds.includes(item.id)) {
          return {
            ...item,
            owner: batchParams.owner || item.owner,
            period: batchParams.period || item.period,
            condition: batchParams.condition || item.condition,
            source: batchParams.paramSource || item.source,
            status: batchParams.condition === 'Предупреждение' ? 'Проверить' : 'Готов',
          };
        }
        return item;
      }),
    );

    setAppliedToast(`Применено к ${targetCount} ${declDativeObjects(targetCount)}`);
    setTimeout(() => {
      setAppliedToast(null);
    }, 2800);
  };

  return (
    <div className="objects-tab">
      <section className="objects-tab__toolbar" aria-label="Фильтры объектов">
        <div className="objects-tab__toolbar-head">
          <div>
            <div className="objects-tab__eyebrow">ОБЪЕКТЫ МОДЕЛИ</div>
            <h2 className="objects-tab__toolbar-title">Список объектов</h2>
            <p className="objects-tab__toolbar-caption">Найдите, отфильтруйте и выберите элементы модели</p>
          </div>
          <div className="objects-tab__toolbar-actions">
            <span className="objects-tab__result-count" aria-live="polite">
              <strong>{filteredItems.length}</strong> из {items.length}
            </span>
            <button
              type="button"
              className="objects-tab__btn-batch-toggle"
              onClick={() => document.getElementById('batch-edit-card')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Групповое редактирование
            </button>
          </div>
        </div>

        <div className="objects-tab__toolbar-row">
          <div className="objects-tab__search-wrap">
            <span className="objects-tab__search-icon"><AppIcon name="search" size={16} /></span>
            <input
              type="text"
              className="objects-tab__search-input"
              placeholder="Поиск по названию, типу, владельцу или источнику"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Поиск по объектам"
            />
            {searchQuery && (
              <button type="button" className="objects-tab__search-clear" onClick={() => setSearchQuery('')} aria-label="Очистить поиск">×</button>
            )}
          </div>
          <label className="objects-tab__sort-control">
            <span>Сортировать</span>
            <select className="objects-tab__filter-select" value={sortKey} onChange={(event) => setSortKey(event.target.value as ObjectSortKey)}>
              <option value="name">По названию</option>
              <option value="category">По категории</option>
              <option value="status">По статусу</option>
              <option value="period">По периоду</option>
            </select>
            <button
              type="button"
              className="objects-tab__sort-direction"
              onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}
              aria-label={sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
              title={sortDirection === 'asc' ? 'По возрастанию' : 'По убыванию'}
            >{sortDirection === 'asc' ? '↑' : '↓'}</button>
          </label>
        </div>

        <div className="objects-tab__filter-row">
          <span className="objects-tab__filter-label">Тип объекта</span>
          <div className="objects-tab__filter-pills" role="tablist" aria-label="Фильтр по типу">
            {([
              ['all', 'Все'], ['wellpad', 'Добыча'], ['facility', 'Площадки'],
              ['pipeline', 'Трубопроводы'], ['node', 'Узлы'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className={`objects-tab__filter-pill${typeFilter === value ? ' is-active' : ''}`} onClick={() => setTypeFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="objects-tab__filter-row objects-tab__filter-row--secondary">
          <span className="objects-tab__filter-label">Дополнительно</span>
          <div className="objects-tab__advanced-filters">
            <select className="objects-tab__filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ObjectStatus)} aria-label="Фильтр по статусу">
              <option value="">Все статусы</option><option value="Готов">Готов</option><option value="Проверить">Проверить</option>
            </select>
            <select className="objects-tab__filter-select" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} aria-label="Фильтр по владельцу">
              <option value="all">Все владельцы</option>
              {filterOptions.owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
            </select>
            <select className="objects-tab__filter-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Фильтр по источнику">
              <option value="all">Все источники</option>
              {filterOptions.sources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            {hasActiveFilters && <button type="button" className="objects-tab__btn-reset" onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter(''); setOwnerFilter('all'); setSourceFilter('all'); }}>Сбросить фильтры</button>}
          </div>
        </div>
      </section>

      {/* 2. Основная сетка: Таблица объектов слева + Панель параметров справа */}
      <div className="objects-tab__grid">
        {/* Левая карточка: Список объектов */}
        <div className="objects-tab__card objects-tab__card--table">
          <div className="objects-tab__table-meta">
            <div>
              <span className="objects-tab__table-title">Результаты поиска</span>
              <span className="objects-tab__table-subtitle">Выберите строки для группового изменения</span>
            </div>
            <span className="objects-tab__selection-counter">Выбрано: <strong>{selectedIds.size}</strong></span>
          </div>

          <div className="objects-tab__table-wrap">
            <table className="objects-tab__table">
              <thead>
                <tr>
                  <th className="objects-tab__col-check">
                    <input
                      type="checkbox"
                      className="objects-tab__checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      title="Выбрать все"
                      aria-label="Выбрать все объекты"
                    />
                  </th>
                  <th>Объект</th>
                  <th>Категория</th>
                  <th>Тип / класс</th>
                  <th>Период</th>
                  <th>Источник</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={isChecked ? 'is-selected' : ''}
                      onClick={() => toggleSelectItem(item.id)}
                    >
                      <td
                        className="objects-tab__col-check"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="objects-tab__checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectItem(item.id)}
                          aria-label={`Выбрать ${item.name}`}
                        />
                      </td>
                      <td className="objects-tab__obj-name">{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.typeClass}</td>
                      <td>{item.period || '—'}</td>
                      <td>{item.source || '—'}</td>
                      <td>
                        {item.status ? (
                          <span
                            className={`objects-tab__status-badge${
                              item.status === 'Проверить'
                                ? ' objects-tab__status-badge--check'
                                : ''
                            }`}
                          >
                            {item.status}
                          </span>
                        ) : (
                          <span className="objects-tab__status-badge">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                      Объекты не найдены по заданным критериям фильтрации
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Подвал таблицы с информацией о выделении и кнопками перехода */}
          <div className="objects-tab__footer">
            <div className="objects-tab__selection-info">
              <div className="objects-tab__selection-head">
                <span className="objects-tab__selection-label">ВЫБРАНО</span>
                <span className="objects-tab__selection-count">
                  {selectedIds.size} {declNominativeObjects(selectedIds.size)}
                </span>
              </div>
              <div className="objects-tab__selection-items">{selectedNamesText}</div>
            </div>

            <div className="objects-tab__footer-actions">
              <button
                type="button"
                className="objects-tab__btn-secondary"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const firstSelected = items.find((i) => selectedIds.has(i.id));
                  if (firstSelected && onOpenObject) {
                    onOpenObject(firstSelected);
                  }
                }}
              >
                Открыть выбранный объект
              </button>
              <button
                type="button"
                className="objects-tab__btn-map"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const firstSelected = items.find((i) => selectedIds.has(i.id));
                  if (firstSelected && onShowOnMap) {
                    onShowOnMap(firstSelected);
                  }
                }}
              >
                Показать на карте
              </button>
            </div>
          </div>
        </div>

        {/* Правая карточка: Групповое редактирование */}
        <div className="objects-tab__card" id="batch-edit-card">
          <div className="objects-tab__eyebrow">ГРУППОВОЕ РЕДАКТИРОВАНИЕ</div>
          <h2 className="objects-tab__heading">Область изменения</h2>

          <div className="objects-tab__scope-pills" role="tablist">
            <button
              type="button"
              className={`objects-tab__scope-pill${editScope === 'single' ? ' is-active' : ''}`}
              onClick={() => setEditScope('single')}
            >
              1 объект
            </button>
            <button
              type="button"
              className={`objects-tab__scope-pill${editScope === 'selected' ? ' is-active' : ''}`}
              onClick={() => setEditScope('selected')}
            >
              Выбранные · {selectedIds.size}
            </button>
            <button
              type="button"
              className={`objects-tab__scope-pill${editScope === 'filter' ? ' is-active' : ''}`}
              onClick={() => setEditScope('filter')}
            >
              Все в фильтре · {filteredItems.length}
            </button>
          </div>

          <p className="objects-tab__hint">
            Для смешанного набора доступны только общие параметры. Типоспецифичные поля появляются
            после выбора объектов одного типа.
          </p>

          <div className="objects-tab__section-title">ОБЩИЕ ПАРАМЕТРЫ</div>

          <div className="objects-tab__form-grid">
            <div className="objects-tab__field">
              <label className="objects-tab__field-label">Владелец</label>
              <input
                type="text"
                className="objects-tab__field-input"
                value={batchParams.owner}
                onChange={(e) =>
                  setBatchParams((prev) => ({ ...prev, owner: e.target.value }))
                }
              />
            </div>

            <div className="objects-tab__field">
              <label className="objects-tab__field-label">Период эксплуатации</label>
              <input
                type="text"
                className="objects-tab__field-input"
                value={batchParams.period}
                onChange={(e) =>
                  setBatchParams((prev) => ({ ...prev, period: e.target.value }))
                }
              />
            </div>

            <div className="objects-tab__field">
              <label className="objects-tab__field-label">Состояние объекта</label>
              <select
                className="objects-tab__field-select"
                value={batchParams.condition}
                onChange={(e) =>
                  setBatchParams((prev) => ({ ...prev, condition: e.target.value }))
                }
              >
                <option value="Работает">Работает</option>
                <option value="Предупреждение">Предупреждение</option>
                <option value="Остановлен">Остановлен</option>
              </select>
            </div>

            <div className="objects-tab__field">
              <label className="objects-tab__field-label">Источник параметров</label>
              <select
                className="objects-tab__field-select"
                value={batchParams.paramSource}
                onChange={(e) =>
                  setBatchParams((prev) => ({ ...prev, paramSource: e.target.value }))
                }
              >
                <option value="Не изменять">Не изменять</option>
                <option value="АКСИОМА">АКСИОМА</option>
                <option value="Импорт">Импорт</option>
                <option value="Модель">Модель</option>
                <option value="Профиль">Профиль</option>
              </select>
            </div>
          </div>

          <div className="objects-tab__section-title">ТИПОСПЕЦИФИЧНЫЕ ПАРАМЕТРЫ</div>

          <div className="objects-tab__notice-box">
            <div className="objects-tab__notice-title">Недоступны для смешанного набора</div>
            <p className="objects-tab__notice-text">
              Например, для группы трубопроводов можно одновременно изменить класс, наружный
              диаметр, толщину стенки, шероховатость и параметры изоляции. Координаты трассы и
              высотные отметки редактируются отдельно.
            </p>
          </div>

          <div className="objects-tab__apply-wrap">
            {appliedToast && <div className="objects-tab__toast-applied">✓ {appliedToast}</div>}

            <button
              type="button"
              className="objects-tab__btn-apply"
              disabled={targetCount === 0}
              onClick={handleApplyBatch}
            >
              Применить к {targetCount} {declDativeObjects(targetCount)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Склонение для надписи «ВЫБРАНО N объект / объекта / объектов» */
function declNominativeObjects(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'объектов';
  if (mod10 === 1) return 'объект';
  if (mod10 >= 2 && mod10 <= 4) return 'объекта';
  return 'объектов';
}

/** Склонение для надписи «Применить к N объекту / объектам» (дательный падеж) */
function declDativeObjects(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'объектам';
  if (mod10 === 1) return 'объекту';
  return 'объектам';
}