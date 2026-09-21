import { useEffect, useRef, useState } from 'react';
import type { EntityDetails } from './types';
import './InspectorSections.css';

/**
 * Секция «ОБЩИЕ ПАРАМЕТРЫ»: строки PropertyRow label — value.
 * Строка «Наименование» РЕДАКТИРУЕМА: клик по значению (или кнопка-карандаш)
 * открывает inline-поле; Enter/blur — сохранить, Escape — отмена.
 */
export function SectionGeneralParams({
  entity,
  onRename,
}: {
  entity: EntityDetails;
  /** Переименовать объект (пустое/неизменённое имя не передаётся) */
  onRename?: (nextLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Смена объекта (или его имени извне) — сбрасываем черновик и выходим из правки.
  useEffect(() => {
    setEditing(false);
    setDraft(entity.label);
  }, [entity.id, entity.label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (!onRename) return;
    setDraft(entity.label);
    setEditing(true);
  };

  const commit = (save: boolean) => {
    setEditing(false);
    if (!save) return;
    const next = draft.trim();
    if (!next || next === entity.label) return;
    onRename?.(next);
  };

  return (
    <section className="inspector-section">
      <h3 className="inspector-section__title">Общие параметры</h3>
      <dl className="property-list">
        <div className="property-row">
          <dt className="property-row__label">Наименование</dt>
          <dd className="property-row__value">
            {editing ? (
              <input
                ref={inputRef}
                className="property-row__input"
                type="text"
                value={draft}
                spellCheck={false}
                aria-label={`Переименовать «${entity.label}»`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(true);
                  else if (e.key === 'Escape') commit(false);
                }}
                onBlur={() => commit(true)}
              />
            ) : onRename ? (
              <button
                type="button"
                className="property-row__edit"
                title="Изменить наименование"
                onClick={startEdit}
              >
                <span className="property-row__edit-text">{entity.label}</span>
                <span className="property-row__edit-pencil" aria-hidden="true">
                  ✎
                </span>
              </button>
            ) : (
              entity.label
            )}
          </dd>
        </div>
        <div className="property-row">
          <dt className="property-row__label">Тип объекта</dt>
          <dd className="property-row__value">{entity.subType ?? entity.kind}</dd>
        </div>
        <div className="property-row">
          <dt className="property-row__label">Лицензионный участок</dt>
          <dd className="property-row__value">{entity.licenseArea}</dd>
        </div>
        <div className="property-row">
          <dt className="property-row__label">Владелец</dt>
          <dd className="property-row__value">{entity.owner}</dd>
        </div>
      </dl>
    </section>
  );
}

/** Секция «СОСТОЯНИЕ МОДЕЛИ»: чекмарки валидации. */
export function SectionModelStatus({ entity }: { entity: EntityDetails }) {
  return (
    <section className="inspector-section">
      <h3 className="inspector-section__title">Состояние модели</h3>
      <ul className="validation-list">
        {entity.modelStatus.map((item) => (
          <li className="validation-item" key={item.label}>
            <span className="validation-item__check" aria-hidden="true">
              ✓
            </span>
            <span className="validation-item__label">{item.label}</span>
            <span className="validation-item__value">{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
