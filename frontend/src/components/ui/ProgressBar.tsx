import './ProgressBar.css';

export type ProgressBarProps = {
  /** Прогресс 0..100 */
  value: number;
  /** Подпись этапа (что сейчас происходит) */
  label?: string;
  /** Показывать процент справа */
  showPercent?: boolean;
};

/** Линейный индикатор прогресса (0..100) с необязательной подписью этапа. */
export function ProgressBar({ value, label, showPercent = true }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      {(label || showPercent) && (
        <div className="progress-bar__head">
          {label && <span className="progress-bar__label">{label}</span>}
          {showPercent && <span className="progress-bar__percent">{clamped}%</span>}
        </div>
      )}
      <div className="progress-bar__track">
        <div className="progress-bar__fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
