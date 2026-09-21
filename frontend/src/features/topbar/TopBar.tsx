import { TopBarLogo } from './TopBarLogo';
import { TopBarBreadcrumbs, type TopBarCrumb } from './TopBarBreadcrumbs';
import { ViewModeSwitch } from './ViewModeSwitch';
import { ScenarioButton } from './ScenarioButton';
import { CalculateButton } from './CalculateButton';
import { SaveGraphControl } from './SaveGraphControl';
import './TopBar.css';

/** Режим работы модуля: только просмотр или редактирование графа. */
export type ViewMode = 'view' | 'edit';

export type TopBarProps = {
  /** Хлебные крошки (последняя — текущая страница, не ссылка) */
  breadcrumbs?: readonly TopBarCrumb[];
  /** Текущий режим (Просмотр/Редактирование) */
  viewMode: ViewMode;
  /** Смена режима */
  onViewModeChange: (mode: ViewMode) => void;
  /** Название выбранного сценария */
  scenarioLabel: string;
  /** Открыть сохранённый сценарий (загрузка снимка из БД) */
  onOpenScenario?: (scenarioId: string, name: string) => void;
  /** Импорт модели из JSON-файла */
  onImportModel?: () => void;
  /** Экспорт модели в JSON-файл */
  onExportModel?: () => void;
  /** Запустить расчёт */
  onCalculate?: () => void;
  /** Кнопка «Рассчитать» недоступна */
  calculateDisabled?: boolean;
  /** Идёт расчёт (спиннер, aria-busy) */
  calculatePending?: boolean;
};

/**
 * Верхняя панель (TopBar) — плавающий оверлей поверх карты: логотип,
 * хлебные крошки, переключатель режима, выбор сценария и запуск расчёта.
 * Компонент презентационный: состояние живёт выше (App/uiState).
 */
export function TopBar({
  breadcrumbs = [],
  viewMode,
  onViewModeChange,
  scenarioLabel,
  onOpenScenario,
  onImportModel,
  onExportModel,
  onCalculate,
  calculateDisabled,
  calculatePending,
}: TopBarProps) {
  return (
    <header className="topbar" aria-label="Верхняя панель">
      <TopBarLogo />
      <TopBarBreadcrumbs items={breadcrumbs} />
      <span className="topbar__spacer" />
      <ViewModeSwitch value={viewMode} onChange={onViewModeChange} />
      <span className="topbar__spacer" />
      <ScenarioButton label={scenarioLabel} onOpen={onOpenScenario} />
      {/* Импорт/экспорт модели — JSON-файл (рядом со «Сценариями»). */}
      <button
        type="button"
        className="topbar__button"
        onClick={onImportModel}
        title="Импорт модели из JSON"
      >
        Импорт модели
      </button>
      <button
        type="button"
        className="topbar__button"
        onClick={onExportModel}
        title="Экспорт модели в JSON"
      >
        Экспорт модели
      </button>
      <SaveGraphControl />
      <CalculateButton
        onClick={onCalculate}
        disabled={calculateDisabled}
        pending={calculatePending}
      />
    </header>
  );
}
