import { TopBarLogo } from './TopBarLogo';
import { TopBarBreadcrumbs, type TopBarCrumb } from './TopBarBreadcrumbs';
import { ViewModeSwitch } from './ViewModeSwitch';
import { ScenarioButton } from './ScenarioButton';
import { CalculateButton } from './CalculateButton';
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
  /** Открыть выбор сценария (заготовка — поведение уточняется) */
  onScenarioClick?: () => void;
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
  onScenarioClick,
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
      <ScenarioButton label={scenarioLabel} onClick={onScenarioClick} />
      <CalculateButton
        onClick={onCalculate}
        disabled={calculateDisabled}
        pending={calculatePending}
      />
    </header>
  );
}
