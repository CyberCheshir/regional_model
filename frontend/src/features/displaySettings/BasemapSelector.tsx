import { AppIcon, type IconName } from '../../components/AppIcon';
import type { Basemap } from './types';
import './BasemapSelector.css';

const BASEMAP_OPTIONS: ReadonlyArray<{
  value: Basemap;
  label: string;
  icon: IconName;
}> = [
  { value: 'topo', label: 'Топографический план', icon: 'basemap-topo' },
  { value: 'satellite', label: 'Космоснимки', icon: 'basemap-satellite' },
];

export type BasemapSelectorProps = {
  /** Выбранная подложка */
  value: Basemap;
  /** Колбэк выбора подложки */
  onChange: (basemap: Basemap) => void;
};

/**
 * Выбор подложки карты (design description/components.md — BasemapSelector):
 * сегментированный контрол (общая подложка, активный сегмент выделен), default `topo`.
 * Семантика — радиогруппа (role=radiogroup / radio) для доступности.
 */
export function BasemapSelector({ value, onChange }: BasemapSelectorProps) {
  return (
    <div className="basemap-selector" role="radiogroup" aria-label="Подложка карты">
      <span className="basemap-selector__title">Подложка</span>
      <div className="basemap-seg">
        {BASEMAP_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={option.label}
              className={`basemap-seg__item${active ? ' basemap-seg__item--active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              <AppIcon name={option.icon} size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
