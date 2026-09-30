import type { CriticalityLevel } from '../../domain/types';
import './ui.css';

export type CriticalityDotProps = {
  level: CriticalityLevel;
  /** Увеличенный размер (для легенд и графиков) */
  large?: boolean;
  title?: string;
};

/**
 * Точечный индикатор критичности. Цвет берётся из CSS-класса уровня
 * (см. ui.css `.ui-tone-*`), поэтому единая палитра живёт в одном месте.
 */
export function CriticalityDot({ level, large, title }: CriticalityDotProps) {
  return (
    <span
      className={`ui-dot ui-tone-${level}${large ? ' ui-dot--lg' : ''}`}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}
