/**
 * Мелкие переиспользуемые блоки панели параметров:
 *  - PropertyRow    — строка «метка → значение» (двухколоночная);
 *  - PanelSection   — секция с ЗАГЛАВНЫМ серым лейблом и разделителем;
 *  - PanelTabRail   — вертикальный рельс вкладок слева;
 *  - ChecklistRow   — строка проверки с цветной точкой/галочкой.
 */
import type { ReactNode } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { ParameterTab } from './tabs';
import type { EntityDetails, ParameterTabId } from '../../domain/types';
import wellpadIcon from '../../assets/design/wellpad.png';
import facilityIcon from '../../assets/design/facility.png';
import deliveryPointIcon from '../../assets/design/delivery-point.png';
import pipelineIcon from '../../assets/design/pipeline.png';
import segmentIcon from '../../assets/design/segment.png';

/** Иконка-картинка типа объекта для верхней зоны рельса. */
const KIND_IMAGE: Record<EntityDetails['kind'], string> = {
  wellpad: wellpadIcon,
  facility: facilityIcon,
  'delivery-point': deliveryPointIcon,
  pipeline: pipelineIcon,
  segment: segmentIcon,
};

/** Строка «метка — значение». Значение необязательно (тогда только метка). */
export function PropertyRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="pp-row">
      <span className="pp-row__label">{label}</span>
      {children !== undefined && (
        <span className={'pp-row__value' + (mono ? ' pp-row__value--mono' : '')}>{children}</span>
      )}
    </div>
  );
}

/** Секция панели: заголовок-лейбл + произвольное содержимое. */
export function PanelSection({
  title,
  action,
  children,
}: {
  title: string;
  /** Кнопка/ссылка справа от заголовка (напр. «+ Добавить период») */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pp-section">
      <div className="pp-section__head">
        <h3 className="pp-section__title">{title}</h3>
        {action}
      </div>
      <div className="pp-section__body">{children}</div>
    </section>
  );
}

/**
 * Вертикальный рельс вкладок (иконки слева от контента).
 * Состоит из ДВУХ зон:
 *   1) верхняя — высотой как `pp-header` (заполняет стык с шапкой);
 *   2) нижняя — сами кнопки-вкладки.
 * Ширина у обеих зон одинаковая; визуальная граница между ними попадает
 * ровно на стык `pp-header` / `pp__content`.
 */
export function PanelTabRail({
  tabs,
  active,
  onChange,
  kind,
}: {
  tabs: ParameterTab[];
  active: ParameterTabId;
  onChange: (tab: ParameterTabId) => void;
  /** Тип объекта — задаёт картинку в верхней зоне рельса */
  kind?: EntityDetails['kind'];
}) {
  return (
    <div className="pp-rail">
      {/* Зона 1: по высоте шапки — картинка типа в кнопке по центру */}
      <div className="pp-rail__zone pp-rail__zone--top" aria-hidden="true">
        {kind && (
          <span className="pp-rail__item pp-rail__item--kind">
            <img className="pp-rail__kind-img" src={KIND_IMAGE[kind]} alt="" />
          </span>
        )}
      </div>
      {/* Зона 2: кнопки вкладок */}
      <nav className="pp-rail__zone pp-rail__zone--tabs" aria-label="Вкладки панели параметров">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={'pp-rail__item' + (tab.id === active ? ' pp-rail__item--active' : '')}
            onClick={() => onChange(tab.id)}
            title={tab.label}
            aria-label={tab.label}
            aria-pressed={tab.id === active}
          >
            <AppIcon name={tab.icon} size={20} />
            <span className="pp-rail__label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Тип индикатора строки проверки. */
export type CheckLevel = 'ok' | 'warning' | 'none';

/** Строка проверки: цветной индикатор + заголовок + значение/детали. */
export function ChecklistRow({
  level,
  label,
  value,
}: {
  level: CheckLevel;
  label: string;
  value?: string;
}) {
  return (
    <div className={'pp-check pp-check--' + level}>
      <span className="pp-check__dot" aria-hidden="true">
        {level === 'ok' ? '✓' : level === 'warning' ? '!' : ''}
      </span>
      <span className="pp-check__label">{label}</span>
      {value && <span className="pp-check__value">{value}</span>}
    </div>
  );
}
