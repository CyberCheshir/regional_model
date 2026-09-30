import type { ReactNode } from 'react';
import './ui.css';

export type PropItem = {
  key: string;
  label: string;
  value: ReactNode;
};

export type PropListProps = {
  items: PropItem[];
  /** Раскладка: колонка (по умолчанию) или сетка в две колонки */
  layout?: 'column' | 'grid';
  /** Блок с подложкой (панель свойств) */
  panel?: boolean;
};

/**
 * Список свойств «подпись — значение». Заменяет копипаст блоков
 * `__prop-block / __prop-label / __prop-val` в карточках вкладок.
 */
export function PropList({ items, layout = 'column', panel }: PropListProps) {
  // Панель свойств всегда вертикальная (подпись над значением),
  // grid-раскладка — для компактных строк «подпись: значение».
  const rowLayout = !panel && layout === 'grid';

  const body = items.map((item) => (
    <div
      key={item.key}
      className={`ui-prop${rowLayout ? ' ui-prop--row' : ''}${panel ? ' ui-props-panel__item' : ''}`}
    >
      <span className={`ui-prop__label${rowLayout ? ' ui-prop__label--plain' : ''}`}>
        {item.label}
      </span>
      <span className={`ui-prop__value${rowLayout ? ' ui-prop__value--sm' : ''}`}>
        {item.value}
      </span>
    </div>
  ));

  if (panel) return <div className="ui-props-panel">{body}</div>;

  return <div className={`ui-props${rowLayout ? ' ui-props--grid' : ''}`}>{body}</div>;
}
