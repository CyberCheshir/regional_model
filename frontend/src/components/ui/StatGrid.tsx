import type { ReactNode } from 'react';
import './ui.css';

export type StatItem = {
  /** Ключ для React и семантика тона */
  key: string;
  /** Подпись показателя */
  label: string;
  /** Значение (строка или число) */
  value: ReactNode;
  /** Дополнительный поясняющий текст */
  sub?: ReactNode;
  /** Тон значения: critical/high/medium/low/primary/accent */
  tone?: string;
  /** Размер значения */
  size?: 'sm' | 'md' | 'lg' | 'text';
};

export type StatGridProps = {
  items: StatItem[];
  /** Вариант сетки: 4 (по умолчанию), 5, 6 или 7 колонок */
  columns?: 4 | 5 | 6 | 7;
  /** Плоский стиль плитки (для KPI-строк с мелкой подписью) */
  flat?: boolean;
  /** Пояснение под значением отдельной строкой (иначе — рядом со значением) */
  stackSub?: boolean;
  /** aria-label для группы */
  ariaLabel?: string;
};

const COLUMNS_CLASS: Record<NonNullable<StatGridProps['columns']>, string> = {
  4: '',
  5: 'ui-stats--wide',
  6: 'ui-stats--6',
  7: 'ui-stats--7',
};

const SIZE_CLASS = {
  sm: 'ui-stat__value--md',
  md: '',
  lg: 'ui-stat__value--lg',
  text: 'ui-stat__value--text',
} as const;

/** Сетка статистических плиток (KPI, сводки, счётчики критичности). */
export function StatGrid({ items, columns = 4, flat, stackSub, ariaLabel }: StatGridProps) {
  return (
    <div className={`ui-stats ${COLUMNS_CLASS[columns]}`} role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const value = (
          <span className={`ui-stat__value ${SIZE_CLASS[item.size ?? 'md']}${item.tone ? ` ${item.tone}` : ''}`}>
            {item.value}
          </span>
        );
        const sub = item.sub ? <span className="ui-stat__sub">{item.sub}</span> : null;

        return (
          <div key={item.key} className={`ui-stat${flat ? ' ui-stat--flat' : ''}`}>
            <span className="ui-stat__label">{item.label}</span>
            {stackSub ? (
              <>
                {value}
                {sub}
              </>
            ) : (
              <div className="ui-stat__row">
                {value}
                {sub}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
