import { InspectorTabBar } from './InspectorTabBar';
import { PanelHeader } from '../../components/panel/PanelHeader';
import { INSPECTOR_TABS, type InspectorTab } from './tabs';
import type { EntityDetails, InspectorTabId } from './types';
import { ObjectHeader } from './ObjectHeader';
import { SectionGeneralParams, SectionModelStatus } from './InspectorSections';
import { SectionConnections } from './SectionConnections';
import { AppIcon } from '../../components/AppIcon';
import { AsyncState } from '../../components/AsyncState';
import './InspectorPanel.css';

export type InspectorPanelProps = {
  /** Детали выбранного объекта (null — ничего не выбрано) */
  entity: EntityDetails | null;
  /** Активный таб */
  activeTab: InspectorTabId;
  onTabChange: (tab: InspectorTabId) => void;
  /** Переход к связанному объекту */
  onNavigateToRelation: (id: string) => void;
  /** Идёт загрузка деталей (react-query) */
  loading?: boolean;
  /** Ошибка загрузки деталей */
  error?: Error | null;
  /** Повторить запрос деталей после ошибки */
  onRetry?: () => void;
  /** Свернуть панель инспектора */
  onCollapse?: () => void;
  /** Переименовать выбранный объект (правка поля «Наименование») */
  onRename?: (nextLabel: string) => void;
};

/** Правая панель — карточка выбранного объекта. */
export function InspectorPanel({
  entity,
  activeTab,
  onTabChange,
  onNavigateToRelation,
  loading = false,
  error = null,
  onRetry,
  onCollapse,
  onRename,
}: InspectorPanelProps) {
  const tabLabel =
    INSPECTOR_TABS.find((t: InspectorTab) => t.id === activeTab)?.label ?? '';

  // Контент панели зависит от состояния выбранного объекта
  let body;
  if (!entity && loading) {
    body = <AsyncState loading error={null}>{null}</AsyncState>;
  } else if (!entity && error) {
    body = <AsyncState loading={false} error={error} onRetry={onRetry}>{null}</AsyncState>;
  } else if (!entity) {
    body = <InspectorEmptyState />;
  } else {
    body = (
      <div className="inspector-panel">
        <InspectorTabBar activeTab={activeTab} onChange={onTabChange} />
        <div className="inspector-panel__content">
          <ObjectHeader entity={entity} />
          {activeTab === 'general' ? (
            <>
              <SectionGeneralParams entity={entity} onRename={onRename} />
              <SectionModelStatus entity={entity} />
              <SectionConnections entity={entity} onNavigateToRelation={onNavigateToRelation} />
            </>
          ) : (
            <div className="inspector-panel__placeholder">
              <p>Раздел «{tabLabel}» появится на следующих этапах.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-panel-with-header">
      <PanelHeader
        title="Инспектор объекта"
        onCollapse={onCollapse}
        collapseLabel="Свернуть инспектор"
        collapseFlipped
      />
      <div className="inspector-panel-with-header__body">{body}</div>
    </div>
  );
}

function InspectorEmptyState() {
  return (
    <div className="inspector-empty">
      <span className="inspector-empty__icon">
        <AppIcon name="tab-general" size={28} />
      </span>
      <p className="inspector-empty__text">
        Выберите объект на карте или в дереве элементов, чтобы увидеть его карточку
      </p>
    </div>
  );
}
