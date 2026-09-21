/**
 * Панель параметров — расширенная замена InspectorPanel (UI images/parameter panel).
 *
 * Структура (по макетам):
 *   [ ObjectHeader: › Имя · Тип · Класс + статус-бейдж + сворачивание ]
 *   [ TabRail | Контент активной вкладки ]
 *
 * Набор вкладок зависит от рода объекта (tabsForKind): у трубопровода есть
 * «Гидравлический расчёт», у площадных объектов — нет.
 */
import { useEffect } from 'react';
import { AppIcon } from '../../components/AppIcon';
import { AsyncState } from '../../components/AsyncState';
import type { EntityDetails, ParameterTabId } from '../../domain/types';
import { buildParameterPanelData } from './buildPanelData';
import { hasTab, tabsForKind, firstTabForKind } from './tabs';
import { PanelTabRail } from './parts';
import { ParameterPanelHeader } from './ParameterPanelHeader';
import { GeneralTab } from './GeneralTab';
import { CalendarTab } from './CalendarTab';
import { ProductTab } from './ProductTab';
import { HydraulicTab } from './HydraulicTab';
import { AnalyticsTab } from './AnalyticsTab';
import './ParameterPanel.css';

export type ParameterPanelProps = {
  /** Детали выбранного объекта (null — ничего не выбрано) */
  entity: EntityDetails | null;
  /** Активная вкладка */
  activeTab: ParameterTabId;
  onTabChange: (tab: ParameterTabId) => void;
  /** Переход к связанному объекту (клик по ссылке во вкладке «Общие параметры») */
  onNavigateToRelation: (id: string) => void;
  /** Переименовать выбранный объект */
  onRename?: (nextLabel: string) => void;
  /** Добавить период вывода из эксплуатации (заготовка) */
  onAddShutdown?: () => void;
  /** Перейти в гидравлический расчёт (заготовка) */
  onOpenCalc?: () => void;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onCollapse?: () => void;
};

export function ParameterPanel({
  entity,
  activeTab,
  onTabChange,
  onNavigateToRelation,
  onRename,
  onAddShutdown,
  onOpenCalc,
  loading = false,
  error = null,
  onRetry,
  onCollapse,
}: ParameterPanelProps) {
  const data = entity ? buildParameterPanelData(entity) : null;
  const panelKind = data?.panelKind ?? null;

  // Если у объекта нет активной вкладки — переключаемся на первую доступную.
  useEffect(() => {
    if (!panelKind) return;
    if (!hasTab(panelKind, activeTab)) onTabChange(firstTabForKind(panelKind));
  }, [panelKind, activeTab, onTabChange]);

  // Рельс вкладок — отдельная колонка НА ВСЮ ВЫСОТУ панели: левая часть
  // шапки объекта лежит поверх рельса (по макету). Поэтому шапка рендерится
  // внутри правой колонки, а не над всёй панелью.
  const rail = panelKind ? (
    <PanelTabRail
      tabs={tabsForKind(panelKind)}
      active={hasTab(panelKind, activeTab) ? activeTab : firstTabForKind(panelKind)}
      onChange={onTabChange}
      kind={entity?.kind}
    />
  ) : null;

  let body;
  if (!entity && loading) {
    body = <AsyncState loading error={null}>{null}</AsyncState>;
  } else if (!entity && error) {
    body = <AsyncState loading={false} error={error} onRetry={onRetry}>{null}</AsyncState>;
  } else if (!entity || !data || !panelKind) {
    body = <EmptyState />;
  } else {
    const current = hasTab(panelKind, activeTab) ? activeTab : firstTabForKind(panelKind);
    body = (
      <div className="pp__content">
        <TabContent
          tab={current}
          data={data}
          onRename={onRename}
          onNavigateToRelation={onNavigateToRelation}
          onAddShutdown={onAddShutdown}
          onOpenCalc={onOpenCalc}
        />
      </div>
    );
  }

  return (
    <div className="pp-wrap">
      {rail}
      <div className="pp-main">
        {entity && data ? (
          <ParameterPanelHeader
            entity={entity}
            objectClass={data.objectClass}
            onCollapse={onCollapse}
          />
        ) : (
          /* Пустое состояние: без шапки объекта, но кнопка сворачивания есть. */
          <div className="pp-header-wrap">
            <div className="pp-header pp-header--empty">
              {onCollapse && (
                <button
                  type="button"
                  className="pp-header__collapse"
                  onClick={onCollapse}
                  title="Свернуть панель параметров"
                  aria-label="Свернуть панель параметров"
                >
                  <AppIcon name="collapse-panel" size={16} flipped />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="pp-wrap__body">{body}</div>
      </div>
    </div>
  );
}

function TabContent({
  tab,
  data,
  onRename,
  onNavigateToRelation,
  onAddShutdown,
  onOpenCalc,
}: {
  tab: ParameterTabId;
  data: ReturnType<typeof buildParameterPanelData>;
  onRename?: (nextLabel: string) => void;
  onNavigateToRelation: (id: string) => void;
  onAddShutdown?: () => void;
  onOpenCalc?: () => void;
}) {
  switch (tab) {
    case 'general':
      return <GeneralTab data={data} onRename={onRename} onNavigateToRelation={onNavigateToRelation} />;
    case 'calendar':
      return (
        <CalendarTab
          period={data.workPeriod}
          panelKind={data.panelKind}
          onAddShutdown={onAddShutdown}
        />
      );
    case 'product':
      return (
        <ProductTab profile={data.productProfile} showSideAxis={data.panelKind === 'facility'} />
      );
    case 'hydraulic':
      return <HydraulicTab calc={data.hydraulic} onOpenCalc={onOpenCalc} />;
    case 'analytics':
      return <AnalyticsTab data={data.analytics} />;
    default:
      return null;
  }
}

function EmptyState() {
  return (
    <div className="pp-empty">
      <span className="pp-empty__icon">
        <AppIcon name="pp-object" size={30} />
      </span>
      <p className="pp-empty__text">
        Выберите объект на карте или в дереве элементов, чтобы увидеть его параметры
      </p>
    </div>
  );
}
