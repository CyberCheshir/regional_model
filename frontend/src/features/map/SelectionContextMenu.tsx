import './SelectionContextMenu.css';

export function SelectionContextMenu({
  segmentCount,
  areaLocked,
  x,
  y,
  onMerge,
  onToggleAreaLock,
}: {
  segmentCount: number;
  areaLocked?: boolean;
  x: number;
  y: number;
  onMerge: () => void;
  onToggleAreaLock?: () => void;
}) {
  if (segmentCount === 0 && onToggleAreaLock === undefined) return null;

  return (
    <div
      className="selection-context-menu"
      role="menu"
      aria-label="Действия с выделенными элементами"
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="selection-context-menu__count">
        {onToggleAreaLock ? 'Лицензионный участок' : `Выбрано: ${segmentCount} элементов`}
      </span>
      {onToggleAreaLock ? (
        <button type="button" className="selection-context-menu__button" onClick={onToggleAreaLock}>
          {areaLocked ? 'Разблокировать' : 'Зафиксировать'}
        </button>
      ) : (
        <button type="button" className="selection-context-menu__button" onClick={onMerge}>
          Объединить
        </button>
      )}
    </div>
  );
}
