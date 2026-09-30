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
import { tabsForKind, firstTabForKind } from './tabs';
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
  /** Изменить тип трубопровода в доменном слое */
  onPipelineTypeChange?: (pipelineType: import('../../domain/types').PipelineType) => void;
  /** Изменить классификацию трубопровода в доменном слое */
  onPipelineClassChange?: (pipelineClass: import('../../domain/types').PipelineClass) => void;
  /** Изменить протяжённость трубопровода в доменном слое */
  onPipelineLengthChange?: (lengthKm: number) => void;
  /** Изменить наружный диаметр трубы */
  onPipelineOuterDiameterChange?: (diameterMm: number) => void;
  /** Изменить толщину стенки трубы */
  onPipelineWallThicknessChange?: (thicknessMm: number) => void;
  /** Изменить шероховатость трубы */
  onPipelineRoughnessChange?: (roughnessMm: number) => void;
  /** Изменить дополнительные параметры трубопровода */
  onPipelineAdvancedChange?: (patch: {
    installation?: import('../../domain/types').PipelineInstallation;
    depthM?: number;
    routeCondition?: import('../../domain/types').PipelineRouteCondition;
    additivesEfficiency?: boolean;
    pipelineStatus?: import('../../domain/types').PipelineStatus;
    owner?: import('../../domain/types').PipelineOwner;
  }) => void;
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
  onPipelineTypeChange,
  onPipelineLengthChange,
  onPipelineOuterDiameterChange,
  onPipelineWallThicknessChange,
  onPipelineRoughnessChange,
  onPipelineAdvancedChange,
  onAddShutdown,
  onOpenCalc,
  loading = false,
  error = null,
  onRetry,
  onCollapse,
  onPipelineClassChange,
}: ParameterPanelProps) {
  const data = entity ? buildParameterPanelData(entity) : null;
  const panelKind = data?.panelKind ?? null;
  // У сегмента нет собственного профиля продукции — вкладка не показывается.
  const availableTabs = panelKind
    ? tabsForKind(panelKind).filter((tab) => !(entity?.kind === 'segment' && tab.id === 'product'))
    : [];
  const firstAvailableTab = availableTabs[0]?.id ?? firstTabForKind(panelKind ?? 'node');
  const hasAvailableTab = availableTabs.some((tab) => tab.id === activeTab);

  // Если у объекта нет активной вкладки — переключаемся на первую доступную.
  useEffect(() => {
    if (!panelKind) return;
    if (!hasAvailableTab) onTabChange(firstAvailableTab);
  }, [panelKind, hasAvailableTab, firstAvailableTab, onTabChange]);

  // Рельс вкладок — отдельная колонка НА ВСЮ ВЫСОТУ панели: левая часть
  // шапки объекта лежит поверх рельса (по макету). Поэтому шапка рендерится
  // внутри правой колонки, а не над всёй панелью.
  const rail = panelKind ? (
    <PanelTabRail
      tabs={availableTabs}
      active={hasAvailableTab ? activeTab : firstAvailableTab}
      onChange={onTabChange}
      kind={entity?.kind}
      subType={entity?.subType}
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
    const current = hasAvailableTab ? activeTab : firstAvailableTab;
    body = (
      <div className="pp__content">
        <TabContent
          tab={current}
          data={data}
          onRename={onRename}
          onPipelineTypeChange={onPipelineTypeChange}
          onPipelineClassChange={onPipelineClassChange}
          onPipelineLengthChange={onPipelineLengthChange}
          onPipelineOuterDiameterChange={onPipelineOuterDiameterChange}
          onPipelineWallThicknessChange={onPipelineWallThicknessChange}
          onPipelineRoughnessChange={onPipelineRoughnessChange}
          onPipelineAdvancedChange={onPipelineAdvancedChange}
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
  onPipelineTypeChange,
  onPipelineClassChange,
  onPipelineLengthChange,
  onPipelineOuterDiameterChange,
  onPipelineWallThicknessChange,
  onPipelineRoughnessChange,
  onPipelineAdvancedChange,
  onNavigateToRelation,
  onAddShutdown,
  onOpenCalc,
}: {
  tab: ParameterTabId;
  data: ReturnType<typeof buildParameterPanelData>;
  onRename?: (nextLabel: string) => void;
  onPipelineTypeChange?: (pipelineType: import('../../domain/types').PipelineType) => void;
  onPipelineClassChange?: (pipelineClass: import('../../domain/types').PipelineClass) => void;
  onPipelineLengthChange?: (lengthKm: number) => void;
  onPipelineOuterDiameterChange?: (diameterMm: number) => void;
  onPipelineWallThicknessChange?: (thicknessMm: number) => void;
  onPipelineRoughnessChange?: (roughnessMm: number) => void;
  onPipelineAdvancedChange?: (patch: {
    installation?: import('../../domain/types').PipelineInstallation;
    depthM?: number;
    routeCondition?: import('../../domain/types').PipelineRouteCondition;
    additivesEfficiency?: boolean;
    pipelineStatus?: import('../../domain/types').PipelineStatus;
    owner?: import('../../domain/types').PipelineOwner;
  }) => void;
  onNavigateToRelation: (id: string) => void;
  onAddShutdown?: () => void;
  onOpenCalc?: () => void;
}) {
  switch (tab) {
    case 'general':
      return (
        <GeneralTab
          data={data}
          onRename={onRename}
          onPipelineTypeChange={onPipelineTypeChange}
          onPipelineClassChange={onPipelineClassChange}
          onPipelineLengthChange={onPipelineLengthChange}
          onPipelineOuterDiameterChange={onPipelineOuterDiameterChange}
          onPipelineWallThicknessChange={onPipelineWallThicknessChange}
          onPipelineRoughnessChange={onPipelineRoughnessChange}
          onPipelineAdvancedChange={onPipelineAdvancedChange}
          onNavigateToRelation={onNavigateToRelation}
        />
      );
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
