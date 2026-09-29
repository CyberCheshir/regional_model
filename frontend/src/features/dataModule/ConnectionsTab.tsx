import { useState } from 'react';
import { CONNECTIONS_DATA } from './mockData';
import './ConnectionsTab.css';

export function ConnectionsTab() {
  const [filterType, setFilterType] = useState<'all' | 'physical' | 'logical' | 'check'>('all');

  const filteredConnections = CONNECTIONS_DATA.filter((conn) => {
    if (filterType === 'physical' && conn.flowType === 'Логический поток') return false;
    if (filterType === 'logical' && conn.flowType !== 'Логический поток') return false;
    if (filterType === 'check' && conn.status !== 'Проверить') return false;
    return true;
  });

  return (
    <div className="connections-tab">
      {/* 1. Верхняя панель фильтрации связей */}
      <div className="connections-tab__topbar">
        <div className="connections-tab__filter-pills" role="tablist">
          <button
            type="button"
            className={`connections-tab__pill${filterType === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            Все связи ({CONNECTIONS_DATA.length})
          </button>
          <button
            type="button"
            className={`connections-tab__pill${filterType === 'physical' ? ' is-active' : ''}`}
            onClick={() => setFilterType('physical')}
          >
            Физические трубы (3)
          </button>
          <button
            type="button"
            className={`connections-tab__pill${filterType === 'logical' ? ' is-active' : ''}`}
            onClick={() => setFilterType('logical')}
          >
            Логические потоки (1)
          </button>
          <button
            type="button"
            className={`connections-tab__pill${filterType === 'check' ? ' is-active' : ''}`}
            onClick={() => setFilterType('check')}
          >
            Требуют проверки (1)
          </button>
        </div>
      </div>

      {/* 2. Основная сетка: Таблица связей слева + Контроль топологии справа */}
      <div className="connections-tab__grid">
        <div className="connections-tab__card">
          <div className="connections-tab__eyebrow">СВЯЗИ И ПОТОКИ МОДЕЛИ</div>

          <div className="connections-tab__table-wrap">
            <table className="connections-tab__table">
              <thead>
                <tr>
                  <th>Откуда</th>
                  <th>Тип связи / Трубопровод</th>
                  <th>Куда</th>
                  <th>Класс / Флюид</th>
                  <th>Период</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filteredConnections.map((conn) => (
                  <tr key={conn.id}>
                    <td className="connections-tab__name">{conn.from}</td>
                    <td>{conn.flowType}</td>
                    <td className="connections-tab__name">{conn.to}</td>
                    <td>{conn.productClass}</td>
                    <td>{conn.period}</td>
                    <td>
                      <span
                        className={`connections-tab__status-badge${conn.status === 'Проверить'
                            ? ' connections-tab__status-badge--check'
                            : ''
                          }`}
                      >
                        {conn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Правая карточка: Контроль топологии */}
        <div className="connections-tab__card">
          <div className="connections-tab__eyebrow">КОНТРОЛЬ ТОПОЛОГИИ</div>
          <h2 className="connections-tab__heading">Проверка связанности графа</h2>

          <div className="connections-tab__check-list">
            <div className="connections-tab__check-item">
              <span className="connections-tab__check-icon">✓</span>
              <div>
                <h4 className="connections-tab__check-title">Привязка концов труб к объектам</h4>
                <p className="connections-tab__check-desc">
                  Все 3 физических сегмента имеют чёткую привязку к кустам и площадкам подготовки.
                </p>
              </div>
            </div>

            <div className="connections-tab__check-item">
              <span className="connections-tab__check-icon connections-tab__check-icon--warn">
                !
              </span>
              <div>
                <h4 className="connections-tab__check-title">Согласованность периодов действия</h4>
                <p className="connections-tab__check-desc">
                  Для <strong>Газопровод 03</strong> начало эксплуатации (2028 г.) не совпадает со
                  стартом целевого объекта (2026 г.). Рекомендуется проверить даты.
                </p>
              </div>
            </div>

            <div className="connections-tab__check-item">
              <span className="connections-tab__check-icon">✓</span>
              <div>
                <h4 className="connections-tab__check-title">Логические потоки без труб</h4>
                <p className="connections-tab__check-desc">
                  Конфликтов направления движения сырья не обнаружено.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
