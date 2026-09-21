import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  PROJECT_YEAR_MAJOR,
  PROJECT_YEAR_MAX,
  PROJECT_YEAR_MIN,
  PROJECT_YEARS,
  clampYear,
  normalizeRange,
  type YearRange,
} from './types';

export type YearRangeSliderProps = {
  /** Текущий диапазон [начало, конец] */
  value: YearRange;
  /** Изменение диапазона (moving — какой конец тянет пользователь) */
  onChange: (next: YearRange, moving: 'start' | 'end') => void;
  /** Начало/конец перетаскивания — для группировки истории изменений */
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

/** Отступ шкалы от краёв трека, % — чтобы капсульные бейджи ручек не обрезались. */
const TRACK_INSET_PERCENT = 4;

/** Позиция года на треке в процентах (с учётом отступа шкалы). */
function yearToPercent(year: number): number {
  const span = PROJECT_YEAR_MAX - PROJECT_YEAR_MIN;
  const ratio = span === 0 ? 0 : (clampYear(year) - PROJECT_YEAR_MIN) / span;
  return TRACK_INSET_PERCENT + ratio * (100 - TRACK_INSET_PERCENT * 2);
}

/** Проценты трека → год (обратное преобразование для перетаскивания). */
function percentToYear(percent: number): number {
  const ratio = (percent - TRACK_INSET_PERCENT) / (100 - TRACK_INSET_PERCENT * 2);
  return clampYear(PROJECT_YEAR_MIN + ratio * (PROJECT_YEAR_MAX - PROJECT_YEAR_MIN));
}

/**
 * Двойной слайдер годов (макет «Демонстрируемый период»): шкала лет проекта,
 * выделенный диапазон, две ручки-коннектора с капсульными бейджами значений.
 *
 * Ручки — не нативные `input[type=range]`, а кнопки с зоной захвата размером
 * с саму ручку. У нативного input thumb шире видимой ручки и его центр не
 * совпадает с ней из-за отступов трека, поэтому ползунок «хватался» не по
 * ручке, а рядом (слева/справа от неё).
 * Клавиатура поддержана вручную (стрелки, Home/End, PageUp/PageDown) —
 * доступность сохранена, поведение указателя стало точным.
 */
export function YearRangeSlider({ value, onChange, onDragStart, onDragEnd }: YearRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [start, end] = value;

  /**
   * Какая ручка перетаскивается (null — ничего): у неё виден бейдж с годом.
   * Доступно только для чтения в разметке — сама тяга идёт через ref.
   */
  const [draggingEnd, setDraggingEnd] = useState<'start' | 'end' | null>(null);
  /**
   * Перетаскиваемая ручка. Именно ref, а не state: `pointermove` приходит
   * синхронно с первым движением, до перерисовки, и состояние в замыкании
   * обработчика было бы устаревшим.
   */
  const draggingRef = useRef<'start' | 'end' | null>(null);
  /** Сдвиг между курсором и центром ручки при захвате — ручка не «прыгает». */
  const grabOffsetRef = useRef(0);

  /** Пиксельный сдвиг курсора от левого края трека. */
  const pixelFromPointer = useCallback((clientX: number): number | null => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    return clientX - rect.left;
  }, []);

  /** Год в позиции курсора с учётом сдвига захвата. */
  const yearAtPixel = useCallback((pixel: number): number | null => {
    const track = trackRef.current;
    if (!track) return null;
    const width = track.getBoundingClientRect().width;
    if (width === 0) return null;
    const percent = ((pixel - grabOffsetRef.current) / width) * 100;
    // percentToYear сам зажимает значение к границам шкалы (клампится),
    // поэтому вынос курсора за пределы трека даёт крайний год, а не скачок.
    return percentToYear(percent);
  }, []);

  /** Применить новое значение перетаскиваемой ручки. */
  const applyDragYear = useCallback(
    (which: 'start' | 'end', year: number) => {
      const next: YearRange = which === 'start' ? [year, end] : [start, year];
      onChange(normalizeRange(next, which), which);
    },
    [end, onChange, start],
  );

  /**
   * Начать перетаскивание. Слушатели вешаются на window: захват указателя
   * на пересоздаваемом узле рвётся, а window-слушатели не зависят от того,
   * перерисовался ли React. Завершение — гарантированно в `finishDrag`.
   */
  const beginDrag = useCallback(
    (which: 'start' | 'end', startYear: number, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      draggingRef.current = which;
      setDraggingEnd(which);
      const pixel = pixelFromPointer(event.clientX);
      if (pixel !== null) {
        const track = trackRef.current;
        const width = track ? track.getBoundingClientRect().width : 0;
        // Сдвиг курсора от центра ручки: не даём ручке «прыгнуть» под курсор.
        const handlePixel = (yearToPercent(startYear) / 100) * width;
        grabOffsetRef.current = pixel - handlePixel;
      }
      onDragStart?.();

      // Год сразу по позиции курсора — ручка следует за мышью с первого кадра.
      if (pixel !== null) applyDragYear(which, yearAtPixel(pixel) ?? startYear);

      const move = (e: PointerEvent) => {
        const active = draggingRef.current;
        if (active === null) return;
        const p = pixelFromPointer(e.clientX);
        if (p === null) return;
        const year = yearAtPixel(p);
        if (year === null) return;
        applyDragYear(active, year);
      };
      const finish = () => {
        draggingRef.current = null;
        setDraggingEnd(null);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        onDragEnd?.();
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [applyDragYear, onDragEnd, onDragStart, pixelFromPointer, yearAtPixel],
  );

  // Уборка на размонтирование: если компонент исчез во время тяги,
  // window-слушатели не должны остаться висеть.
  useEffect(
    () => () => {
      draggingRef.current = null;
    },
    [],
  );

  const startPercent = useMemo(() => yearToPercent(start), [start]);
  const endPercent = useMemo(() => yearToPercent(end), [end]);

  /** Управление ручкой с клавиатуры: шаг 1 год, Shift/PageUp/Down — 5, Home/End — края. */
  const handleKeyDown = useCallback(
    (which: 'start' | 'end', event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const step = event.shiftKey ? 5 : 1;
      const current = which === 'start' ? start : end;
      let next: number | null = null;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          next = current - step;
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          next = current + step;
          break;
        case 'PageDown':
          next = current - 5;
          break;
        case 'PageUp':
          next = current + 5;
          break;
        case 'Home':
          next = PROJECT_YEAR_MIN;
          break;
        case 'End':
          next = PROJECT_YEAR_MAX;
          break;
        default:
          return;
      }
      event.preventDefault();
      const range: YearRange = which === 'start' ? [next, end] : [start, next];
      onChange(normalizeRange(range, which), which);
    },
    [end, onChange, start],
  );

  /** Ручка «начало периода» — кнопка с точной зоной захвата. */
  const renderStartHandle = () => (
    <button
      type="button"
      className="year-range-slider__handle"
      style={{ left: `${startPercent}%` }}
      role="slider"
      aria-label="Начало периода"
      aria-valuemin={PROJECT_YEAR_MIN}
      aria-valuemax={end}
      aria-valuenow={start}
      aria-valuetext={`${start}`}
      onPointerDown={(event) => beginDrag('start', start, event)}
      onKeyDown={(event) => handleKeyDown('start', event)}
      onFocus={() => setDraggingEnd('start')}
      onBlur={() => setDraggingEnd(null)}
    />
  );

  /** Ручка «конец периода» — кнопка с точной зоной захвата. */
  const renderEndHandle = () => (
    <button
      type="button"
      className="year-range-slider__handle"
      style={{ left: `${endPercent}%` }}
      role="slider"
      aria-label="Конец периода"
      aria-valuemin={start}
      aria-valuemax={PROJECT_YEAR_MAX}
      aria-valuenow={end}
      aria-valuetext={`${end}`}
      onPointerDown={(event) => beginDrag('end', end, event)}
      onKeyDown={(event) => handleKeyDown('end', event)}
      onFocus={() => setDraggingEnd('end')}
      onBlur={() => setDraggingEnd(null)}
    />
  );

  return (
    <div className="year-range-slider">
      <div className="year-range-slider__track" ref={trackRef}>
        <span className="year-range-slider__baseline" aria-hidden="true" />
        {/* Штрихи-насечки по каждому году шкалы: крупные — по опорным годам */}
        {PROJECT_YEARS.map((year) => (
          <span
            key={year}
            className={
              PROJECT_YEAR_MAJOR.includes(year)
                ? 'year-range-slider__stroke is-major'
                : 'year-range-slider__stroke'
            }
            style={{ left: `${yearToPercent(year)}%` }}
            aria-hidden="true"
          />
        ))}
        <span
          className="year-range-slider__filled"
          aria-hidden="true"
          style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
        />
        {/* Бейдж года — ТОЛЬКО над той ручкой, которую сейчас тянут */}
        {draggingEnd === 'start' && (
          <span
            className="year-range-slider__badge"
            style={{ left: `${startPercent}%` }}
            aria-hidden="true"
          >
            {start}
          </span>
        )}
        {draggingEnd === 'end' && (
          <span
            className="year-range-slider__badge"
            style={{ left: `${endPercent}%` }}
            aria-hidden="true"
          >
            {end}
          </span>
        )}

        {renderStartHandle()}
        {renderEndHandle()}
      </div>

      {/* Подписи годов: акцентные — крупно (как в макете), остальные — насечки */}
      <div className="year-range-slider__ticks" aria-hidden="true">
        {PROJECT_YEAR_MAJOR.map((year) => (
          <span
            key={year}
            className={
              year >= start && year <= end
                ? 'year-range-slider__tick is-active'
                : 'year-range-slider__tick'
            }
            style={{ left: `${yearToPercent(year)}%` }}
          >
            {year}
          </span>
        ))}
      </div>
    </div>
  );
}
