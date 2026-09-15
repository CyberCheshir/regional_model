import { AppIcon } from '../AppIcon';
import './PanelHeader.css';

export type PanelHeaderProps = {
  /** Заголовок панели */
  title: string;
  /** Кнопка сворачивания панели */
  onCollapse?: () => void;
  /** Текст для кнопки сворачивания (title / aria-label) */
  collapseLabel?: string;
  /** Зеркалить иконку сворачивания (для правой панели — шеврон вправо) */
  collapseFlipped?: boolean;
};

/**
 * Шапка панели (design description/components.md §3.1):
 * eyebrow-заголовок слева, кнопка сворачивания справа.
 */
export function PanelHeader({
  title,
  onCollapse,
  collapseLabel = 'Свернуть панель',
  collapseFlipped = false,
}: PanelHeaderProps) {
  return (
    <header className="panel-header">
      <h2 className="panel-header__title">{title}</h2>
      {onCollapse && (
        <button
          type="button"
          className="panel-header__collapse"
          onClick={onCollapse}
          title={collapseLabel}
          aria-label={collapseLabel}
        >
          <AppIcon name="collapse-panel" size={16} flipped={collapseFlipped} />
        </button>
      )}
    </header>
  );
}
