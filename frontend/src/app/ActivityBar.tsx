import { AppIcon } from '../components/AppIcon';
import './ActivityBar.css';

/** Разделы приложения, доступные из Activity Bar */
export type ModuleId = 'map' | 'data' | 'calc' | 'analytics';

/** Описание пункта навигации */
export type ActivityBarItemData = {
  id: ModuleId;
  /** Подпись для tooltip / aria-label */
  label: string;
  icon: Parameters<typeof AppIcon>[0]['name'];
};

/** Пункты Activity Bar (design description/components.md §2.1) */
export const ACTIVITY_BAR_ITEMS: readonly ActivityBarItemData[] = [
  { id: 'map', label: 'Карта', icon: 'nav-map' },
  { id: 'data', label: 'Данные', icon: 'nav-data' },
  { id: 'calc', label: 'Расчёты', icon: 'nav-calc' },
  { id: 'analytics', label: 'Аналитика', icon: 'nav-analytics' },
] as const;

export type ActivityBarProps = {
  /** Активный раздел */
  activeModule: ModuleId;
  /** Смена активного раздела */
  onModuleChange: (module: ModuleId) => void;
  /** Включён ли режим разработчика */
  devMode?: boolean;
  /** Переключить режим разработчика */
  onToggleDevMode?: () => void;
};

/**
 * Вертикальная панель навигации (56px, тёмная колонка).
 * Активный пункт — белая иконка, фоновая подложка и синий индикатор слева.
 */
export function ActivityBar({
  activeModule,
  onModuleChange,
  devMode = false,
  onToggleDevMode,
}: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Основная навигация">
      <ul className="activity-bar__list">
        {ACTIVITY_BAR_ITEMS.map((item) => {
          const isActive = item.id === activeModule;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`activity-bar__item${isActive ? ' is-active' : ''}`}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onModuleChange(item.id)}
              >
                <AppIcon name={item.icon} size={24} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Кнопка режима разработчика — внизу панели */}
      {onToggleDevMode && (
        <button
          type="button"
          className={`activity-bar__item activity-bar__item--dev${devMode ? ' is-active' : ''}`}
          title={devMode ? 'Выключить режим разработчика' : 'Включить режим разработчика'}
          aria-label="Режим разработчика"
          aria-pressed={devMode}
          onClick={onToggleDevMode}
        >
          <AppIcon name="dev-mode" size={22} />
        </button>
      )}
    </nav>
  );
}
