import { useMemo, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import { useMapDrawing } from '../map/mapDrawing';
import type {
  ConnectivityCheckItem,
  ContourFluid,
  ContourObjectItem,
  SavedContourPreset,
} from './types';
import './ContourTab.css';

export type ContourTabProps = {
  /** Переход ко 2-му шагу («Постановка задачи») */
  onNext?: () => void;
  /** Выбранный флюид контура */
  fluid?: ContourFluid;
  onFluidChange?: (fluid: ContourFluid) => void;
};

/** Типовые расчетные схемы из макета (UI images/Activity bar/Расчеты/Гидравлические расчеты/Выбор контура.png) */
const SAVED_PRESETS: SavedContourPreset[] = [
  {
    id: 'preset-oil-kust14',
    title: 'Контур нефти: Куст 14 → УПН-2',
    description: '4 объекта · 42.8 км · сохранен 12.09.2026',
    fluid: 'oil',
    objectNames: ['Куст 14', 'УПН-2', 'Нефтепровод 01', 'Врезка 01', 'БМУПН', 'БМУПН – т.вр.'],
  },
  {
    id: 'preset-gas-gp1',
    title: 'Контур газа: ГП-1 → Региональная сеть',
    description: '3 объекта · 18.2 км · сохранен 10.09.2026',
    fluid: 'gas',
    objectNames: ['ГП-1', 'Газопровод 03', 'УКПГ', 'ГВТ УКПГ- УКПГ-3', 'УКПГ-3'],
  },
  {
    id: 'preset-full-oil',
    title: 'Полная схема подготовки нефти',
    description: '8 объектов · 94.0 км · сохранен 05.09.2026',
    fluid: 'oil',
    objectNames: ['Куст 14', 'УПН-2', 'Нефтепровод 01', 'Врезка 01', 'БМУПН', 'т.вр. - ПСП', 'ПСП', 'НПС-10'],
  },
];

/** Стартовый набор контура по макету для случая, когда на карте ещё ничего не спроектировано */
const MOCK_CONTOUR_ITEMS: ContourObjectItem[] = [
  {
    id: 'obj-kust-14',
    name: 'Куст 14',
    type: 'Кустовая площадка',
    kind: 'wellpad',
    fluid: 'oil',
    role: 'source',
    statusLabel: 'Включен (источник)',
  },
  {
    id: 'obj-upn-2',
    name: 'УПН-2',
    type: 'Объект подготовки',
    kind: 'facility',
    fluid: 'oil',
    role: 'node',
    statusLabel: 'Включен (узел)',
  },
  {
    id: 'obj-pipe-01',
    name: 'Нефтепровод 01',
    type: 'Трубопровод',
    kind: 'pipeline',
    fluid: 'oil',
    role: 'route',
    statusLabel: 'Включен (трасса)',
    lengthKm: 42.8,
  },
  {
    id: 'obj-tap-01',
    name: 'Врезка 01',
    type: 'Врезка',
    kind: 'node',
    fluid: 'oil',
    role: 'joint',
    statusLabel: 'Включен (стык)',
  },
  {
    id: 'obj-pipe-03',
    name: 'Газопровод 03',
    type: 'Трубопровод',
    kind: 'pipeline',
    fluid: 'gas',
    role: 'excluded',
    statusLabel: 'Исключен (другой флюид)',
    lengthKm: 18.2,
  },
];

export function ContourTab({
  onNext,
  fluid: controlledFluid,
  onFluidChange,
}: ContourTabProps) {
  const { vertices, pipelines, taps } = useMapDrawing();

  const [localFluid, setLocalFluid] = useState<ContourFluid>('oil');
  const currentFluid = controlledFluid ?? localFluid;

  const handleFluidSelect = (nextFluid: ContourFluid) => {
    if (onFluidChange) onFluidChange(nextFluid);
    else setLocalFluid(nextFluid);
  };

  const [scenario, setScenario] = useState('Базовый сценарий (2026)');
  const [searchQuery, setSearchQuery] = useState('');

  // Формируем список объектов контура из реального Domain Layer либо из макетных данных
  const allItems = useMemo<ContourObjectItem[]>(() => {
    const hasDomainEntities = vertices.length > 0 || pipelines.length > 0 || taps.length > 0;

    if (!hasDomainEntities) {
      return MOCK_CONTOUR_ITEMS;
    }

    const items: ContourObjectItem[] = [];

    // Кусты (источники)
    for (const v of vertices) {
      if (v.kind === 'wellpad') {
        items.push({
          id: v.id,
          name: v.label,
          type: 'Кустовая площадка',
          kind: 'wellpad',
          fluid: 'oil',
          role: 'source',
          statusLabel: 'Включен (источник)',
        });
      }
    }

    // Площадки (узлы)
    for (const v of vertices) {
      if (v.kind === 'facility') {
        items.push({
          id: v.id,
          name: v.label,
          type: 'Объект подготовки',
          kind: 'facility',
          fluid: 'oil',
          role: 'node',
          statusLabel: 'Включен (узел)',
        });
      } else if (v.kind === 'delivery-point') {
        items.push({
          id: v.id,
          name: v.label,
          type: 'Точка поставки',
          kind: 'delivery-point',
          fluid: 'oil',
          role: 'node',
          statusLabel: 'Включен (узел)',
        });
      }
    }

    // Трубопроводы (трассы)
    for (const p of pipelines) {
      const isGas = p.fluid === 'gas' || p.label.toLowerCase().includes('газ') || p.label.toLowerCase().includes('гвт');
      const isWater = p.fluid === 'water';
      const pipeFluid: ContourFluid = isGas ? 'gas' : isWater ? 'water' : 'oil';
      const matchesFluid = pipeFluid === currentFluid;

      items.push({
        id: p.id,
        name: p.label,
        type: 'Трубопровод',
        kind: 'pipeline',
        fluid: pipeFluid,
        role: matchesFluid ? 'route' : 'excluded',
        statusLabel: matchesFluid ? 'Включен (трасса)' : 'Исключен (другой флюид)',
        lengthKm: 28.5,
      });
    }

    // Врезки (стыки)
    for (const t of taps) {
      items.push({
        id: t.id,
        name: t.label || 'Врезка',
        type: 'Врезка',
        kind: 'node',
        fluid: currentFluid,
        role: 'joint',
        statusLabel: 'Включен (стык)',
      });
    }

    return items;
  }, [vertices, pipelines, taps, currentFluid]);

  // Выбранные чекбоксами объекты
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // По умолчанию включаем объекты, подходящие под выбранный флюид
    const defaultIds = new Set<string>();
    for (const item of allItems) {
      if (item.role !== 'excluded') {
        defaultIds.add(item.id);
      }
    }
    return defaultIds;
  });

  // Фильтрация поиска
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q),
    );
  }, [allItems, searchQuery]);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Суммарная длина выбранных трасс
  const selectedLengthKm = useMemo(() => {
    return allItems
      .filter((i) => selectedIds.has(i.id) && i.lengthKm)
      .reduce((acc, i) => acc + (i.lengthKm ?? 0), 0);
  }, [allItems, selectedIds]);

  // Чеклист контроля связности графа
  const connectivityChecks = useMemo<ConnectivityCheckItem[]>(() => {
    const selected = allItems.filter((i) => selectedIds.has(i.id));
    const hasSource = selected.some((i) => i.kind === 'wellpad');
    const hasSink = selected.some((i) => i.kind === 'facility' || i.kind === 'delivery-point');
    const hasRoute = selected.some((i) => i.kind === 'pipeline');

    const sourceName = selected.find((i) => i.kind === 'wellpad')?.name || 'Куст 14';
    const sinkName = selected.find((i) => i.kind === 'facility' || i.kind === 'delivery-point')?.name || 'УПН-2';

    return [
      {
        id: 'sources',
        label: 'Источники потока определены',
        detail: hasSource ? `${sourceName} (расход 180 т/сут)` : 'Источники в контуре не выбраны',
        ok: hasSource,
      },
      {
        id: 'sinks',
        label: 'Стоки и потребители заданы',
        detail: hasSink ? `${sinkName} (приемная способность подтверждена)` : 'Узлы приема не выбраны',
        ok: hasSink,
      },
      {
        id: 'continuity',
        label: 'Разрывы трассы отсутствуют',
        detail: hasRoute ? 'Все сегменты имеют общие узлы' : 'Трасса трубопровода не включена',
        ok: hasRoute,
      },
      {
        id: 'properties',
        label: 'Свойства труб заполнены',
        detail: hasRoute ? 'Диаметры, толщины и шероховатость заданы' : 'Параметры участков не заполнены',
        ok: hasRoute,
      },
    ];
  }, [allItems, selectedIds]);

  const isGraphReady = connectivityChecks.every((c) => c.ok);

  // Применение сохраненной расчетной схемы
  const handleApplyPreset = (preset: SavedContourPreset) => {
    handleFluidSelect(preset.fluid);
    const newSelected = new Set<string>();
    for (const item of allItems) {
      if (preset.objectNames.some((n) => item.name.toLowerCase().includes(n.toLowerCase()))) {
        newSelected.add(item.id);
      }
    }
    // Если реальные объекты не совпали с именами макета, выбираем все подходящие по флюиду
    if (newSelected.size === 0) {
      allItems.forEach((i) => {
        if (i.role !== 'excluded') newSelected.add(i.id);
      });
    }
    setSelectedIds(newSelected);
  };

  return (
    <div className="contour-tab">
      {/* 1. Левая карточка: Параметры контура и таблица объектов */}
      <div className="contour-tab__card">
        <div className="contour-tab__eyebrow">ПАРАМЕТРЫ РАСЧЕТНОГО КОНТУРА</div>

        {/* Селекторы флюида и сценария */}
        <div className="contour-tab__filters-row">
          <div className="contour-tab__filter-field">
            <span className="contour-tab__filter-label">Тип флюида:</span>
            <select
              className="contour-tab__filter-select"
              value={currentFluid}
              onChange={(e) => handleFluidSelect(e.target.value as ContourFluid)}
            >
              <option value="oil">Нефть (промысловая)</option>
              <option value="gas">Газ (природный / попутный)</option>
              <option value="water">Вода (пластовая)</option>
            </select>
          </div>

          <div className="contour-tab__filter-field">
            <span className="contour-tab__filter-label">Сценарий модели:</span>
            <select
              className="contour-tab__filter-select"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              <option value="Базовый сценарий (2026)">Базовый сценарий (2026)</option>
              <option value="Сценарий 2030 (развитие)">Сценарий 2030 (развитие)</option>
              <option value="Пиковый зимний режим">Пиковый зимний режим</option>
            </select>
          </div>
        </div>

        {/* Поиск объектов */}
        <h2 className="contour-tab__heading" style={{ fontSize: '15px', marginBottom: '12px' }}>
          ОБЪЕКТЫ В КОНТУРЕ РАСЧЕТА
        </h2>

        <div className="contour-tab__search-wrap">
          <span className="contour-tab__search-icon">
            <AppIcon name="search" size={16} />
          </span>
          <input
            type="text"
            className="contour-tab__search-input"
            placeholder="Поиск объектов в контуре..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Таблица объектов в контуре */}
        <div className="contour-tab__table-wrap">
          <table className="contour-tab__table">
            <thead>
              <tr>
                <th className="contour-tab__col-check">
                  <input
                    type="checkbox"
                    className="contour-tab__checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    title="Выбрать все"
                    aria-label="Выбрать все объекты контура"
                  />
                </th>
                <th>Объект</th>
                <th>Тип</th>
                <th>Статус в контуре</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isChecked = selectedIds.has(item.id);
                const isExcluded = item.role === 'excluded';

                return (
                  <tr key={item.id} onClick={() => toggleSelectItem(item.id)}>
                    <td className="contour-tab__col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="contour-tab__checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectItem(item.id)}
                        aria-label={`Выбрать ${item.name}`}
                      />
                    </td>
                    <td className="contour-tab__obj-name">{item.name}</td>
                    <td>{item.type}</td>
                    <td>
                      <span
                        className={`contour-tab__badge ${isExcluded || !isChecked
                            ? 'contour-tab__badge--excluded'
                            : 'contour-tab__badge--included'
                          }`}
                      >
                        {isChecked ? item.statusLabel : 'Исключен из расчета'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                    Объекты не найдены по запросу
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Подвал левой карточки */}
        <div className="contour-tab__footer">
          <div className="contour-tab__summary">
            Выбрано объектов: {selectedIds.size} из {allItems.length} · Протяженность трасс:{' '}
            {selectedLengthKm.toFixed(1)} км
          </div>
          <button
            type="button"
            className="contour-tab__btn-next"
            disabled={selectedIds.size === 0}
            onClick={onNext}
          >
            Далее: Постановка задачи →
          </button>
        </div>
      </div>

      {/* 2. Правая колонка: Контроль связности и Сохраненные схемы */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Карточка 1: Контроль связности контура */}
        <div className="contour-tab__card">
          <div className="contour-tab__eyebrow">КОНТРОЛЬ СВЯЗНОСТИ КОНТУРА</div>
          <h2 className="contour-tab__heading">Проверка графа перед расчетом</h2>

          <div className="contour-tab__checklist">
            {connectivityChecks.map((check) => (
              <div key={check.id} className="contour-tab__check-item">
                <span
                  className={`contour-tab__check-icon${check.ok ? '' : ' contour-tab__check-icon--warn'
                    }`}
                >
                  {check.ok ? '✓' : '!'}
                </span>
                <div>
                  <h4 className="contour-tab__check-title">{check.label}</h4>
                  <p className="contour-tab__check-detail">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`contour-tab__status-banner ${isGraphReady
                ? 'contour-tab__status-banner--ok'
                : 'contour-tab__status-banner--warn'
              }`}
          >
            <span className="contour-tab__status-banner-dot" />
            <span>
              {isGraphReady
                ? 'Граф замкнут и готов к расчету'
                : 'Требуется завершить выбор объектов контура'}
            </span>
          </div>
        </div>

        {/* Карточка 2: Сохраненные типовые контуры */}
        <div className="contour-tab__card">
          <div className="contour-tab__eyebrow">СОХРАНЕННЫЕ КОНТУРЫ</div>
          <h2 className="contour-tab__heading">Типовые расчетные схемы</h2>

          <div className="contour-tab__presets">
            {SAVED_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className="contour-tab__preset-btn"
                onClick={() => handleApplyPreset(preset)}
              >
                <span className="contour-tab__preset-title">{preset.title}</span>
                <span className="contour-tab__preset-desc">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
