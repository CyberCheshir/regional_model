import './ToggleSwitch.css';

export type ToggleSwitchProps = {
  /** Подпись слева от переключателя */
  label: string;
  /** Включён ли переключатель */
  checked: boolean;
  /** Колбэк изменения состояния */
  onChange: (checked: boolean) => void;
};

/**
 * Тумблер по спецификации design description/styles.md §3.1 (`ui-switch`):
 * 36×20px, серый `#cbd5e1` / primary в checked, thumb 16px с translateX(16px).
 */
export function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch">
      <span className="toggle-switch__label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`ui-switch${checked ? ' is-checked' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ui-switch__thumb" />
      </button>
    </label>
  );
}
