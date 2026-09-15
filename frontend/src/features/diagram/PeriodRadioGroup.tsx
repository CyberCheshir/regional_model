import { PERIOD_LABELS } from './types';
import type { DiagramConfig } from './types';
import './PeriodRadioGroup.css';

export type PeriodRadioGroupProps = {
  value: DiagramConfig['periodMode'];
  customRange: DiagramConfig['customRange'];
  onChange: (mode: DiagramConfig['periodMode']) => void;
  onCustomRangeChange: (range: [number, number]) => void;
};

/** Радио-группа периода: «Как на карте» / «Весь период проекта» / «Свой диапазон». */
export function PeriodRadioGroup({
  value,
  customRange,
  onChange,
  onCustomRangeChange,
}: PeriodRadioGroupProps) {
  const options = Object.entries(PERIOD_LABELS) as [
    DiagramConfig['periodMode'],
    string,
  ][];

  const handleRangeChange = (index: 0 | 1, raw: string) => {
    const year = Number(raw);
    if (!Number.isInteger(year)) return;
    const next: [number, number] = [...customRange] as [number, number];
    next[index] = year;
    if (next[0] > next[1]) return; // не допускаем инверсию диапазона
    onCustomRangeChange(next);
  };

  return (
    <div className="period-radio" role="radiogroup" aria-label="Период данных">
      {options.map(([mode, label]) => (
        <label key={mode} className="period-radio__option">
          <input
            type="radio"
            name="diagram-period"
            checked={value === mode}
            onChange={() => onChange(mode)}
          />
          <span className="period-radio__dot" />
          <span className="period-radio__label">{label}</span>
          {mode === 'custom' && value === 'custom' && (
            <span className="period-radio__range">
              <input
                type="number"
                value={customRange[0]}
                min={1900}
                max={2100}
                aria-label="Год начала"
                onChange={(e) => handleRangeChange(0, e.target.value)}
              />
              <span>—</span>
              <input
                type="number"
                value={customRange[1]}
                min={1900}
                max={2100}
                aria-label="Год окончания"
                onChange={(e) => handleRangeChange(1, e.target.value)}
              />
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
