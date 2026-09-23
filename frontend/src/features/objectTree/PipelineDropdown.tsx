import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import {
  PIPELINE_CLASS_LABEL,
  type DrainFluid,
  type PipelineClass,
} from '../map/drawingTypes';
import { FLUID_LABELS } from '../diagram/types';
import pipelineIcon from '../../assets/design/pipeline.png';import './PipelineDropdown.css';

/**
 * Настройка трубопровода в разделе «Проектирование» (макет «кнопка трубопроводы»).
 *
 * Карточка:
 *   - слева иконка типа (трубопровод) в квадрате + название «Трубопровод»
 *     и подпись текущего выбора «Продукт · Межпромысловый»;
 *   - справа шеврон (вверх — список раскрыт);
 *   - клик по основной части карточки выбирает инструмент «Трубопровод»;
 *     клик по шеврону раскрывает/сворачивает список настроек.
 *
 * Раскрытый список:
 *   1. ФЛЮИД — радиокнопки: Нефть / Газ / Продукт;
 *   2. КЛАСС ТРУБОПРОВОДА — радиокнопки: Промысловый / Межпромысловый /
 *      Магистральный;
 *   3. кнопка «Применить» — фиксирует выбор (до неё выбор — черновик).
 */

export type PipelineDropdownProps = {
  /** Текущий флюид новых сегментов */
  fluid: DrainFluid;
  /** Изменить флюид */
  onFluidChange: (fluid: DrainFluid) => void;
  /** Текущий класс новых сегментов */
  pipelineClass: PipelineClass;
  /** Изменить класс трубопровода */
  onPipelineClassChange: (pipelineClass: PipelineClass) => void;
  /** Клик по основной части карточки — выбрать инструмент «Трубопровод» */
  onSelectTool?: () => void;
  /**
   * Кнопка «Применить»: включить инструмент «Трубопровод» безусловно
   * (не toggle) — после применения кнопка должна быть в состоянии «нажата».
   */
  onApplyTool?: () => void;
  /** Инструмент «Трубопровод» активен (подсветка карточки) */
  active?: boolean;
};

/** Флюиды 1-го уровня (порядок как в макете). */
const FLUID_ORDER: readonly DrainFluid[] = ['oil', 'gas', 'product'];

/**
 * Классы 2-го уровня (внутри выпадающего списка): промысловый /
 * межпромысловый / магистральный. «Логический поток» — ОТДЕЛЬНАЯ кнопка
 * в панели проектирования (см. GraphToolbar), в списке не участвует.
 */
const PIPELINE_CLASS_LIST: readonly PipelineClass[] = ['field', 'interfield', 'trunk'];

export function PipelineDropdown({
  fluid,
  onFluidChange,
  pipelineClass,
  onPipelineClassChange,
  onSelectTool,
  onApplyTool,
  active = false,
}: PipelineDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне карточки и по Esc.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /**
   * Выбор радиокнопки применяется СРАЗУ: сохраняем значение и включаем
   * инструмент «Трубопровод» (кнопка становится нажатой — можно рисовать).
   */
  const chooseFluid = (value: DrainFluid) => {
    onFluidChange(value);
    (onApplyTool ?? onSelectTool)?.();
  };
  const chooseClass = (value: PipelineClass) => {
    onPipelineClassChange(value);
    (onApplyTool ?? onSelectTool)?.();
  };

  return (
    <div className="pipeline-dropdown" ref={rootRef}>
      {/* Карточка: выбор инструмента + текущее значение + кнопка раскрытия */}
      <div className={`pipeline-dropdown__trigger${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="pipeline-dropdown__main"
          aria-pressed={active}
          title="Трубопровод"
          onClick={onSelectTool}
        >
          <span className="pipeline-dropdown__icon" aria-hidden="true">
            <img src={pipelineIcon} alt="" width={18} height={18} />
          </span>
          <span className="pipeline-dropdown__titles">
            <span className="pipeline-dropdown__label">Трубопровод</span>
            <span className="pipeline-dropdown__value">
              {FLUID_LABELS[fluid]} · {PIPELINE_CLASS_LABEL[pipelineClass]}
            </span>
          </span>
        </button>

        {/* Мелкая кнопка раскрытия списка (НЕ выбирает инструмент) */}
        <button
          type="button"
          className="pipeline-dropdown__toggle"
          aria-label={open ? 'Свернуть настройки трубопровода' : 'Настройки трубопровода'}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Настройки трубопровода"
          onClick={() => setOpen((v) => !v)}
        >
          <AppIcon
            name="chevron-down"
            size={14}
            className={`pipeline-dropdown__chevron${open ? ' is-open' : ''}`}
          />
        </button>
      </div>

      {open && (
        <div className="pipeline-dropdown__menu" role="dialog" aria-label="Настройка трубопровода">
          {/* 1. ФЛЮИД — радиокнопки */}
          <div className="pipeline-dropdown__level" role="radiogroup" aria-label="Флюид">
            <span className="pipeline-dropdown__level-title">Флюид</span>
            {FLUID_ORDER.map((value) => {
              const checked = value === fluid;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`pipeline-dropdown__item${checked ? ' is-active' : ''}`}
                  onClick={() => chooseFluid(value)}
                >
                  <span className="pipeline-dropdown__radio" aria-hidden="true" />
                  <span className="pipeline-dropdown__item-label">{FLUID_LABELS[value]}</span>
                </button>
              );
            })}
          </div>

          <div className="pipeline-dropdown__divider" aria-hidden="true" />

          {/* 2. КЛАСС ТРУБОПРОВОДА — радиокнопки */}
          <div className="pipeline-dropdown__level" role="radiogroup" aria-label="Класс трубопровода">
            <span className="pipeline-dropdown__level-title">Класс трубопровода</span>
            {PIPELINE_CLASS_LIST.map((value) => {
              const checked = value === pipelineClass;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={`pipeline-dropdown__item${checked ? ' is-active' : ''}`}
                  onClick={() => chooseClass(value)}
                >
                  <span className="pipeline-dropdown__radio" aria-hidden="true" />
                  <span className="pipeline-dropdown__item-label">{PIPELINE_CLASS_LABEL[value]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
