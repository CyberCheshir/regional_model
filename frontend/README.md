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
├── vite.config.ts
├── eslint.config.js        # flat-config, no-explicit-any: error
├── tsconfig*.json          # strict-конфигурации
└── src/
    ├── main.tsx            # подключает tokens.css + typography.css
    ├── App.tsx             # корневая композиция (только выбор страницы)
    ├── pages/
    │   └── DevShowcase.tsx # витрина токенов/иконок (временно, до Этапа 2)
    ├── components/
    │   ├── AppIcon.tsx     # единый компонент иконок (name/size/color)
    │   └── IconRegistry.ts # типизированный реестр 18 inline SVG (icons.md)
    └── styles/
        ├── tokens.css      # CSS-переменные (styles.md): палитра, радиусы, тени
        └── typography.css  # Inter, база 13px, .eyebrow, .object-title
```

## Конвенции

- Иконки добавляются только через реестр `IconRegistry` (имя → inline SVG) и
  рендерятся компонентом `AppIcon`; прямые `<svg>` в разметке не допускаются.
- Цвета, радиусы и тени — только через CSS-переменные из `tokens.css`.
- Типографика — утилитарные классы из `typography.css` (`.eyebrow`, `.object-title`).
- Запрещено `any`; TypeScript strict включён.

## Статус

Этап 1 (фундамент) — завершён. Следующий: Этап 2 — AppShell
(grid `56px 340px 1fr 380px`, слоты Activity Bar / Sidebar / Map / Inspector).
