import type { InspectorTabId } from './types';
import { INSPECTOR_TABS } from './tabs';
import { AppIcon } from '../../components/AppIcon';
import './InspectorTabBar.css';

export type InspectorTabBarProps = {
  activeTab: InspectorTabId;
  onChange: (tab: InspectorTabId) => void;
};

/** Вертикальная колонка вкладок слева (components.md §2 InspectorTabBar). */
export function InspectorTabBar({ activeTab, onChange }: InspectorTabBarProps) {
  return (
    <nav className="inspector-tabs" aria-label="Вкладки инспектора">
      {INSPECTOR_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={
            'inspector-tabs__item' +
            (tab.id === activeTab ? ' inspector-tabs__item--active' : '')
          }
          onClick={() => onChange(tab.id)}
          title={tab.label}
          aria-pressed={tab.id === activeTab}
        >
          <AppIcon name={tab.icon} size={18} />
          <span className="inspector-tabs__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
