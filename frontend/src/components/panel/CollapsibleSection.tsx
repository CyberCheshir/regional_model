import { useId, useState, type ReactNode } from 'react';
import { AppIcon } from '../AppIcon';
import './CollapsibleSection.css';

export type CollapsibleSectionProps = {
  /** Заголовок секции (eyebrow) */
  title: string;
  /** Сжимое секции; скрывается при сворачивании */
  children: ReactNode;
  /** Начальное состояние (по умолчанию раскрыта) */
  defaultOpen?: boolean;
  /** Дополнительные классы обёртки */
  className?: string;
};

/**
 * Сворачиваемая секция панели: кликабельный заголовок со шевроном и контент.
 * Контролирует видимость сам (uncontrolled) — секции в LeftSidebar независимы.
 * Доступность: заголовок-кнопка с aria-expanded и aria-controls.
 */
export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={`collapsible-section${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="collapsible-section__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        title={open ? `Свернуть «${title}»` : `Развернуть «${title}»`}
      >
        <AppIcon
          name="chevron"
          size={12}
          className={`collapsible-section__chevron${open ? ' is-open' : ''}`}
        />
        <span className="collapsible-section__title">{title}</span>
      </button>
      {open && (
        <div className="collapsible-section__content" id={contentId}>
          {children}
        </div>
      )}
    </section>
  );
}
