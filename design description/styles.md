# Спецификация стилей и дизайн-токенов (CSS / UI)

Документ описывает визуальную систему, цветовую палитру, типографику и оформление контролов, использованных в интерфейсе `design.png`.

---

## 1. Цветовая палитра и CSS переменные

```css
:root {
  /* Базовые цвета бренда и системы */
  --color-primary: #0066cc;
  --color-primary-hover: #0052a3;
  --color-primary-light: #ebf3fc;
  --color-primary-border: #99c2f0;

  /* Темные цвета навигации (Activity Bar) */
  --bg-activity-bar: #101a30;
  --activity-bar-icon: #8fa0bd;
  --activity-bar-icon-active: #ffffff;
  --activity-bar-active-bg: rgba(255, 255, 255, 0.12);
  --activity-bar-indicator: #0066cc;

  /* Фоновые цвета панелей и подложек */
  --bg-app: #f4f7fa;
  --bg-panel: #ffffff;
  --bg-panel-subtle: #f8fafc;
  --bg-card-hover: #f1f5f9;
  --bg-card-selected: #eef5ff;

  /* Границы и разделители */
  --border-subtle: #edf2f7;
  --border-default: #d9e1ec;
  --border-active: #7da7f6;

  /* Текст и типографика */
  --text-main: #14213d;
  --text-secondary: #5a6a85;
  --text-muted: #8c9ba5;
  --text-eyebrow: #7c8ba1;

  /* Цвета технологических объектов и статусов */
  --status-working-bg: #e6f9f0;
  --status-working-text: #0e8345;
  --status-working-dot: #10b981;

  /* Технологические типы объектов */
  --marker-wellpad: #f97316;     /* Оранжевый - Кустовые площадки / добыча */
  --marker-processing: #10b981;  /* Зеленый - УПН, сбор и подготовка */
  --marker-delivery: #7c3aed;    /* Фиолетовый - Точка сдачи/поставки */
  --pipeline-oil: #0066cc;       /* Синий - Нефтепроводы */
  --pipeline-gas: #10b981;       /* Зеленый - Газопроводы */
  --pipeline-water: #0ea5e9;     /* Голубой - Водоводы */

  /* Скругления */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-pill: 9999px;

  /* Тени */
  --shadow-card: 0 1px 3px rgba(16, 26, 48, 0.05);
  --shadow-modal: 0 8px 24px rgba(16, 26, 48, 0.12);
  --shadow-popover: 0 4px 16px rgba(16, 26, 48, 0.08);
}
```

---

## 2. Типографика

- **Основной шрифт**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Заголовки секций (Eyebrows)**:
  - `font-size: 11px`
  - `font-weight: 700`
  - `text-transform: uppercase`
  - `letter-spacing: 0.08em`
  - `color: var(--text-eyebrow)`
- **Заголовок объекта в карточке**:
  - `font-size: 18px`
  - `font-weight: 700`
  - `line-height: 1.3`
  - `color: var(--text-main)`
- **Основной текст и элементы списков**:
  - `font-size: 13px`
  - `line-height: 1.4`
- **Второстепенный текст и метрики**:
  - `font-size: 11px – 12px`
  - `color: var(--text-secondary)`

---

## 3. Стили элементов управления (UI Controls)

### 3.1. Переключатели (Toggle Switch)
Используются в настройках отображения («Подписи объектов», «Индикация предупреждений»):
```css
.ui-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background-color: #cbd5e1;
  border-radius: var(--radius-pill);
  transition: background-color 0.2s ease;
  cursor: pointer;
}
.ui-switch.is-checked {
  background-color: var(--color-primary);
}
.ui-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background-color: #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}
.ui-switch.is-checked .ui-switch__thumb {
  transform: translateX(16px);
}
```

### 3.2. Сегментированные кнопки (Chips / Segmented Control)
Используются в диаграмме на карте для выбора добываемой продукции («Нефть», «Газ», «Вода»):
```css
.segmented-control {
  display: inline-flex;
  background-color: #f1f5f9;
  padding: 3px;
  border-radius: var(--radius-lg);
  border: 1px solid #e2e8f0;
}
.segmented-item {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}
.segmented-item.active {
  background: #ffffff;
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
```

### 3.3. Плашка статуса объекта (Status Badge)
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: var(--status-working-bg);
  color: var(--status-working-text);
  font-size: 11px;
  font-weight: 600;
}
.status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-working-dot);
}
```

### 3.4. Плавающее окно «Диаграмма на карте» (Floating Modal)
```css
.map-diagram-modal {
  position: absolute;
  top: 40px;
  left: 40px;
  width: 320px;
  background: #ffffff;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal);
  padding: 18px;
  z-index: 100;
}
```

### 3.5. Сетка разметки экрана (App Shell Layout)
```css
.app-layout {
  display: grid;
  grid-template-columns: 56px 340px 1fr 380px;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--bg-app);
}
```
