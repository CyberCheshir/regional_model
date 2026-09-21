import { useCallback, useRef } from 'react';
import { YearRangeSlider } from './YearRangeSlider';
import {
  DEFAULT_TIME_RANGE,
  PROJECT_YEAR_MAX,
  PROJECT_YEAR_MIN,
  TIME_RANGE_MODE_LABEL,
  TIME_RANGE_MODE_ORDER,
  describeTimeRange,
  normalizeRange,
  type TimeRangeMode,
  type TimeRangeState,
  type YearRange,
} from './types';
import './BottomPanel.css';

export type BottomPanelProps = {
  /** Текущее состояние демонстрируемого периода */
  value: TimeRangeState;
  /** Изменение периода целиком (контролируемый компонент) */
  onChange: (next: TimeRangeState) => void;
  /** Подпись проекта (необязательная, для контекста справа) */
  projectLabel?: string;
};

/**
 * Нижняя панель «Демонстрируемый период» (макет `UI images/bottom panel.png`):
 * сегментированный переключатель режима (Год / Период / Всё время) и слайдер
 * диапазона годов проекта с капсульными бейджами значений.
 *
 * Компонент презентационный и контролируемый — состояние живёт выше (App/uiState).
 */
export function BottomPanel({ value, onChange, projectLabel }: BottomPanelProps) {
  /** Было ли изменение инициировано перетаскиванием (для группировки истории). */
  const draggingRef = useRef(false);

  const setMode = useCallback(
    (mode: TimeRangeMode) => {
      onChange({ ...value, mode });
    },
    [onChange, value],
  );

  const setRange = useCallback(
    (range: YearRange) => {
      onChange({ ...value, mode: 'period', range });
    },
    [onChange, value],
  );

  return (
    <section className="bottom-panel" aria-label="Демонстрируемый период">
      <div className="bottom-panel__header">
        <span className="bottom-panel__title eyebrow">Демонстрируемый период</span>
        <span className="bottom-panel__summary" title="Выбранный период">
          {describeTimeRange(value)}
        </span>
      </div>

      <div className="bottom-panel__body">
        <div className="bottom-panel__modes" role="group" aria-label="Режим периода">
          {TIME_RANGE_MODE_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              className={
                value.mode === mode
                  ? 'bottom-panel__mode is-active'
                  : 'bottom-panel__mode'
              }
              aria-pressed={value.mode === mode}
              onClick={() => setMode(mode)}
            >
              {TIME_RANGE_MODE_LABEL[mode]}
            </button>
          ))}
        </div>

        {value.mode === 'all' ? (
          <div className="bottom-panel__all-range">
            <span className="bottom-panel__all-label">
              {PROJECT_YEAR_MIN} — {PROJECT_YEAR_MAX}
            </span>
            <span className="bottom-panel__all-hint">весь период проекта</span>
          </div>
        ) : value.mode === 'year' ? (
          <div className="bottom-panel__year">
            <input
              type="range"
              className="bottom-panel__year-input"
              min={PROJECT_YEAR_MIN}
              max={PROJECT_YEAR_MAX}
              step={1}
              value={value.year}
              aria-label="Демонстрируемый год"
              onChange={(event) => onChange({ ...value, year: Number(event.target.value) })}
            />
            <span className="bottom-panel__year-badge">{value.year}</span>
          </div>
        ) : (
          <YearRangeSlider
            value={value.range}
            onChange={(range, moving) => {
              // Изменение диапазона перетаскиванием уже нормализовано в слайдере;
              // здесь только гарантируем корректность перед отправкой наверх.
              setRange(normalizeRange(range, moving));
            }}
            onDragStart={() => {
              draggingRef.current = true;
            }}
            onDragEnd={() => {
              draggingRef.current = false;
            }}
          />
        )}
      </div>

      {projectLabel ? <span className="bottom-panel__project">{projectLabel}</span> : null}
    </section>
  );
}

/** Значение по умолчанию для потребителей панели (App). */
export { DEFAULT_TIME_RANGE };
export type { TimeRangeState, TimeRangeMode, YearRange };
