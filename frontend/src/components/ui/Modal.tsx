import { useEffect, type ReactNode } from 'react';
import './ui.css';

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Содержимое тела модального окна */
  children: ReactNode;
  /** Кнопки в подвале (обычно «Отмена» + «Подтвердить») */
  footer?: ReactNode;
  /** Закрывать по клику по подложке */
  closeOnOverlay?: boolean;
  /** Закрывать по Escape */
  closeOnEscape?: boolean;
};

/**
 * Базовое модальное окно: подложка, шапка с крестиком, тело и подвал.
 * Общее для «Выгрузить результаты» и других диалогов аналитики.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  closeOnOverlay = true,
  closeOnEscape = true,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div
      className="ui-modal__overlay"
      onClick={closeOnOverlay ? onClose : undefined}
      role="presentation"
    >
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ui-modal__header">
          <h3 className="ui-modal__title">{title}</h3>
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="ui-modal__body">{children}</div>

        {footer && <div className="ui-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
