import { useLayoutEffect, useState } from 'react';
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

/** Селектор левой панели (sidebar) в AppShell. */
const SIDEBAR_SELECTOR = '.app-shell__left';
/** Зазор между правым краем sidebar и окном диаграммы. */
const SIDEBAR_GAP_PX = 16;

/**
 * Измеряет фактическое положение sidebar в DOM и возвращает px отступ окна
 * от левого края окна браузера (правый край sidebar + зазор).
 * Реагирует на изменение размера панели через ResizeObserver — при
 * растягивании sidebar окно сдвигается и не наслаивается на панель.
 * Если панель не найдена (свёрнута/оверлей) — null (используется CSS-дефолт).
 */
function useSidebarAwareLeft(): number | null {
  const [left, setLeft] = useState<number | null>(null);

  useLayoutEffect(() => {
    // Текущий наблюдаемый элемент: при смене (появление/удаление sidebar)
    // переподключаем наблюдатель к новому элементу.
    let observed: Element | null = null;

    const measure = () => {
      const sidebar = document.querySelector(SIDEBAR_SELECTOR);
      if (!sidebar) {
        observed = null;
        setLeft(null);
        return;
      }
      // Наблюдаем именно за панелью: её ресайз (растягивание разделителем)
      // меняет bounding rect — окно сдвигается вместе с краем панели.
      if (observer && sidebar !== observed) {
        if (observed) observer.unobserve(observed);
        observer.observe(sidebar);
        observed = sidebar;
      }
      setLeft(sidebar.getBoundingClientRect().right + SIDEBAR_GAP_PX);
    };

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;

    measure();
    // Появление/исчезновение панели (сворачивание, смена модуля) не меняет
    // размер body в оверлей-раскладке — отслеживаем мутации DOM.
    const mutation =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(measure)
        : null;
    mutation?.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutation?.disconnect();
      observed = null;
    };
  }, []);

  return left;
}

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
  const sidebarAwareLeft = useSidebarAwareLeft();

  if (!isOpen) return null;

  const patch = (part: Partial<DiagramConfig>) => onChange({ ...config, ...part });

  return (
    <section
      className="diagram-modal"
      style={sidebarAwareLeft !== null ? { left: sidebarAwareLeft } : undefined}
      role="dialog"
      aria-modal="false"
      aria-label={`Диаграмма на карте — ${entityName}`}
    >
      <header className="diagram-modal__header">
        <div className="diagram-modal__heading">
          <h2 className="diagram-modal__title">Диаграмма на карте</h2>
          {entityName && (
            <span className="diagram-modal__entity">{entityName}</span>
          )}
        </div>
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
        <div className="diagram-modal__section">
          <h3 className="diagram-modal__section-title">Добыча продукции</h3>
          <FluidSegmentedControl value={config.fluid} onChange={(fluid) => patch({ fluid })} />
        </div>
        <div className="diagram-modal__section">
          <h3 className="diagram-modal__section-title">Период диаграммы</h3>
          <PeriodRadioGroup
            value={config.periodMode}
            customRange={config.customRange}
            onChange={(periodMode) => patch({ periodMode })}
            onCustomRangeChange={(customRange) => patch({ customRange })}
          />
        </div>
        <div className="diagram-modal__section">
          <h3 className="diagram-modal__section-title">Продукция</h3>
          <PlacementDropdown
            value={config.placement}
            onChange={(placement) => patch({ placement })}
          />
        </div>
      </div>
    </section>
  );
}
