/**
 * Вкладка «Профиль продукции»: переключатель Таблица/График, чекбоксы продуктов
 * с единицами измерения, профиль по годам (таблица) или столбцы с линией
 * ограничения (график) + tooltip.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ProductProfile, ProductSeries, ProductType } from '../../domain/types';
import { PanelSection } from './parts';
import { PRODUCT_COLOR, PRODUCT_LABEL } from './productMeta';

type View = 'table' | 'graph';

export function ProductTab({
  profile,
  /** Дополнительная ось для техплощадки: «Поступление ↔ Поставка» */
  showSideAxis = false,
}: {
  profile: ProductProfile | null;
  showSideAxis?: boolean;
}) {
  const [view, setView] = useState<View>('table');
  const [enabled, setEnabled] = useState<ProductType[]>(() => {
    if (!profile) return [];
    if (profile.series.length > 0) {
      return profile.series.map((s) => s.product);
    }
    return profile.products.filter((p) => p.enabled).map((p) => p.product);
  });

  // Синхронизируем включённые продукты при изменении/появлении профиля из domain layer
  useEffect(() => {
    if (!profile) return;
    if (profile.series.length > 0) {
      setEnabled(profile.series.map((s) => s.product));
    } else {
      setEnabled(profile.products.filter((p) => p.enabled).map((p) => p.product));
    }
  }, [profile]);

  if (!profile) {
    return (
      <PanelSection title="Профиль продукции">
        <p className="pp-muted">Профиль продукции для этого объекта не задан.</p>
      </PanelSection>
    );
  }

  const toggleProduct = (p: ProductType) =>
    setEnabled((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const shownActive = profile.series.filter((s) => enabled.includes(s.product));
  const seriesYears = shownActive[0]?.points?.map((pt) => pt.year) ?? [];
  const years = seriesYears.length > 0 ? seriesYears : range(profile.startYear, profile.endYear);

  return (
    <>
      <div className="pp-segmented" role="group" aria-label="Вид профиля продукции">
        <button
          type="button"
          className={'pp-segmented__btn' + (view === 'table' ? ' pp-segmented__btn--active' : '')}
          onClick={() => setView('table')}
          aria-pressed={view === 'table'}
        >
          Таблица
        </button>
        <button
          type="button"
          className={'pp-segmented__btn' + (view === 'graph' ? ' pp-segmented__btn--active' : '')}
          onClick={() => setView('graph')}
          aria-pressed={view === 'graph'}
        >
          График
        </button>
      </div>

      {showSideAxis && (
        <div className="pp-side-axis" role="group" aria-label="Ось поступления/поставки">
          <button type="button" className="pp-side-axis__btn pp-side-axis__btn--active">
            Поступление
          </button>
          <button type="button" className="pp-side-axis__btn">
            Поставка
          </button>
        </div>
      )}

      {/* Чекбоксы продуктов с единицами измерения */}
      <div className="pp-products">
        {profile.products.map((p) => (
          <label className="pp-product" key={p.product}>
            <input
              type="checkbox"
              checked={enabled.includes(p.product)}
              onChange={() => toggleProduct(p.product)}
            />
            <span
              className="pp-product__swatch"
              style={{ background: PRODUCT_COLOR[p.product] }}
              aria-hidden="true"
            />
            <span className="pp-product__name">{PRODUCT_LABEL[p.product]}</span>
            <span className="pp-product__unit">{p.unit}</span>
          </label>
        ))}
      </div>

      <PanelSection
        title={`Профиль по датам · ${profile.startYear}–${profile.endYear}`}
        grow
      >
        {view === 'table' ? (
          <ProfileTable profile={profile} series={shownActive} years={years} />
        ) : (
          <ProfileGraph profile={profile} series={shownActive} />
        )}
      </PanelSection>
    </>
  );
}

/* ---------------------------------------------------------------- */

function ProfileTable({
  profile,
  series,
  years,
}: {
  profile: ProductProfile;
  series: ProductProfile['series'];
  years: number[];
}) {
  // Гарантия уникальности: объединяем любые дублирующиеся серии по типу продукта
  const uniqueSeries = useMemo(() => {
    const map = new Map<ProductType, ProductSeries>();
    for (const s of series) {
      const existing = map.get(s.product);
      if (!existing) {
        map.set(s.product, { product: s.product, points: s.points.map((p) => ({ ...p })) });
      } else {
        for (const p of s.points) {
          const pt = existing.points.find((x) => x.year === p.year);
          if (pt) pt.value = Math.round((pt.value + p.value) * 100) / 100;
          else existing.points.push({ ...p });
        }
      }
    }
    return Array.from(map.values());
  }, [series]);

  if (uniqueSeries.length === 0) {
    return (
      <div className="pp-muted" style={{ padding: '32px 16px', textAlign: 'center' }}>
        Табличные данные профиля продукции пока не заполнены
      </div>
    );
  }

  const unitOf = (p: ProductType) =>
    profile.products.find((x) => x.product === p)?.unit ?? '';
  const valueAt = (p: ProductType, year: number) =>
    uniqueSeries.find((s) => s.product === p)?.points.find((pt) => pt.year === year)?.value;
  return (
    <div className="pp-table-wrap">
      <table className="pp-table">
        <thead>
          <tr>
            <th className="pp-table__year-col">Год</th>
            <th className="pp-table__group" colSpan={uniqueSeries.length}>
              {profile.measureLabel}
            </th>
          </tr>
          <tr>
            <th />
            {uniqueSeries.map((s) => (
              <th key={s.product} className="pp-table__product-head">
                <span
                  className="pp-table__swatch"
                  style={{ background: PRODUCT_COLOR[s.product] }}
                  aria-hidden="true"
                />
                {PRODUCT_LABEL[s.product]}
                <span className="pp-table__unit">{unitOf(s.product)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="pp-table__year">{year}</td>
              {uniqueSeries.map((s) => (
                <td key={s.product} className="pp-table__num">
                  {formatNum(valueAt(s.product, year))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfileGraph({
  profile,
  series,
}: {
  profile: ProductProfile;
  series: ProductProfile['series'];
}) {
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  // Гарантируем уникальность по каждому типу вещества
  const uniqueSeries = useMemo(() => {
    const map = new Map<ProductType, ProductSeries>();
    for (const s of series) {
      const existing = map.get(s.product);
      if (!existing) {
        map.set(s.product, { product: s.product, points: s.points.map((p) => ({ ...p })) });
      } else {
        for (const p of s.points) {
          const pt = existing.points.find((x) => x.year === p.year);
          if (pt) pt.value = Math.round((pt.value + p.value) * 100) / 100;
          else existing.points.push({ ...p });
        }
      }
    }
    return Array.from(map.values());
  }, [series]);

  const allYears = useMemo(() => {
    const yearSet = new Set<number>();
    for (const s of uniqueSeries) {
      for (const p of s.points) {
        yearSet.add(p.year);
      }
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [uniqueSeries]);

  if (uniqueSeries.length === 0 || allYears.length === 0) {
    return (
      <div className="pp-muted" style={{ padding: '48px 16px', textAlign: 'center' }}>
        График профиля продукции пока не заполнен
      </div>
    );
  }

  const max = Math.max(profile.limit ?? 0, ...uniqueSeries.flatMap((s) => s.points.map((p) => p.value)), 1);

  const hoverValues =
    hoverYear == null
      ? []
      : uniqueSeries.map((s) => ({
        product: s.product,
        value: s.points.find((p) => p.year === hoverYear)?.value ?? 0,
      }));

  return (
    <div className="pp-chart">
      <div className="pp-chart__head">
        <span className="pp-chart__eyebrow">{profile.measureLabel.toUpperCase()}</span>
        {profile.limit != null && (
          <span className="pp-chart__limit">Ограничение {profile.limit}</span>
        )}
      </div>
      <div className="pp-chart__plot">
        {profile.limit != null && (
          <span
            className="pp-chart__limit-line"
            style={{ bottom: `${(profile.limit / max) * 100}%` }}
            aria-hidden="true"
          />
        )}
        <div className="pp-chart__bars">
          {allYears.map((year) => (
            <button
              type="button"
              key={year}
              className={'pp-chart__col' + (hoverYear === year ? ' pp-chart__col--hover' : '')}
              onMouseEnter={() => setHoverYear(year)}
              onMouseLeave={() => setHoverYear(null)}
              onFocus={() => setHoverYear(year)}
              onBlur={() => setHoverYear(null)}
              aria-label={`${year}: ${hoverValues.map((v) => formatNum(v.value)).join(', ')}`}
            >
              {uniqueSeries.map((s) => {
                const v = s.points.find((p) => p.year === year)?.value ?? 0;
                return (
                  <span
                    key={s.product}
                    className="pp-chart__bar"
                    style={{ height: `${(v / max) * 100}%`, background: PRODUCT_COLOR[s.product] }}
                  />
                );
              })}
            </button>
          ))}
        </div>
        {hoverYear != null && (
          <div className="pp-chart__tooltip">
            <span className="pp-chart__tooltip-date">01.01.{hoverYear}</span>
            {hoverValues.map((v) => (
              <span className="pp-chart__tooltip-row" key={v.product}>
                <span
                  className="pp-chart__tooltip-swatch"
                  style={{ background: PRODUCT_COLOR[v.product] }}
                />
                {PRODUCT_LABEL[v.product]}: <b>{formatNum(v.value)}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="pp-chart__axis">
        <span>{allYears[0]}</span>
        {allYears.length > 2 && <span>{allYears[Math.floor(allYears.length / 2)]}</span>}
        <span>{allYears[allYears.length - 1]}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

/** Числовой ряд [start..end] включительно. */
function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let y = start; y <= end; y++) out.push(y);
  return out;
}

/** Формат числа: тысячные группы, запятая — разделитель дробной части. */
function formatNum(value: number | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}
