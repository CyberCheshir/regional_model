import { useState } from 'react';
import type { DataTabId, ModelObject } from './types';
import { ObjectsTab } from './ObjectsTab';
import { ProfilesTab } from './ProfilesTab';
import { ConnectionsTab } from './ConnectionsTab';
import { ImportExportTab } from './ImportExportTab';
import './DataModuleView.css';

export type DataModuleViewProps = {
  /** Колбэк перехода к выбранному объекту на карте */
  onShowOnMap?: (obj: ModelObject) => void;
  /** Колбэк открытия карточки/инспектора объекта */
  onOpenObject?: (obj: ModelObject) => void;
  /** Показать временное системное уведомление */
  onNotify?: (message: string) => void;
};

export function DataModuleView({ onShowOnMap, onOpenObject, onNotify }: DataModuleViewProps) {
  const [activeTab, setActiveTab] = useState<DataTabId>('objects');

  return (
    <div className="data-module">
      {/* 1. Шапка модуля данных */}
      <header className="data-module__header">
        <h1 className="data-module__title">Данные</h1>
        <p className="data-module__subtitle">
          Объекты, профили, связи модели и управляемый импорт / экспорт данных.
        </p>

        {/* Навигационные вкладки подраздела */}
        <nav className="data-module__tabs" role="tablist">
          <button
            type="button"
            className={`data-module__tab-btn${activeTab === 'objects' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('objects')}
            role="tab"
            aria-selected={activeTab === 'objects'}
          >
            Объекты
            {activeTab === 'objects' && <span className="data-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`data-module__tab-btn${activeTab === 'profiles' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('profiles')}
            role="tab"
            aria-selected={activeTab === 'profiles'}
          >
            Профили
            {activeTab === 'profiles' && <span className="data-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`data-module__tab-btn${activeTab === 'connections' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('connections')}
            role="tab"
            aria-selected={activeTab === 'connections'}
          >
            Связи
            {activeTab === 'connections' && <span className="data-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`data-module__tab-btn${activeTab === 'import-export' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('import-export')}
            role="tab"
            aria-selected={activeTab === 'import-export'}
          >
            Импорт / экспорт
            {activeTab === 'import-export' && <span className="data-module__tab-indicator" />}
          </button>
        </nav>
      </header>

      {/* 2. Контентная область активного подраздела */}
      <main className="data-module__content">
        {activeTab === 'objects' && (
          <ObjectsTab onShowOnMap={onShowOnMap} onOpenObject={onOpenObject} />
        )}
        {activeTab === 'profiles' && <ProfilesTab onNotify={onNotify} />}
        {activeTab === 'connections' && <ConnectionsTab />}
        {activeTab === 'import-export' && <ImportExportTab />}
      </main>
    </div>
  );
}
