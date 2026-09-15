import { AppIcon } from '../components/AppIcon';
import './PanelRestoreBar.css';
import './AppShell.css';

type PanelRestoreBarProps = {
  /** right — полоса у правого края карты (иконка зеркалится) */
  side: 'left' | 'right';
  label: string;
  onRestore: () => void;
};

/**
 * Тонкая полоса-кнопка у края карты, возвращающая свёрнутую панель.
 * Занимает колонку свёрнутой панели (0px) и растянута через align/justify.
 */
export function PanelRestoreBar({ side, label, onRestore }: PanelRestoreBarProps) {
  return (
    <button
      type="button"
      className={`panel-restore-bar${side === 'right' ? ' panel-restore-bar--right' : ''}`}
      onClick={onRestore}
      aria-label={label}
      title={label}
    >
      <AppIcon name="collapse-panel" size={16} flipped={side === 'right'} />
    </button>
  );
}
