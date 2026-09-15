import type { DiagramConfig } from './types';
import { FluidSegmentedControl } from './FluidSegmentedControl';
import { PeriodRadioGroup } from './PeriodRadioGroup';
import { PlacementDropdown } from './PlacementDropdown';
import { AppIcon } from '../../components/AppIcon';
import './MapDiagramModal.css';

export type MapDiagramModalProps = {
  /** Открыто ли окно (components.md §3.1 diagramModalState.isOpen) */
  isOpen: boolean;
  /** Имя объекта, для которого открывается диаграмма */
  entityName: string;
  /** Конфигурация диаграммы (fluid / periodMode / customRange / placement) */
  config: DiagramConfig;
  /** Изменение конфигурации */
  onChange: (config: DiagramConfig) => void;
  /** Закрытие окна */
  onClose: () => void;
};

/**
 * Плавающее окно «Диаграмма на карте» (Этап 7).
 * Открывается из дерева по кнопке диаграммы (`open-diagram`),
 * конфигурируется через FluidSegmentedControl / PeriodRadioGroup / PlacementDropdown.
 */
export function MapDiagramModal({
  isOpen,
  entityName,
  config,
  onChange,
  onClose,
}: MapDiagramModalProps) {
  if (!isOpen) return null;

  const patch = (part: Partial<DiagramConfig>) => onChange({ ...config, ...part });

  return (
    <section
      className="diagram-modal"
      role="dialog"
      aria-modal="false"
      aria-label={`Диаграмма на карте — ${entityName}`}
    >
      <header className="diagram-modal__header">
        <h2 className="diagram-modal__title">
          Диаграмма на карте <span className="diagram-modal__entity">· {entityName}</span>
        </h2>
        <button
          type="button"
          className="diagram-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
          title="Закрыть"
        >
          <AppIcon name="close" size={16} />
        </button>
      </header>

      <div className="diagram-modal__body">
        <div className="diagram-modal__row">
          <FluidSegmentedControl value={config.fluid} onChange={(fluid) => patch({ fluid })} />
        </div>
        <div className="diagram-modal__row">
          <PeriodRadioGroup
            value={config.periodMode}
            customRange={config.customRange}
            onChange={(periodMode) => patch({ periodMode })}
            onCustomRangeChange={(customRange) => patch({ customRange })}
          />
        </div>
        <div className="diagram-modal__row">
          <PlacementDropdown
            value={config.placement}
            onChange={(placement) => patch({ placement })}
          />
        </div>
      </div>
    </section>
  );
}
