import { STATUS_BADGE, type EntityDetails } from './types';
import './ObjectHeader.css';

/**
 * Шапка карточки объекта: крошки «> Имя», подтип, статус-бейдж.
 * (design description/components.md §2, ObjectHeader)
 */
export function ObjectHeader({ entity }: { entity: EntityDetails }) {
  const badge = STATUS_BADGE[entity.status];
  return (
    <header className="object-header">
      <div className="object-header__title-row">
        <span className="object-header__breadcrumb" aria-hidden="true">
          ›
        </span>
        <h2 className="object-header__title">{entity.label}</h2>
        <span className={`status-badge ${badge.className}`}>
          <span className="status-badge__dot" aria-hidden="true" />
          {badge.label}
        </span>
      </div>
      {entity.subType && (
        <p className="object-header__subtitle">{entity.subType}</p>
      )}
    </header>
  );
}
