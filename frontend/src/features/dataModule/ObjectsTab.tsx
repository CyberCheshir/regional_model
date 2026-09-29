import { useMemo, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { BatchEditParams, BatchEditScope, ModelObject, ObjectTypeFilter } from './types';
import { INITIAL_MODEL_OBJECTS, INITIAL_SELECTED_OBJECT_IDS } from './mockData';
import './ObjectsTab.css';

export type ObjectsTabProps = {
  /** Переход к объекту на карте */
  onShowOnMap?: (obj: ModelObject) => void;
  /** Открыть карточку объекта / инспектор */
  onOpenObject?: (obj: ModelObject) => void;
};

export function ObjectsTab({ onShowOnMap, onOpenObject }: ObjectsTabProps) {
  const [items, setItems] = useState<ModelObject[]>(INITIAL_MODEL_OBJECTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ObjectTypeFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(INITIAL_SELECTED_OBJECT_IDS),
  );

  // Состояние блока группового редактирования
  const [editScope, setEditScope] = useState<BatchEditScope>('selected');
  const [batchParams, setBatchParams] = useState<BatchEditParams>({
    owner: 'ГПН-3',
    period: '2026–2040',
    condition: 'Работает',
    paramSource: 'Не изменять',
  });
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Фильтрация объектов
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Фильтр по типу/категории
      if (typeFilter === 'wellpad' && item.category !== 'Объект добычи') return false;
      if (typeFilter === 'facility' && item.category !== 'Площадной объект') return false;
      if (typeFilter === 'pipeline' && item.category !== 'Трубопровод') return false;
      if (typeFilter === 'node' && item.category !== 'Узел') return false;

      // Поиск по подстроке
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchType = item.typeClass.toLowerCase().includes(q);
        const matchSource = item.source.toLowerCase().includes(q);
        const matchOwner = (item.owner ?? '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchType && !matchSource && !matchOwner) {
          return false;
        }
      }

      return true;
    });
  }, [items, typeFilter, searchQuery]);

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
    setItems((prev) =>
      prev.map((item) => {
        let shouldUpdate = false;
        if (editScope === 'selected') {
          shouldUpdate = selectedIds.has(item.id);
        } else if (editScope === 'filter') {
          shouldUpdate = filteredItems.some((f) => f.id === item.id);
        } else {
          // single: первый выбранный или активный
          shouldUpdate = selectedIds.has(item.id) || item.id === prev[0]?.id;
        }

        if (shouldUpdate) {
          return {
            ...item,
            owner: batchParams.owner || item.owner,
            period: batchParams.period || item.period,
            condition: batchParams.condition || item.condition,
            source: batchParams.paramSource || item.source,
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
      {/* 1. Верхняя панель: поиск + фильтры по типам + кнопка группового редактирования */}
      <div className="objects-tab__topbar">
        <div className="objects-tab__topbar-left">
          <div className="objects-tab__search-wrap">
            <span className="objects-tab__search-icon">
              <AppIcon name="search" size={16} />
            </span>
            <input
              type="text"
              className="objects-tab__search-input"
              placeholder="Поиск по объектам, кодам и типам"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="objects-tab__filter-pills" role="tablist">
            <button
              type="button"
              className={`objects-tab__filter-pill${typeFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              Все типы
            </button>
            <button
              type="button"
              className={`objects-tab__filter-pill${typeFilter === 'wellpad' ? ' is-active' : ''}`}
              onClick={() => setTypeFilter('wellpad')}
            >
              Добыча
            </button>
            <button
              type="button"
              className={`objects-tab__filter-pill${typeFilter === 'facility' ? ' is-active' : ''}`}
              onClick={() => setTypeFilter('facility')}
            >
              Площадки
            </button>
            <button
              type="button"
              className={`objects-tab__filter-pill${typeFilter === 'pipeline' ? ' is-active' : ''}`}
              onClick={() => setTypeFilter('pipeline')}
            >
              Трубопроводы
            </button>
            <button
              type="button"
              className={`objects-tab__filter-pill${typeFilter === 'node' ? ' is-active' : ''}`}
              onClick={() => setTypeFilter('node')}
            >
              Узлы
            </button>
          </div>
        </div>

        <button
          type="button"
          className="objects-tab__btn-batch-toggle"
          onClick={() => {
            // Быстро переключить фокус на правую карточку
            const el = document.getElementById('batch-edit-card');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Групповое редактирование
        </button>
      </div>

      {/* 2. Основная сетка: Таблица объектов слева + Панель параметров справа */}
      <div className="objects-tab__grid">
        {/* Левая карточка: Список объектов */}
        <div className="objects-tab__card">
          <div className="objects-tab__eyebrow">ОБЪЕКТЫ МОДЕЛИ</div>

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
                      <td>{item.period}</td>
                      <td>{item.source}</td>
                      <td>
                        <span
                          className={`objects-tab__status-badge${item.status === 'Проверить'
                              ? ' objects-tab__status-badge--check'
                              : ''
                            }`}
                        >
                          {item.status}
                        </span>
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
