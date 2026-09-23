import { type DrainFluid, type PipelineClass } from '../map/drawingTypes';
import { PipelineDropdown } from './PipelineDropdown';

/**
 * Панель настройки трубопровода в разделе «Проектирование».
 *
 * Перед рисованием задаются две независимые характеристики:
 *   1. Флюид (цвет линии)      — Нефть / Газ / Продукт;
 *   2. Класс трубопровода (стиль: толщина + пунктир) — Промысловый /
 *      Межпромысловый / Магистральный (для выбранного флюида).
 *
 * UI — карточка «Трубопровод»: клик по основной части выбирает инструмент
 * и показывает текущий выбор, мелкая кнопка-стрелка раскрывает список.
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
  /** Клик по карточке — выбрать инструмент «Трубопровод» */
  onSelectTool?: () => void;
  /** Кнопка «Применить» — включить инструмент «Трубопровод» безусловно */
  onApplyTool?: () => void;
  /** Инструмент «Трубопровод» активен */
  active?: boolean;
};

export function PipelineSettingsPanel({
  fluid,
  onFluidChange,
  pipelineClass,
  onPipelineClassChange,
  onSelectTool,
  onApplyTool,
  active = false,
}: PipelineSettingsPanelProps) {
  return (
    <PipelineDropdown
      fluid={fluid}
      onFluidChange={onFluidChange}
      pipelineClass={pipelineClass}
      onPipelineClassChange={onPipelineClassChange}
      onSelectTool={onSelectTool}
      onApplyTool={onApplyTool}
      active={active}
    />
  );
}
