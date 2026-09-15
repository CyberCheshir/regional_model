export type CalculateButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  /** Идёт расчёт — показываем спиннер */
  pending?: boolean;
};

/** Кнопка запуска расчёта (outline-вариант основной кнопки). */
export function CalculateButton({ onClick, disabled, pending }: CalculateButtonProps) {
  return (
    <button
      type="button"
      className="topbar__button topbar__button--primary"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <span className="topbar__spinner" aria-hidden="true" />}
      {pending ? 'Расчёт…' : 'Рассчитать'}
    </button>
  );
}
