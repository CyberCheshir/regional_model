import type { EntityDetails } from '../../domain/types';
import { PanelSection, PropertyRow } from './parts';
import './ParameterPanel.css';

/** Общие текстовые параметры группы. Числовые параметры намеренно не включаются. */
function commonTextValue(items: EntityDetails[], read: (item: EntityDetails) => string | undefined): string {
  const values = items.map(read);
  const first = values[0];
  if (values.every((value) => value === first)) return first == null || first === '' ? '—' : first;
  return 'Разные значения';
}

export function MultiSelectionPanel({ entities }: { entities: EntityDetails[] }) {
  // В общие параметры включаем только категориальные/текстовые значения:
  // численные характеристики (длина, диаметр, толщина, глубина и т.п.) не показываем.
  const kind = commonTextValue(entities, (item) => item.subType ?? item.kind);
  const status = commonTextValue(entities, (item) => item.status);
  const owner = commonTextValue(entities, (item) => item.owner);
  const period = commonTextValue(entities, (item) => item.period);
  const source = commonTextValue(entities, (item) => item.attributes?.source as string | undefined);
  const licenseArea = commonTextValue(entities, (item) => item.licenseArea);

  return (
    <div className="pp__content pp__content--multi">
      <PanelSection title="Множественный выбор">
        <div className="pp-multi-selection__summary">
          Выбрано элементов: <strong>{entities.length}</strong>
        </div>
        <div className="pp-properties-table" role="table" aria-label="Общие параметры выбранных элементов">
          <PropertyRow label="Тип объекта">{kind}</PropertyRow>
          <PropertyRow label="Состояние">{status}</PropertyRow>
          <PropertyRow label="Владелец">{owner}</PropertyRow>
          <PropertyRow label="Период">{period}</PropertyRow>
          <PropertyRow label="Источник">{source}</PropertyRow>
          <PropertyRow label="Лицензионный участок">{licenseArea}</PropertyRow>
        </div>
      </PanelSection>
      <PanelSection title="Редактирование">
        <p className="pp-muted pp-multi-selection__hint">
          Выберите один элемент, чтобы редактировать его параметры.
        </p>
      </PanelSection>
    </div>
  );
}
