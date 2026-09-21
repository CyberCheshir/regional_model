/**
 * Вкладка «Общие параметры»: идентификация объекта, состояние модели (готовность)
 * и связи (входящие/исходящие потоки — кликабельные ссылки на объекты).
 */
import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { EntityDetails, ParameterPanelData } from '../../domain/types';
import { ChecklistRow, PanelSection, PropertyRow } from './parts';

export function GeneralTab({
  data,
  onRename,
  onNavigateToRelation,
}: {
  data: ParameterPanelData;
  onRename?: (nextLabel: string) => void;
  onNavigateToRelation: (id: string) => void;
}) {
  const { entity } = data;
  return (
    <>
      <SectionIdentification entity={entity} onRename={onRename} />
      <PanelSection title="Состояние модели">
        {entity.modelStatus.length === 0 ? (
          <p className="pp-muted">Состояние модели не задано.</p>
        ) : (
          entity.modelStatus.map((item) => (
            <ChecklistRow
              key={item.label}
              level={item.ok ? 'ok' : 'none'}
              label={item.label}
              value={item.value}
            />
          ))
        )}
      </PanelSection>
      <SectionConnections entity={entity} onNavigateToRelation={onNavigateToRelation} />
    </>
  );
}

/* ---------------------------------------------------------------- */

/** Идентификация: редактируемое наименование, тип, ЛУ, владелец. */
function SectionIdentification({
  entity,
  onRename,
}: {
  entity: EntityDetails;
  onRename?: (nextLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity.label);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const commit = (save: boolean) => {
    setEditing(false);
    if (!save) return;
    const next = draft.trim();
    if (!next || next === entity.label) return;
    onRename?.(next);
  };

  return (
    <PanelSection title="Идентификация">
      <PropertyRow label="Наименование">
        {editing ? (
          <input
            ref={inputRef}
            className="pp-input"
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
            className="pp-edit"
            title="Изменить наименование"
            onClick={() => {
              setDraft(entity.label);
              setEditing(true);
            }}
          >
            <span className="pp-edit__text">{entity.label}</span>
            <span className="pp-edit__pencil" aria-hidden="true">
              <AppIcon name="pencil" size={13} />
            </span>
          </button>
        ) : (
          entity.label
        )}
      </PropertyRow>
      <PropertyRow label="Тип объекта">{entity.subType ?? entity.kind}</PropertyRow>
      <PropertyRow label="Лицензионный участок">{entity.licenseArea}</PropertyRow>
      <PropertyRow label="Владелец">{entity.owner}</PropertyRow>
    </PanelSection>
  );
}

/** Связи: входящие и исходящие потоки (кликабельные ссылки на объекты). */
function SectionConnections({
  entity,
  onNavigateToRelation,
}: {
  entity: EntityDetails;
  onNavigateToRelation: (id: string) => void;
}) {
  const empty = entity.incoming.length === 0 && entity.outgoing.length === 0;
  return (
    <PanelSection title="Связи">
      {empty ? (
        <p className="pp-muted">У объекта нет связей.</p>
      ) : (
        <>
          <FlowGroup
            title="Исходящие потоки"
            items={entity.outgoing}
            emptyText="Нет исходящих потоков"
            onNavigateToRelation={onNavigateToRelation}
          />
          <FlowGroup
            title="Входящие потоки"
            items={entity.incoming}
            emptyText="Для объекта добычи входящие связи не используются"
            onNavigateToRelation={onNavigateToRelation}
          />
        </>
      )}
    </PanelSection>
  );
}

function FlowGroup({
  title,
  items,
  emptyText,
  onNavigateToRelation,
}: {
  title: string;
  items: EntityDetails['outgoing'];
  emptyText: string;
  onNavigateToRelation: (id: string) => void;
}) {
  return (
    <div className="pp-flow-group">
      <h4 className="pp-flow-group__title">{title}</h4>
      {items.length === 0 ? (
        <p className="pp-muted pp-muted--sm">{emptyText}</p>
      ) : (
        items.map((c) => (
          <button
            key={c.id}
            type="button"
            className="pp-link"
            onClick={() => onNavigateToRelation(c.id)}
            title={`Перейти к «${c.targetLabel}»`}
          >
            <span className="pp-link__text">{c.targetLabel}</span>
            {c.isLogicalFlow && (
              <span className="pp-link__badge">Передача флюида без физического трубопровода</span>
            )}
            <AppIcon name="chevron-right" size={13} />
          </button>
        ))
      )}
    </div>
  );
}
