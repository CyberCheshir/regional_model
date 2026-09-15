import type { EntityDetails } from './types';
import './InspectorSections.css';

/** Секция «ОБЩИЕ ПАРАМЕТРЫ»: строки PropertyRow label — value. */
export function SectionGeneralParams({ entity }: { entity: EntityDetails }) {
  return (
    <section className="inspector-section">
      <h3 className="inspector-section__title">Общие параметры</h3>
      <dl className="property-list">
        <div className="property-row">
          <dt className="property-row__label">Наименование</dt>
          <dd className="property-row__value">{entity.label}</dd>
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
