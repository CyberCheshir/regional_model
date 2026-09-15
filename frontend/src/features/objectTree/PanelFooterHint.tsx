import './PanelFooterHint.css';

/**
 * Подсказка в подвале панели (components.md §3.3):
 * «Диаграмма — настроить · Глаз — показать/скрыть».
 */
export function PanelFooterHint() {
  return (
    <footer className="panel-footer-hint">
      <span>
        <strong>Диаграмма</strong> — настроить
      </span>
      <span className="panel-footer-hint__sep" aria-hidden="true">
        ·
      </span>
      <span>
        <strong>Глаз</strong> — показать/скрыть
      </span>
    </footer>
  );
}
