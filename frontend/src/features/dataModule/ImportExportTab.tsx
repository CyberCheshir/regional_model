import { IMPORT_TEMPLATES } from './mockData';
import './ImportExportTab.css';

export function ImportExportTab() {
  return (
    <div className="import-tab">
      {/* 1. Верхняя информационная карточка */}
      <div className="import-tab__intro-card">
        <h3 className="import-tab__intro-title">Импорт данных по шаблонам ПДИМ</h3>
        <p className="import-tab__intro-desc">
          Выберите нужный тип данных, скачайте актуальный Excel-шаблон, внесите необходимые данные и
          загрузите файл обратно. Система автоматически проверит структуру и валидность координат.
        </p>
      </div>

      {/* 2. Основная сетка: 4 карточки шаблонов слева + Результаты последней загрузки справа */}
      <div className="import-tab__grid">
        <div className="import-tab__templates-grid">
          {IMPORT_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="import-tab__tpl-card">
              <h4 className="import-tab__tpl-title">{tpl.title}</h4>
              <p className="import-tab__tpl-desc">{tpl.description}</p>
              <div className="import-tab__tpl-filename">{tpl.filename}</div>

              <div className="import-tab__tpl-actions">
                <button
                  type="button"
                  className="import-tab__btn-tpl import-tab__btn-tpl--download"
                  onClick={() => alert(`Скачивание шаблона ${tpl.filename}`)}
                >
                  Шаблон
                </button>
                <button
                  type="button"
                  className="import-tab__btn-tpl import-tab__btn-tpl--upload"
                  onClick={() => alert(`Выбор файла для загрузки: ${tpl.title}`)}
                >
                  Загрузить
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Правая карточка: Статус последней загрузки */}
        <div className="import-tab__card">
          <div className="import-tab__eyebrow">ПОСЛЕДНЯЯ ЗАГРУЗКА</div>
          <h2 className="import-tab__heading">Профили_ПДИМ.xlsx</h2>
          <div className="import-tab__subtext">20.09.2026 · пользователь: инженер-моделировщик</div>

          <table className="import-tab__stats-table">
            <tbody>
              <tr>
                <td className="import-tab__stats-label">Структура файла</td>
                <td className="import-tab__stats-val import-tab__stats-val--ok">Корректно</td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Объекты найдены</td>
                <td className="import-tab__stats-val import-tab__stats-val--ok">14 из 14</td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Новые строки</td>
                <td className="import-tab__stats-val">36</td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Конфликты</td>
                <td className="import-tab__stats-val import-tab__stats-val--warn">2 (некритичные)</td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Пропуски полей</td>
                <td className="import-tab__stats-val import-tab__stats-val--ok">0</td>
              </tr>
            </tbody>
          </table>

          <div className="import-tab__audit-actions">
            <button
              type="button"
              className="import-tab__btn-view"
              onClick={() => alert('Открытие отчёта аудита импорта')}
            >
              Просмотреть изменения
            </button>
            <button
              type="button"
              className="import-tab__btn-apply"
              onClick={() => alert('Данные успешно применены к модели')}
            >
              Применить импорт
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
