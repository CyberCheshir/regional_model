import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PANEL_WIDTH_LIMITS, SHELL_COLUMNS, clampWidth } from './panelWidth';
import { PanelResizer } from './PanelResizer';
import { PanelRestoreBar } from './PanelRestoreBar';
import './AppShell.css';

export { PANEL_WIDTH_LIMITS, SHELL_COLUMNS } from './panelWidth';

/** Базовая ширина Activity Bar (совпадает с SHELL_COLUMNS.activity). */
const ACTIVITY_WIDTH_PX = SHELL_COLUMNS.activity;

export type AppShellProps = {
  /** Слот Activity Bar (56px) */
  activity: ReactNode;
  /** Слот левой панели (340px) */
  left: ReactNode;
  /** Слот центральной карты (1fr) */
  center: ReactNode;
  /** Слот правого инспектора (380px) */
  right: ReactNode;
  /** Необязательный слот нижней панели (например, «Демонстрируемый период») */
  bottom?: ReactNode;
  /** Текущая ширина левой панели (контролируемая, при expanded) */
  leftWidth?: number;
  /** Текущая ширина правой панели (контролируемая, при expanded) */
  rightWidth?: number;
  /** Изменение ширины левой панели пользователем */
  onLeftWidthChange?: (width: number) => void;
  /** Изменение ширины правой панели пользователем */
  onRightWidthChange?: (width: number) => void;
  /** Свернуть левую панель */
  leftCollapsed?: boolean;
  /** Свернуть правую панель */
  rightCollapsed?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
};

/** Высота зон по умолчанию для CSS-переменной, пока панель не измерена. */
const BOTTOM_PANEL_FALLBACK_HEIGHT = 96;

/**
 * Каркас лейаута: 4 колонки Activity Bar / Sidebar / Map / Inspector.
 * Ширина боковых панелей меняется перетаскиванием разделителя (sash);
 * двойной клик по разделителю сбрасывает ширину к дефолтной.
 */
export function AppShell({
  activity,
  left,
  center,
  right,
  bottom,
  leftWidth = SHELL_COLUMNS.left,
  rightWidth = SHELL_COLUMNS.right,
  onLeftWidthChange,
  onRightWidthChange,
  leftCollapsed = false,
  rightCollapsed = false,
  onToggleLeft,
  onToggleRight,
}: AppShellProps) {
  const leftExpanded = !leftCollapsed;
  const rightExpanded = !rightCollapsed;
  const hasLeftResizer = leftExpanded && onLeftWidthChange !== undefined;
  const hasRightResizer = rightExpanded && onRightWidthChange !== undefined;

  // Нижняя панель лежит в собственном ряду: её высота и боковые края
  // прокидываются в CSS-переменные, чтобы зоны выше не заезжали под неё.
  const bottomRef = useRef<HTMLDivElement>(null);
  const [bottomHeight, setBottomHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!bottom) {
      setBottomHeight(null);
      return;
    }
    const node = bottomRef.current;
    if (!node) return;
    const measure = () => setBottomHeight(node.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [bottom]);

  const leftWidthPx = leftExpanded ? clampWidth(leftWidth, PANEL_WIDTH_LIMITS.leftMin) : 0;
  const rightWidthPx = rightExpanded ? clampWidth(rightWidth) : 0;

  // Раскладка оверлеями: карта занимает ВЕСЬ экран (слой 0, не меняется при
  // ресайзе панелей), а панели лежат ПОВЕРХ неё (слой 1). Поэтому перетаскивание
  // разделителей не трогает canvas графа и не вызывает перерисовку/масштаб.
  const leftPanelStyle: CSSProperties = { left: ACTIVITY_WIDTH_PX, width: leftWidthPx };
  const leftResizerStyle: CSSProperties = { left: ACTIVITY_WIDTH_PX + leftWidthPx };
  const rightResizerStyle: CSSProperties = { right: rightWidthPx };
  // Правая панель привязана к правому краю (right: 0), ширина — переменная
  const rightPanelStyle: CSSProperties = { right: 0, width: rightWidthPx };

  // Нижняя панель занимает во всю ширину отдельный ряд в самом низу,
  // поэтому зонам выше достаточно знать только её высоту.
  const shellStyle = {
    '--shell-bottom-height': `${bottomHeight ?? BOTTOM_PANEL_FALLBACK_HEIGHT}px`,
  } as CSSProperties;

  return (
    <div className="app-shell" style={shellStyle}>
      {/* Слой 0: карта на весь экран (фиксированный размер контейнера) */}
      <main className="app-shell__map">{center}</main>

      {/* Слой 1: панели поверх карты */}
      <aside className="app-shell__activity">{activity}</aside>

      {leftCollapsed ? (
        <PanelRestoreBar
          side="left"
          label="Показать панель управления элементами"
          onRestore={() => onToggleLeft?.()}
        />
      ) : (
        <aside className="app-shell__left" style={leftPanelStyle}>
          <div className="shell-panel shell-panel--left">{left}</div>
        </aside>
      )}

      {hasLeftResizer && (
        <div className="app-shell__left-resizer" style={leftResizerStyle}>
          <PanelResizer
            side="left"
            startWidth={startWidthOr(leftWidth, SHELL_COLUMNS.left)}
            onWidthChange={onLeftWidthChange}
          />
        </div>
      )}

      {hasRightResizer && (
        <div className="app-shell__right-resizer" style={rightResizerStyle}>
          <PanelResizer
            side="right"
            startWidth={startWidthOr(rightWidth, SHELL_COLUMNS.right)}
            onWidthChange={onRightWidthChange}
          />
        </div>
      )}

      {rightCollapsed ? (
        <PanelRestoreBar
          side="right"
          label="Показать инспектор объекта"
          onRestore={() => onToggleRight?.()}
        />
      ) : (
        <aside className="app-shell__right" style={rightPanelStyle}>
          <div className="shell-panel shell-panel--right">{right}</div>
        </aside>
      )}

      {/* Слой 2: нижняя панель — отдельный ряд в самом низу рабочей области */}
      {bottom ? (
        <div className="app-shell__bottom" ref={bottomRef}>
          {bottom}
        </div>
      ) : null}
    </div>
  );
}

/** Ширина панели для расчёта drag: число или дефолт макета. */
function startWidthOr(width: number | undefined, fallback: number): number {
  return width ?? fallback;
}
