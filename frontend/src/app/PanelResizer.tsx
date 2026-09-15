import type { PointerEvent as ReactPointerEvent } from 'react';
import { PANEL_WIDTH_LIMITS, SHELL_COLUMNS, clampWidth } from './panelWidth';
import './PanelResizer.css';

type PanelResizerProps = {
  /** Какая панель примыкает к разделителю: left растёт вправо, right — влево */
  side: 'left' | 'right';
  startWidth: number;
  onWidthChange: (width: number) => void;
};

/**
 * Разделитель (sash) для изменения ширины панели перетаскиванием.
 *
 * Pointer Events + setPointerCapture: единая логика для мыши и тача,
 * захват курсора не теряется при выходе за пределы элемента.
 * Слушатели добавляются на pointerdown и снимаются по завершении —
 * компонент остаётся stateless, рендеры идут только через width-state.
 * Двойной клик сбрасывает ширину к дефолту макета.
 */
export function PanelResizer({ side, startWidth, onWidthChange }: PanelResizerProps) {
  const sign = side === 'left' ? 1 : -1;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    target.dataset.dragging = 'true';

    const minWidth = side === 'left' ? PANEL_WIDTH_LIMITS.leftMin : PANEL_WIDTH_LIMITS.min;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) * sign;
      onWidthChange(clampWidth(startWidth + delta, minWidth));
    };
    const handleFinish = (finishEvent: PointerEvent) => {
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handleFinish);
      target.removeEventListener('pointercancel', handleFinish);
      delete target.dataset.dragging;
      target.releasePointerCapture(finishEvent.pointerId);
    };

    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handleFinish);
    target.addEventListener('pointercancel', handleFinish);
  };

  return (
    <div
      className={`panel-resizer panel-resizer--${side}`}
      role="separator"
      aria-orientation="vertical"
      title="Потяните для изменения ширины · Двойной клик — сброс"
      onPointerDown={handlePointerDown}
      onDoubleClick={() =>
        onWidthChange(clampWidth(SHELL_COLUMNS[side], side === 'left' ? PANEL_WIDTH_LIMITS.leftMin : PANEL_WIDTH_LIMITS.min))
      }
    />
  );
}
