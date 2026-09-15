import { PLACEMENT_LABELS } from './types';
import type { DiagramConfig } from './types';
import './PlacementDropdown.css';

export type PlacementDropdownProps = {
  value: DiagramConfig['placement'];
  onChange: (placement: DiagramConfig['placement']) => void;
};

/** Селектор позиции плавающей диаграммы (Авто / Сверху / Снизу / …). */
export function PlacementDropdown({ value, onChange }: PlacementDropdownProps) {
  const options = Object.entries(PLACEMENT_LABELS) as [
    DiagramConfig['placement'],
    string,
  ][];

  return (
    <label className="placement-dd">
      <span className="placement-dd__label">Расположение</span>
      <select
        className="placement-dd__select"
        value={value}
        onChange={(e) => onChange(e.target.value as DiagramConfig['placement'])}
      >
        {options.map(([placement, label]) => (
          <option key={placement} value={placement}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
