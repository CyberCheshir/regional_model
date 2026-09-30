import type { ReactNode } from 'react';
import './ui.css';

export type FilterPill<T extends string> = {
  /** Подпись слева от значения (например «ЛУ») */
  label?: string;
  /** Отображаемый текст значения */
  value: string;
  /** Ключ состояния фильтра */
  key: T;
  /** Активен ли фильтр */
  active?: boolean;
  /** Клик по «пилюле» (опционально — иначе она неинтерактивна) */
  onToggle?: (key: T) => void;
};

export type FilterBarProps<T extends string> = {
  /** Набор фильтров-«пилюль» */
  pills: FilterPill<T>[];
  /** Заголовок полосы (по умолчанию «Фильтры») */
  title?: string;
  /** Разделить левую группу фильтров и правый слот (например, переключатель масштаба) */
  trailing?: ReactNode;
};

/**
 * Полоса фильтров: заголовок + набор переключаемых «пилюль».
 * Заменяет копипаст фильтров в вкладках «Предупреждения», «Рекомендации»,
 * «Сравнение сценариев» и «Дорожные карты».
 */
export function FilterBar<T extends string>({ pills, title = 'Фильтры', trailing }: FilterBarProps<T>) {
  const group = (
    <div className="ui-filterbar__group">
      {pills.map((pill) => {
        const text = pill.label ? `${pill.label}: ${pill.value}` : pill.value;
        const className = `ui-pill${pill.active ? ' ui-pill--active' : ''}${pill.onToggle ? '' : ' ui-pill--readonly'
          }`;

        return pill.onToggle ? (
          <button key={pill.key} type="button" className={className} onClick={() => pill.onToggle!(pill.key)}>
            {text}
          </button>
        ) : (
          <span key={pill.key} className={className}>
            {text}
          </span>
        );
      })}
    </div>
  );

  return (
    <nav className="ui-filterbar ui-filterbar--split" aria-label={title}>
      <span className="ui-filterbar__title">{title}</span>
      {group}
      {trailing}
    </nav>
  );
}
