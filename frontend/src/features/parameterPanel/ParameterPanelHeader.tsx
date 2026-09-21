/**
 * Шапка панели параметров: «› Имя», подзаголовок «Тип · Класс»,
 * справа — статус-бейдж (зелёный «Работает» и т.п.) и кнопка сворачивания.
 * Отдельный PanelHeader («Панель параметров») убран — шапка объекта одна.
 */
import { AppIcon } from '../../components/AppIcon';
import { STATUS_BADGE, type EntityDetails } from './types';

export function ParameterPanelHeader({
  entity,
  objectClass,
  onCollapse,
}: {
  entity: EntityDetails;
  objectClass?: string;
  onCollapse?: () => void;
}) {
  const badge = STATUS_BADGE[entity.status];
  const subtitleParts = [entity.subType ?? KIND_LABEL[entity.kind], objectClass].filter(
    Boolean,
  ) as string[];
  return (
    <div className="pp-header-wrap">
      <header className="pp-header">
        <div className="pp-header__titles">
          <h2 className="pp-header__name">
            <button
              type="button"
              className="pp-header__collapse"
              onClick={onCollapse}
              disabled={!onCollapse}
              title="Свернуть панель параметров"
              aria-label="Свернуть панель параметров"
            >
              <AppIcon name="collapse-panel" size={16} flipped />
            </button>
            {entity.label}
          </h2>
          <p className="pp-header__subtitle">{subtitleParts.join(' · ')}</p>
        </div>
        <span className={`pp-status ${badge.className}`}>
          <span className="pp-status__dot" aria-hidden="true" />
          {badge.label}
        </span>
      </header>
    </div>
  );
}

const KIND_LABEL: Record<EntityDetails['kind'], string> = {
  wellpad: 'Кустовая площадка',
  facility: 'Технологическая площадка',
  'delivery-point': 'Точка поставки',
  pipeline: 'Нефтепровод',
  segment: 'Сегмент трубопровода',
};
