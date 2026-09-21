import './SelectionActionsBar.css';

export type SelectionActionsBarProps = {
  /** Количество выделенных сегментов (рёбер) */
  segmentCount: number;
  /** Объединить выделенные сегменты в один трубопровод */
  onMergeIntoPipeline: () => void;
};

/** Склонение слова «сегмент» по числу. */
function segmentWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сегмент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сегмента';
  return 'сегментов';
}

/**
 * Контекстная панель над картой (в верхней части рабочей области): появляется
 * при выделении сегментов и позволяет объединить их в один трубопровод.
 */
export function SelectionActionsBar({
  segmentCount,
  onMergeIntoPipeline,
}: SelectionActionsBarProps) {
  if (segmentCount === 0) return null;
  return (
    <div className="selection-actions" role="toolbar" aria-label="Действия с выделением">
      <span className="selection-actions__count">
        Выбрано: {segmentCount} {segmentWord(segmentCount)}
      </span>
      <button
        type="button"
        className="selection-actions__button"
        onClick={onMergeIntoPipeline}
      >
        Объединить в трубопровод
      </button>
    </div>
  );
}
