# Спецификация компонентов Frontend (согласно design.png)

Документ описывает структуру, иерархию и требования к компонентам интерфейса на основе дизайн-макета `design.png`.

---

## 1. Общая компоновка экрана (Root Layout)

Корневой контейнер использует CSS Grid или Flexbox с 4 вертикальными зонами:
- **ActivityBar** (56px) — системная навигация по разделам.
- **LeftSidebar / TreePanel** (320px–360px) — панель структуры карты, слоев и дерева технологических объектов.
- **CenterWorkspace / MapCanvas** (1fr) — рабочая область интерактивной карты с гео-привязкой и оверлеем плавающих диаграмм.
- **RightSidebar / InspectorPanel** (380px–420px) — карточка выбранного технологического объекта с параметрами, связями и статусами.

---

## 2. Иерархия и дерево компонентов

```text
AppShell
├── ActivityBar
│   ├── ActivityBarItem (Карта - активна)
│   ├── ActivityBarItem (Данные)
│   ├── ActivityBarItem (Расчёты)
│   └── ActivityBarItem (Аналитика)
│
├── LeftSidebar (Управление элементами)
│   ├── PanelHeader (Заголовок, кнопка сворачивания '<', статус)
│   ├── StructureBarActions (Массовые действия: "СТРУКТУРА КАРТЫ", настроить графики, скрыть/показать все)
│   ├── ObjectTree
│   │   ├── ObjectTreeGroup ("Объекты добычи")
│   │   │   └── ObjectTreeNode ("Северный" [active], "Восточный")
│   │   ├── ObjectTreeGroup ("Площадные объекты")
│   │   │   ├── ObjectTreeSubGroup ("Сбор и подготовка нефти" -> "УПН-2")
│   │   │   ├── ObjectTreeSubGroup ("Сбор и подготовка газа")
│   │   │   └── ObjectTreeSubGroup ("Приём, учёт и сдача" -> "Точка поставки")
│   │   └── ObjectTreeGroup ("Трубопроводы")
│   │       ├── ObjectTreeSubGroup ("Нефтепроводы" -> промысловые, межпромысловые: Нефтепровод 01, 02)
│   │       ├── ObjectTreeSubGroup ("Газопроводы")
│   │       └── ObjectTreeSubGroup ("Продуктопроводы")
│   │   └── ObjectTreeActions (Кнопка графика, кнопка глаза видимости для каждого узла)
│   ├── DisplaySettingsCard
│   │   ├── ToggleSwitch ("Подписи объектов", default: true)
│   │   └── ToggleSwitch ("Индикация предупреждений", default: true)
│   ├── BasemapSelector
│   │   ├── RadioOption ("Космоснимки")
│   │   └── RadioOption ("Топографический план", default: selected)
│   └── PanelFooterHint ("Диаграмма — настроить · Глаз — показать/скрыть")
│
├── CenterWorkspace
│   ├── MapViewport (Интерактивная карта, MapLibre/VisNetwork)
│   │   ├── FacilityMapMarkers (Кусты, УПН, Точки поставки)
│   │   ├── PipelineEdges (Трубопроводы с цветовой кодировкой флюида)
│   │   └── EdgeDataBadges (Метки расхода: "1,8 млн м³/сут")
│   └── MapDiagramModal (Плавающее модальное окно "Диаграмма на карте")
│       ├── ModalHeader (Заголовок "Диаграмма на карте", имя объекта "Северный", кнопка закрытия)
│       ├── FluidSegmentedControl (Чипы: [Нефть - active], [Газ], [Вода])
│       ├── PeriodRadioGroup
│       │   ├── RadioOption ("Как на карте")
│       │   ├── RadioOption ("Весь период проекта")
│       │   └── RadioOption ("Свой диапазон" -> DateRangePicker: [2030] — [2035])
│       └── PlacementDropdown (Селектор позиции: "Авто", "Сверху", "Снизу" и т.д.)
│
└── RightSidebar (Инспектор объекта)
    ├── InspectorTabBar (Вертикальная колонка вкладок слева)
    │   ├── TabButton (Основная карточка объекта - active)
    │   ├── TabButton (Технологические параметры / режимы)
    │   ├── TabButton (Календарный план)
    │   ├── TabButton (Тренды добычи / графики)
    │   └── TabButton (Журнал предупреждений / алерты)
    └── InspectorContent
        ├── ObjectHeader
        │   ├── BreadcrumbTitle ("> Северный")
        │   ├── ObjectTypeSubtitle ("Кустовая площадка")
        │   └── StatusBadge (Зеленый круг + "Работает")
        ├── SectionGeneralParams ("ОБЩИЕ ПАРАМЕТРЫ")
        │   ├── PropertyRow (Наименование: "Северный")
        │   ├── PropertyRow (Тип объекта: "Кустовая площадка")
        │   ├── PropertyRow (Лицензионный участок: "Северный ЛУ")
        │   └── PropertyRow (Владелец: "ГПН-3")
        ├── SectionModelStatus ("СОСТОЯНИЕ МОДЕЛИ")
        │   ├── ValidationItem (Чекмарк + "Система сбора" -> "Северный контур")
        │   ├── ValidationItem (Чекмарк + "Профиль добычи" -> "из системы сбора")
        │   └── ValidationItem (Чекмарк + "Результаты ГР" -> "2026–2040")
        └── SectionConnections ("СВЯЗИ")
            ├── FlowGroup ("Исходящие потоки")
            │   ├── ConnectionItem (Трубопровод: "Нефтепровод · Нефтепровод 01")
            │   └── ConnectionItem (Логический поток: "УПН-2", бейдж "Передача флюида без физ. трубы")
            └── EmptyIncomingHint ("Для объекта добычи входящие связи не используются")
```

---

## 3. Требования к состояниям (State Management)

### 3.1. Глобальное состояние карты и модели
- `activeModule`: `'map' | 'data' | 'calc' | 'analytics'` (default: `'map'`).
- `selectedEntity`: `{ id: string, kind: 'facility' | 'node' | 'pipeline' | 'area' } | null`.
- `visibilityMap`: `Record<string, boolean>` — состояние видимости слоев и отдельных объектов на карте.
- `diagramModalState`:
  - `isOpen`: boolean
  - `targetEntityId`: string | null
  - `fluid`: `'oil' | 'gas' | 'water'`
  - `periodMode`: `'map' | 'project' | 'custom'`
  - `customRange`: `[number, number]` (например `[2030, 2035]`)
  - `placement`: `'auto' | 'top' | 'right' | 'bottom' | 'left'`
- `mapDisplaySettings`:
  - `showLabels`: boolean (default: `true`)
  - `showWarnings`: boolean (default: `true`)
  - `basemap`: `'topo' | 'satellite'` (default: `'topo'`)
- `inspectorTab`: `'general' | 'tech_params' | 'calendar' | 'trends' | 'alerts'`

### 3.2. Компонентные контракты и Props

#### `ObjectTreeNode.vue`
- **Props**:
  - `node`: `TreeNodeData` (id, title, subtitle, icon, isLeaf, childrenCount, status, hasDiagram)
  - `isSelected`: `boolean`
  - `isVisible`: `boolean`
  - `level`: `number` (для отступов иерархии)
- **Emits**:
  - `select(id: string)`
  - `toggle-visibility(id: string, visible: boolean)`
  - `open-diagram(id: string)`
  - `toggle-expand(id: string)`

#### `MapDiagramModal.vue`
- **Props**:
  - `visible`: `boolean`
  - `entityName`: `string`
  - `modelValue`: `DiagramConfig`
- **Emits**:
  - `update:modelValue(config: DiagramConfig)`
  - `close()`

#### `InspectorPanel.vue`
- **Props**:
  - `entity`: `DomainEntityDetails | null`
  - `loading`: `boolean`
- **Emits**:
  - `update-tab(tabId: string)`
  - `navigate-to-relation(relatedEntityId: string)`
