import { ToggleSwitch } from '../../components/ui/ToggleSwitch';
import { CollapsibleSection } from '../../components/panel/CollapsibleSection';
import { BasemapSelector } from './BasemapSelector';
import type { MapDisplaySettings } from './types';
import './DisplaySettingsCard.css';

export type DisplaySettingsCardProps = {
  /** Настройки отображения карты */
  settings: MapDisplaySettings;
  /** Изменение настроек */
  onChange: (patch: Partial<MapDisplaySettings>) => void;
};

/**
 * Нижний блок Sidebar (README этап 5): тумблеры «Подписи объектов» и
 * «Индикация предупреждений» + выбор подложки карты.
 */
export function DisplaySettingsCard({ settings, onChange }: DisplaySettingsCardProps) {
  return (
    <CollapsibleSection
      title="Настройки отображения"
      className="display-settings-card"
      defaultOpen={false}
    >
      <div className="display-settings-card__toggles">
        <ToggleSwitch
          label="Подписи объектов"
          checked={settings.showLabels}
          onChange={(checked) => onChange({ showLabels: checked })}
        />
        <ToggleSwitch
          label="Индикация предупреждений"
          checked={settings.showWarnings}
          onChange={(checked) => onChange({ showWarnings: checked })}
        />
        <ToggleSwitch
          label="Ориентированный граф"
          checked={settings.directedGraph}
          onChange={(checked) => onChange({ directedGraph: checked })}
        />
        <ToggleSwitch
          label="Анимация потока"
          checked={settings.flowAnimation}
          onChange={(checked) => onChange({ flowAnimation: checked })}
        />
        <ToggleSwitch
          label="Лицензионные участки"
          checked={settings.showLicenceAreas}
          onChange={(checked) => onChange({ showLicenceAreas: checked })}
        />
        <ToggleSwitch
          label="Стыки трубопроводов"
          checked={settings.showEdgeJoints}
          onChange={(checked) => onChange({ showEdgeJoints: checked })}
        />
      </div>
      <BasemapSelector
        value={settings.basemap}
        onChange={(basemap) => onChange({ basemap })}
      />
    </CollapsibleSection>
  );
}
