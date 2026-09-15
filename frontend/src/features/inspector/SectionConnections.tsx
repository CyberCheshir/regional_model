import type { EntityDetails } from './types';
import './SectionConnections.css';

export type SectionConnectionsProps = {
  entity: EntityDetails;
  /** Переход к связанному объекту (navigate-to-relation) */
  onNavigateToRelation: (id: string) => void;
};

/**
 * Секция «СВЯЗИ»: группы исходящих/входящих потоков.
 * Логические потоки без физической трубы помечены бейджем.
 */
export function SectionConnections({ entity, onNavigateToRelation }: SectionConnectionsProps) {
  const hasAny = entity.incoming.length > 0 || entity.outgoing.length > 0;
  if (!hasAny) {
    return (
      <section className="inspector-section">
        <h3 className="inspector-section__title">Связи</h3>
        <p className="connections-empty">У объекта нет связей</p>
      </section>
    );
  }
  return (
    <section className="inspector-section">
      <h3 className="inspector-section__title">Связи</h3>
      <FlowGroup
        title="Исходящие потоки"
        items={entity.outgoing}
        emptyText="—"
        onNavigateToRelation={onNavigateToRelation}
      />
      <FlowGroup
        title="Входящие потоки"
        items={entity.incoming}
        emptyText="Для объекта добычи входящие связи не используются"
        onNavigateToRelation={onNavigateToRelation}
      />
    </section>
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
    <div className="flow-group">
      <h4 className="flow-group__title">{title}</h4>
      {items.length === 0 ? (
        <p className="flow-group__empty">{emptyText}</p>
      ) : (
        <ul className="connection-list">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="connection-item"
                onClick={() => onNavigateToRelation(c.id)}
                title={`Перейти к ${c.targetLabel}`}
              >
                <span className="connection-item__kind">{c.flowType}</span>
                <span className="connection-item__name">{c.targetLabel}</span>
                {c.isLogicalFlow && (
                  <span className="connection-item__badge">Передача флюида без физ. трубы</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
