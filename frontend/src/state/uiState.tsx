import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ModuleId } from '../app/ActivityBar';
import { DEFAULT_MAP_DISPLAY_SETTINGS, type MapDisplaySettings } from '../features/displaySettings/types';
import { DEFAULT_DIAGRAM_CONFIG, type DiagramConfig } from '../features/diagram/types';
import type { InspectorTabId } from '../features/inspector/types';
import type { SelectedEntity } from '../domain/types';
import type { ViewMode } from '../features/topbar/TopBar';

/**
 * Глобальный UI-state (Этап 9.4, design description/components.md §3.1).
 * Отделён от domain-state (данные карты/объектов — через react-query).
 *
 * selectedEntity {id, kind} — id совпадает с id узла дерева/карты,
 * kind выводится из дерева при выборе.
 */

type UiState = {
  /** Активный раздел Activity Bar */
  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;

  /** Выбранный объект (карта/дерево/инспектор), null — ничего не выбрано */
  selectedEntity: SelectedEntity | null;
  selectEntity: (id: string | null, kind?: SelectedEntity['kind']) => void;

  /** Активная вкладка инспектора */
  inspectorTab: InspectorTabId;
  setInspectorTab: (t: InspectorTabId) => void;

  /** Видимость объектов: id скрытых */
  hiddenIds: ReadonlySet<string>;
  toggleVisibility: (id: string, visible: boolean) => void;

  /** Модалка «Диаграмма на карте» */
  diagramEntityId: string | null;
  openDiagram: (entityId: string) => void;
  closeDiagram: () => void;
  diagramConfig: DiagramConfig;
  setDiagramConfig: (cfg: DiagramConfig) => void;

  /** Настройки отображения карты */
  mapDisplaySettings: MapDisplaySettings;
  patchMapDisplaySettings: (patch: Partial<MapDisplaySettings>) => void;

  /** Режим разработчика (dev-оверлеи, координаты и т.п.) */
  devMode: boolean;
  toggleDevMode: () => void;

  /** Режим работы: просмотр или редактирование графа (TopBar) */
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
};

const UiStateContext = createContext<UiState | null>(null);

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleId>('map');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('general');
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [diagramEntityId, setDiagramEntityId] = useState<string | null>(null);
  const [diagramConfig, setDiagramConfig] = useState<DiagramConfig>(DEFAULT_DIAGRAM_CONFIG);
  const [mapDisplaySettings, setMapDisplaySettings] = useState<MapDisplaySettings>(
    DEFAULT_MAP_DISPLAY_SETTINGS,
  );
  const [devMode, setDevMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

  const selectEntity = useCallback(
    (id: string | null, kind: SelectedEntity['kind'] = 'facility') => {
      setSelectedEntity(id === null ? null : { id, kind });
    },
    [],
  );

  const toggleVisibility = useCallback((id: string, visible: boolean) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openDiagram = useCallback((entityId: string) => {
    setSelectedEntity({ id: entityId, kind: 'facility' });
    setDiagramEntityId(entityId);
  }, []);

  const closeDiagram = useCallback(() => setDiagramEntityId(null), []);

  const patchMapDisplaySettings = useCallback((patch: Partial<MapDisplaySettings>) => {
    setMapDisplaySettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleDevMode = useCallback(() => setDevMode((v) => !v), []);

  const value = useMemo<UiState>(
    () => ({
      activeModule,
      setActiveModule,
      selectedEntity,
      selectEntity,
      inspectorTab,
      setInspectorTab,
      hiddenIds,
      toggleVisibility,
      diagramEntityId,
      openDiagram,
      closeDiagram,
      diagramConfig,
      setDiagramConfig,
      mapDisplaySettings,
      patchMapDisplaySettings,
      devMode,
      toggleDevMode,
      viewMode,
      setViewMode,
    }),
    [
      activeModule,
      selectedEntity,
      selectEntity,
      inspectorTab,
      hiddenIds,
      toggleVisibility,
      diagramEntityId,
      openDiagram,
      closeDiagram,
      diagramConfig,
      mapDisplaySettings,
      patchMapDisplaySettings,
      devMode,
      toggleDevMode,
      viewMode,
    ],
  );

  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>;
}

/** Доступ к глобальному UI-state. Бросает ошибку вне провайдера — fail fast. */
/* eslint-disable-next-line react-refresh/only-export-components -- контекст и хук логически одно целое */
export function useUiState(): UiState {
  const ctx = useContext(UiStateContext);
  if (ctx === null) {
    throw new Error('useUiState должен вызываться внутри <UiStateProvider>');
  }
  return ctx;
}
