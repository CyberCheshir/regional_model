import type { ReactNode } from 'react';
import './ui.css';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** Значение ячейки; undefined — пустая ячейка */
  cell: (row: T) => ReactNode;
  /** Числовая ячейка (моноширинные цифры) */
  numeric?: boolean;
  /** CSS-класс ячейки (например ui-table__elem) */
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Идентификатор выбранной строки (подсветка) */
  selectedId?: string;
  onSelect?: (row: T) => void;
  ariaLabel?: string;
  /** Отступ снизу (по умолчанию 20px как в карточках аналитики) */
  wrapClassName?: string;
};

/**
 * Таблица данных общего назначения: заголовки, строки, выделение,
 * клик по строке. Заменяет почти идентичную разметку <table> в четырёх вкладках.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  selectedId,
  onSelect,
  ariaLabel,
  wrapClassName = 'ui-table-wrap',
}: DataTableProps<T>) {
  const clickable = Boolean(onSelect);

  return (
    <div className={wrapClassName}>
      <table className={`ui-table${clickable ? ' ui-table--clickable' : ''}`} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            const isSelected = selectedId === id;
            return (
              <tr
                key={id}
                className={isSelected ? 'is-selected' : undefined}
                onClick={onSelect ? () => onSelect(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.numeric ? 'ui-table__num' : col.className}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
