import { FLUID_LABELS, type DiagramConfig } from './types';
import type { FluidType } from '../map/mapData';
import './FluidSegmentedControl.css';

export type FluidSegmentedControlProps = {
  value: DiagramConfig['fluid'];
  onChange: (fluid: FluidType) => void;
};

/** Сегментированный переключатель флюида (Нефть / Газ / Вода). */
export function FluidSegmentedControl({ value, onChange }: FluidSegmentedControlProps) {
  const options = Object.entries(FLUID_LABELS) as [FluidType, string][];

  return (
    <div className="fluid-seg" role="radiogroup" aria-label="Тип флюида">
      {options.map(([fluid, label]) => (
        <button
          key={fluid}
          type="button"
          role="radio"
          aria-checked={value === fluid}
          className={`fluid-seg__item${value === fluid ? ' fluid-seg__item--active' : ''}`}
          onClick={() => onChange(fluid)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
