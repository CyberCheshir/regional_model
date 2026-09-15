import type { ViewMode } from './TopBar';

export type ViewModeSwitchProps = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const OPTIONS: readonly { id: ViewMode; label: string }[] = [
  { id: 'view', label: 'Просмотр' },
  { id: 'edit', label: 'Редактирование' },
];

/**
 * Сегментированный переключатель «Просмотр / Редактирование».
 * Семантика — radiogroup: выбор одного из двух взаимоисключающих режимов.
 */
export function ViewModeSwitch({ value, onChange }: ViewModeSwitchProps) {
  return (
    <div className="topbar__view-switch" role="radiogroup" aria-label="Режим работы">
      {OPTIONS.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`topbar__view-option${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
