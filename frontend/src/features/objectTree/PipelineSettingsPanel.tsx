import {
  PIPELINE_CLASS_LABEL,
  PIPELINE_CLASS_ORDER,
  type DrainFluid,
  type PipelineClass,
} from '../map/drawingTypes';
import { FLUID_LABELS } from '../diagram/types';
import { getFluidColor, getEdgeColor, getPipelineClassStyle } from '../map/mapColors';
import './PipelineSettingsPanel.css';

/**
 * Панель настройки трубопровода в разделе «Проектирование».
 *
 * Заменяет одиночную кнопку «Трубопровод»: перед рисованием задаются
 * две независимые характеристики (как в макете «проектирование__трубопровод»):
 *   1. Флюид (цвет линии)      — segmented-контрол: Нефть / Газ / Продукт;
 *   2. Класс трубопровода (стиль: толщина + пунктир) — список из 4 строк.
 *
 * Образец линии в списке классов окрашивается текущим флюидом, поэтому
 * цвет и класс видны одновременно.
 */

export type PipelineSettingsPanelProps = {
  /** Текущий флюид новых сегментов */
  fluid: DrainFluid;
  /** Изменить флюид */
  onFluidChange: (fluid: DrainFluid) => void;
  /** Текущий класс новых сегментов */
  pipelineClass: PipelineClass;
  /** Изменить класс трубопровода */
  onPipelineClassChange: (pipelineClass: PipelineClass) => void;
};

const FLUID_ORDER: readonly DrainFluid[] = ['oil', 'gas', 'product'];

export function PipelineSettingsPanel({
  fluid,
  onFluidChange,
  pipelineClass,
  onPipelineClassChange,
}: PipelineSettingsPanelProps) {

  return (
    <div className="pipeline-settings" aria-label="Настройки трубопровода">
      {/* 1. Трубопроводы — выбор флюида (цвет линии) */}
      <div className="pipeline-settings__group">
        <span className="pipeline-settings__group-title">Трубопроводы</span>
        <div className="pipeline-settings__seg" role="radiogroup" aria-label="Тип флюида">
          {FLUID_ORDER.map((value) => {
            const active = value === fluid;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`pipeline-settings__seg-item${active ? ' is-active' : ''}`}
                onClick={() => onFluidChange(value)}
              >
                <span
                  className="pipeline-settings__seg-line"
                  style={{ background: getFluidColor(value) }}
                />
                <span className="pipeline-settings__seg-label">{FLUID_LABELS[value]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Класс трубопровода — стиль линии (толщина + пунктир) */}
      <div className="pipeline-settings__group">
        <span className="pipeline-settings__group-title">Класс трубопровода</span>
        <div className="pipeline-settings__classes" role="radiogroup" aria-label="Класс трубопровода">
          {PIPELINE_CLASS_ORDER.map((value) => {
            const active = value === pipelineClass;
            const style = getPipelineClassStyle(value);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`pipeline-settings__class${active ? ' is-active' : ''}`}
                onClick={() => onPipelineClassChange(value)}
              >
                <span className="pipeline-settings__class-sample" aria-hidden="true">
                  <span
                    className="pipeline-settings__class-line"
                    style={{
                      // Логический поток — тёмно-серый; прочие классы — цвет флюида.
                      borderTopColor: getEdgeColor(fluid, value),
                      borderTopWidth: style.width,
                      borderTopStyle: style.dash ? 'dashed' : 'solid',
                    }}
                  />
                </span>
                <span className="pipeline-settings__class-label">
                  {PIPELINE_CLASS_LABEL[value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
