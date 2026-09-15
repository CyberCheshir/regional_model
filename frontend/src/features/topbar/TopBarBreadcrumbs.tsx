export type TopBarCrumb = {
  label: string;
  /** Если задан — крошка рендерится ссылкой; последняя крошка обычно без href */
  href?: string;
};

export type TopBarBreadcrumbsProps = {
  items: readonly TopBarCrumb[];
};

/** Хлебные крошки верхней панели: «Восточная Сибирь › Региональный модуль». */
export function TopBarBreadcrumbs({ items }: TopBarBreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav className="topbar__crumbs" aria-label="Хлебные крошки">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const className = `topbar__crumb${isLast ? ' topbar__crumb--current' : ''}`;
        return item.href && !isLast ? (
          <a key={`${item.label}-${index}`} className={className} href={item.href}>
            {item.label}
          </a>
        ) : (
          <span
            key={`${item.label}-${index}`}
            className={className}
            aria-current={isLast ? 'page' : undefined}
          >
            {item.label}
          </span>
        );
      })}
    </nav>
  );
}
