import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { AreaExportFormat } from '../map/importAreas';
import './AreaExportMenu.css';

export type AreaExportMenuProps = {
  /** Экспортировать участки в выбранном формате */
  onExport: (format: AreaExportFormat) => void;
  /** Нет участков для выгрузки — кнопка неактивна */
  disabled?: boolean;
};

/** Пункты меню экспорта: формат + подпись. */
const EXPORT_OPTIONS: ReadonlyArray<{ format: AreaExportFormat; label: string }> = [
  { format: 'geojson', label: 'GeoJSON (.geojson)' },
  { format: 'json', label: 'JSON (.json)' },
  { format: 'csv', label: 'CSV (.csv)' },
];

/**
 * Компактное меню экспорта лицензионных участков: кнопка-иконка открывает
 * список форматов (GeoJSON / JSON / CSV). Размещается в разделе «Проектирование»
 * рядом с кнопкой импорта — по аналогии с круглым меню в интерфейсе.
 */
export function AreaExportMenu({ onExport, disabled = false }: AreaExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне и по Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="area-export" ref={rootRef}>
      <button
        type="button"
        className="graph-toolbar__button"
        title={disabled ? 'Нет участков для экспорта' : 'Экспорт участков'}
        aria-label="Экспорт лицензионных участков"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <AppIcon name="export" size={16} />
      </button>

      {open && !disabled && (
        <div className="area-export__list" role="menu" aria-label="Формат экспорта">
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              className="area-export__item"
              onClick={() => {
                setOpen(false);
                onExport(option.format);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
