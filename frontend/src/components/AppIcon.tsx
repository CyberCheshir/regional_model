import { ICON_REGISTRY, type IconName } from './IconRegistry';

export type { IconName } from './IconRegistry';

export type AppIconProps = {
  /** Имя иконки из реестра (design description/icons.md) */
  name: IconName;
  /** Размер в px (по умолчанию — из зоны использования) */
  size?: number;
  /** Цвет (CSS-переменная или значение) */
  color?: string;
  /** Зеркалить иконку по горизонтали (для правых панелей) */
  flipped?: boolean;
  className?: string;
  title?: string;
};

/**
 * Единый компонент иконок на inline SVG (design description/icons.md §2).
 * Контролируемая иконка: не хранит состояние, размеры и цвет задаются props.
 */
export function AppIcon({
  name,
  size = 16,
  color = 'currentColor',
  flipped = false,
  className,
  title,
}: AppIconProps) {
  const def = ICON_REGISTRY[name];
  if (!def) {
    return null;
  }

  return (
    <svg
      className={className}
      style={flipped ? { transform: 'scaleX(-1)' } : undefined}
      width={size}
      height={size}
      viewBox={def.viewBox}
      fill={def.fill ? color : 'none'}
      stroke={def.stroke ? color : 'none'}
      strokeWidth={def.stroke ? (def.strokeWidth ?? 1.5) : undefined}
      strokeDasharray={def.dasharray}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{
        __html: (title ? `<title>${title}</title>` : '') + def.paths,
      }}
    />
  );
}
