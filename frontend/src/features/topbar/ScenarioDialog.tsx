import { useEffect, useRef, useState } from 'react';
import './ScenarioDialog.css';

export type ScenarioDialogProps = {
  /** Открыт ли диалог */
  open: boolean;
  /** Начальное имя (например, имя текущего сценария) */
  initialName?: string;
  /** Подтвердить сохранение под указанным именем */
  onConfirm: (name: string) => void;
  /** Отмена */
  onCancel: () => void;
};

/**
 * Модальный диалог ввода имени сценария при сохранении проекта.
 * Простое окно с полем и кнопками «Сохранить» / «Отмена».
 */
export function ScenarioDialog({ open, initialName = '', onConfirm, onCancel }: ScenarioDialogProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  // При открытии — подставить начальное имя и поставить фокус.
  useEffect(() => {
    if (open) {
      setName(initialName);
      // Фокус после отрисовки.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialName]);

  if (!open) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="scenario-dialog__backdrop" onPointerDown={onCancel}>
      <div
        className="scenario-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Сохранение сценария"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="scenario-dialog__title">Сохранить сценарий</p>
        <label className="scenario-dialog__field">
          <span>Название проекта</span>
          <input
            ref={inputRef}
            className="scenario-dialog__input"
            value={name}
            placeholder="Например: Восточная Сибирь"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
            }}
          />
        </label>
        <div className="scenario-dialog__actions">
          <button type="button" className="scenario-dialog__btn" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="scenario-dialog__btn scenario-dialog__btn--primary"
            onClick={submit}
            disabled={name.trim().length === 0}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
