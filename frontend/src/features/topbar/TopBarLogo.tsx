export type TopBarLogoProps = {
  /** Куда ведёт клик по логотипу (по умолчанию — не ссылка) */
  href?: string;
};

/** Логотип-аббревиатура приложения в верхней панели. */
export function TopBarLogo({ href }: TopBarLogoProps) {
  if (href) {
    return (
      <a className="topbar__logo" href={href}>
        ПДИМ
      </a>
    );
  }
  return <span className="topbar__logo">ПДИМ</span>;
}
