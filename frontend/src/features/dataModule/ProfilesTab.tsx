import { useState } from 'react';
import { PROFILES_CONTROL_VALUES } from './mockData';
import './ProfilesTab.css';

export function ProfilesTab() {
  const [selectedEntity, setSelectedEntity] = useState('Куст Северный');
  const [profileSource, setProfileSource] = useState('АКСИОМА (базовый вариант)');
  const [autoBalance, setAutoBalance] = useState(true);
  const [showSecondaryGas, setShowSecondaryGas] = useState(true);

  return (
    <div className="profiles-tab">
      {/* 1. Верхняя панель фильтрации профиля */}
      <div className="profiles-tab__topbar">
        <div className="profiles-tab__topbar-left">
          <div className="profiles-tab__field">
            <span className="profiles-tab__label">Объект:</span>
            <select
              className="profiles-tab__select"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="Куст Северный">Куст Северный</option>
              <option value="Куст Восточный">Куст Восточный</option>
              <option value="УПН-2">УПН-2</option>
              <option value="ГП-1">ГП-1</option>
            </select>
          </div>

          <div className="profiles-tab__field">
            <span className="profiles-tab__label">Источник профиля:</span>
            <select
              className="profiles-tab__select"
              value={profileSource}
              onChange={(e) => setProfileSource(e.target.value)}
            >
              <option value="АКСИОМА (базовый вариант)">АКСИОМА (базовый вариант)</option>
              <option value="ГДМ Расчёт 2026">ГДМ Расчёт 2026</option>
              <option value="Импорт (файл Excel)">Импорт (файл Excel)</option>
            </select>
          </div>

          <div className="profiles-tab__field">
            <span className="profiles-tab__label">Период:</span>
            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
              2026–2040
            </span>
          </div>
        </div>

        <button
          type="button"
          className="profiles-tab__btn-export"
          onClick={() => {
            alert('Экспорт профиля в Excel сформирован');
          }}
        >
          Экспорт профиля
        </button>
      </div>

      {/* 2. Основная сетка: График + Таблица слева и Настройки справа */}
      <div className="profiles-tab__grid">
        <div className="profiles-tab__card">
          <div className="profiles-tab__eyebrow">ДИНАМИКА ПРОДУКЦИИ</div>

          <div className="profiles-tab__chart-card">
            <div className="profiles-tab__chart-legend">
              <div className="profiles-tab__legend-item">
                <span className="profiles-tab__legend-dot" style={{ backgroundColor: '#8b5a2b' }} />
                <span>Нефть (тыс. т/год)</span>
              </div>
              <div className="profiles-tab__legend-item">
                <span className="profiles-tab__legend-dot" style={{ backgroundColor: '#eab308' }} />
                <span>Газ (млн м³/год)</span>
              </div>
              <div className="profiles-tab__legend-item">
                <span className="profiles-tab__legend-dot" style={{ backgroundColor: '#0284c7' }} />
                <span>Вода (тыс. т/год)</span>
              </div>
            </div>

            {/* SVG линейный график */}
            <svg
              className="profiles-tab__chart-svg"
              viewBox="0 0 600 190"
              preserveAspectRatio="none"
            >
              {/* Горизонтальные сетки */}
              <line x1="40" y1="30" x2="580" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="40" y1="80" x2="580" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="40" y1="130" x2="580" y2="130" stroke="#e2e8f0" strokeDasharray="3 3" />
              <line x1="40" y1="170" x2="580" y2="170" stroke="#cbd5e1" />

              {/* Ось Y подписи */}
              <text x="32" y="34" fontSize="10" fill="#94a3b8" textAnchor="end">500</text>
              <text x="32" y="84" fontSize="10" fill="#94a3b8" textAnchor="end">300</text>
              <text x="32" y="134" fontSize="10" fill="#94a3b8" textAnchor="end">100</text>

              {/* Линия Нефти (снижается) */}
              <polyline
                fill="none"
                stroke="#8b5a2b"
                strokeWidth="2.5"
                points="80,35 220,55 380,85 540,115"
              />
              <circle cx="80" cy="35" r="4" fill="#8b5a2b" />
              <circle cx="220" cy="55" r="4" fill="#8b5a2b" />
              <circle cx="380" cy="85" r="4" fill="#8b5a2b" />
              <circle cx="540" cy="115" r="4" fill="#8b5a2b" />

              {/* Линия Газа */}
              <polyline
                fill="none"
                stroke="#eab308"
                strokeWidth="2.5"
                points="80,140 220,145 380,150 540,155"
              />
              <circle cx="80" cy="140" r="4" fill="#eab308" />
              <circle cx="220" cy="145" r="4" fill="#eab308" />
              <circle cx="380" cy="150" r="4" fill="#eab308" />
              <circle cx="540" cy="155" r="4" fill="#eab308" />

              {/* Линия Воды (растёт обводнение) */}
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                points="80,135 220,118 380,88 540,65"
              />
              <circle cx="80" cy="135" r="4" fill="#0284c7" />
              <circle cx="220" cy="118" r="4" fill="#0284c7" />
              <circle cx="380" cy="88" r="4" fill="#0284c7" />
              <circle cx="540" cy="65" r="4" fill="#0284c7" />

              {/* Ось X подписи */}
              <text x="80" y="186" fontSize="11" fill="#64748b" textAnchor="middle">2026</text>
              <text x="220" y="186" fontSize="11" fill="#64748b" textAnchor="middle">2030</text>
              <text x="380" y="186" fontSize="11" fill="#64748b" textAnchor="middle">2035</text>
              <text x="540" y="186" fontSize="11" fill="#64748b" textAnchor="middle">2040</text>
            </svg>
          </div>

          <div className="profiles-tab__eyebrow">КОНТРОЛЬНЫЕ ЗНАЧЕНИЯ ПО ГОДАМ</div>
          <div className="profiles-tab__table-wrap">
            <table className="profiles-tab__table">
              <thead>
                <tr>
                  <th>Год</th>
                  <th>Добыча нефти</th>
                  <th>Добыча газа</th>
                  <th>Добыча воды</th>
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {PROFILES_CONTROL_VALUES.map((row) => (
                  <tr key={row.year}>
                    <td className="profiles-tab__col-year">{row.year}</td>
                    <td>{row.oil}</td>
                    <td>{row.gas}</td>
                    <td>{row.water}</td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Правая карточка: Параметры расчета */}
        <div className="profiles-tab__card">
          <div className="profiles-tab__eyebrow">ПАРАМЕТРЫ РАСЧЁТА</div>
          <h2 className="profiles-tab__heading">Учёт баланса продукции</h2>

          <div className="profiles-tab__calc-opts">
            <label className="profiles-tab__opt-label">
              <input
                type="checkbox"
                className="profiles-tab__opt-checkbox"
                checked={autoBalance}
                onChange={(e) => setAutoBalance(e.target.checked)}
              />
              <span>Автоматический баланс входящих и исходящих потоков</span>
            </label>

            <label className="profiles-tab__opt-label">
              <input
                type="checkbox"
                className="profiles-tab__opt-checkbox"
                checked={showSecondaryGas}
                onChange={(e) => setShowSecondaryGas(e.target.checked)}
              />
              <span>Учитывать ПНГ при расчёте гидравлики</span>
            </label>
          </div>

          <div className="profiles-tab__eyebrow">ПИКОВАЯ ЗАГРУЗКА ИНФРАСТРУКТУРЫ</div>
          <div className="profiles-tab__bars-card">
            <div className="profiles-tab__bar-row">
              <div className="profiles-tab__bar-labels">
                <span>Нефтепровод 01 (проектный максимум 600 т/сут)</span>
                <span>80%</span>
              </div>
              <div className="profiles-tab__bar-track">
                <div
                  className="profiles-tab__bar-fill"
                  style={{ width: '80%', backgroundColor: '#0066cc' }}
                />
              </div>
            </div>

            <div className="profiles-tab__bar-row">
              <div className="profiles-tab__bar-labels">
                <span>УПН-2 (подготовка нефти)</span>
                <span>65%</span>
              </div>
              <div className="profiles-tab__bar-track">
                <div
                  className="profiles-tab__bar-fill"
                  style={{ width: '65%', backgroundColor: '#10b981' }}
                />
              </div>
            </div>

            <div className="profiles-tab__bar-row">
              <div className="profiles-tab__bar-labels">
                <span>Газопровод 03 (проектный максимум)</span>
                <span>92%</span>
              </div>
              <div className="profiles-tab__bar-track">
                <div
                  className="profiles-tab__bar-fill"
                  style={{ width: '92%', backgroundColor: '#eab308' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
