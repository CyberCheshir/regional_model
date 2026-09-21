# regional-model-frontend

Frontend веб-приложения «Региональная модель» — рабочее место инженера-моделировщика
нефтегазового актива (карта объектов, дерево объектов, инспектор, диаграммы).

Дорожная карта и прогресс: [`README.md`](../README.md) в корне репозитория.
Спецификации дизайна: [`design description/`](../design%20description/).
Правила разработки: [`AGENTS/frontend developer.md`](../AGENTS/frontend%20developer.md).

## Стек

- React 18 + TypeScript 5 (strict)
- Vite 6, Node.js 20
- ESLint 9 (typescript-eslint, react-hooks, react-refresh)

## Команды

```bash
npm install   # установка зависимостей
npm run dev   # dev-сервер Vite
npm run build # проверка типов (tsc -b) + production-сборка
npm run lint  # ESLint
npm run preview
```

## Структура

```text
frontend/
├── index.html              # точка входа (lang=ru, title «Региональная модель»)
├── vite.config.ts          # конфиг Vite + dev-прокси /api → backend
├── eslint.config.js        # flat-config, no-explicit-any: error
├── tsconfig*.json          # strict-конфигурации
└── src/
    ├── main.tsx            # точка входа (tokens.css + typography.css + провайдеры)
    ├── App.tsx             # корневая композиция (AppShell + TopBar)
    ├── api/                # API-слой: client, queries (react-query), mapSave, useSaveGraph
    ├── app/                # AppShell, ActivityBar, разделители панелей
    ├── components/         # переиспользуемые UI (AppIcon, IconRegistry, ErrorBoundary, ProgressBar)
    ├── domain/             # доменные типы и zod-схемы (schemas.ts, types.ts)
    ├── features/
    │   ├── map/            # карта: GeoMapOnly,GraphLayer, mapDrawing, geo, snap, healSplits,
    │   │                   #   splitSegmentByTap, importLicenceArea + (Вариант 1) vis-слой
    │   ├── objectTree/     # дерево объектов, GraphToolbar, LeftSidebar
    │   ├── inspector/      # инспектор объекта
    │   ├── diagram/        # модалка «Диаграмма на карте»
    │   ├── displaySettings/# настройки отображения карты
    │   └── topbar/         # верхняя панель (TopBar, сценарии, сохранение)
    ├── state/              # глобальный UI-state (uiState.tsx)
    └── styles/             # tokens.css, typography.css
```

## Конвенции

- Иконки добавляются только через реестр `IconRegistry` (имя → inline SVG) и
  рендерятся компонентом `AppIcon`; прямые `<svg>` в разметке не допускаются.
- Цвета, радиусы и тени — только через CSS-переменные из `tokens.css`.
- Типографика — утилитарные классы из `typography.css` (`.eyebrow`, `.object-title`).
- Запрещено `any`; TypeScript strict включён.

## Статус
Реализованы этапы 1–8, 11 (TopBar), 12 (Вариант 2 — ручные манипуляции графом
поверх чистой гео-карты). Подключён backend (Django + PostgreSQL) — сохранение
и загрузка сценариев. Актуальная дорожная карта — в [`README.md`](../README.md)
корня репозитория; инструкция по запуску — [`instructions.md`](../instructions.md).

### Режимы карты
Переключатель `MAP_ONLY` в `features/map/MapViewport.tsx`:
- `MAP_ONLY = true` (текущий) — чистая растровая карта (`GeoMapOnly`) + оверлей графа
  (`GeoGraphLayer`), вся логика манипуляций — вручную, гео-привязка lng/lat;
- `MAP_ONLY = false` — Вариант 1: граф на vis-network поверх тайлов.

vis-код Варианта 1 сохранён и используется при `MAP_ONLY = false`.
