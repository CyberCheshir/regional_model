export type ScenarioButtonProps = {
  /** Название выбранного сценария */
  label: string;
  onClick?: () => void;
};

/**
 * Кнопка выбора сценария (вторичная). Поведение выпадающего списка —
 * заготовка: пока только колбэк (уточняется в ТЗ).
 */
export function ScenarioButton({ label, onClick }: ScenarioButtonProps) {
  return (
    <button
      type="button"
      className="topbar__button"
      aria-haspopup="listbox"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
