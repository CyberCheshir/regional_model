import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '../../components/AppIcon';
import './SampleAreasMenu.css';

export type SampleAreasMenuProps = {
  /**
   * Импортировать ОДИН участок из образца.
   * @param url       адрес файла-образца (содержит все участки)
   * @param areaIndex индекс участка в файле (0-based) — грузится только он
   */
  onImportSample: (url: string, areaIndex: number) => void;
};

/** URL образца со всеми участками (фигуры 1–7 из `data.txt`). */
const SAMPLES_URL = '/samples/licence-areas-1-7.json';

/** Семь участков образца (подписи «Участок N» + число точек из `data.txt`). */
const AREA_OPTIONS: ReadonlyArray<{ index: number; label: string; points: number }> = [
  { index: 0, label: 'Участок 1', points: 9 },
  { index: 1, label: 'Участок 2', points: 14 },
  { index: 2, label: 'Участок 3', points: 9 },
  { index: 3, label: 'Участок 4', points: 10 },
  { index: 4, label: 'Участок 5', points: 9 },
  { index: 5, label: 'Участок 6', points: 7 },
  { index: 6, label: 'Участок 7', points: 5 },
];

/**
 * Меню быстрого импорта образцов участков («Территории» → «Примеры»).
 *
 * Показывает список из 7 участков: клик по строке импортирует ТОЛЬКО этот
 * участок (а не все сразу) — загрузка по одному на выбор.
 */
export function SampleAreasMenu({ onImportSample }: SampleAreasMenuProps) {
  const [open, setOpen] = useState(false);
  // Координаты списка в системе окна (fixed). Вычисляются от кнопки.
  // Задаётся либо bottom (раскрытие вверх), либо top (раскрытие вниз).
  const [pos, setPos] = useState<{ left: number; bottom?: number; top?: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Раскрытие СНИЗУ ВВЕРХ и ПРАВЕ кнопки, но в пределах окна.
  // Список рендерится порталом в <body>, поэтому не обрезается overflow
  // зон-панелей (left sidebar / AppShell) — это и была причина «не видно».
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const btn = rootRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const listWidth = listRef.current?.offsetWidth ?? 220;
    const listHeight = listRef.current?.offsetHeight ?? 260;
    // По горизонтали — вправо от кнопки, но не за правый край окна.
    const left = Math.max(8, Math.min(r.right + 6, window.innerWidth - listWidth - 8));
    // Приоритет — раскрытие ВВЕРХ (низ списка = верх кнопки).
    const spaceAbove = r.top - 8;
    if (spaceAbove >= listHeight) {
      setPos({ left, bottom: window.innerHeight - r.top + 6 });
    } else {
      // Вверх не влезает — раскрываем ВНИЗ, прижимая к нижней границе окна.
      const top = Math.min(r.bottom + 6, window.innerHeight - listHeight - 8);
      setPos({ left, top: Math.max(8, top) });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // Клик по кнопке или по самому списку — не закрываем.
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    // Пересчёт позиции при скролле/ресайзе (fixed-координаты «плывут»).
    const reposition = () => setOpen(false);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  return (
    <div className="sample-areas" ref={rootRef}>
      <button
        type="button"
        className="graph-toolbar__button"
        title="Примеры участков (1–7)"
        aria-label="Примеры лицензионных участков"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <AppIcon name="nav-data" size={16} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            className="sample-areas__list sample-areas__list--portal"
            role="menu"
            aria-label="Примеры участков"
            style={{
              left: pos.left,
              ...(pos.top !== undefined ? { top: pos.top } : {}),
              ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
            }}
          >
            <span className="sample-areas__title">Выберите участок</span>
            {AREA_OPTIONS.map((option) => (
              <button
                key={option.index}
                type="button"
                role="menuitem"
                className="sample-areas__item"
                onClick={() => {
                  setOpen(false);
                  onImportSample(SAMPLES_URL, option.index);
                }}
              >
                <span className="sample-areas__item-label">{option.label}</span>
                <span className="sample-areas__item-meta">{option.points} точек</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
