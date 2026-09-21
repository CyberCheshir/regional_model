/**
 * Вкладка «Профиль продукции»: переключатель Таблица/График, чекбоксы продуктов
 * с единицами измерения, профиль по годам (таблица) или столбцы с линией
 * ограничения (график) + tooltip.
 */
import { useState } from 'react';
import type { ProductProfile, ProductType } from '../../domain/types';
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
  const [enabled, setEnabled] = useState<ProductType[]>(
    () => profile?.products.filter((p) => p.enabled).map((p) => p.product) ?? [],
  );

  if (!profile) {
    return (
      <PanelSection title="Профиль продукции">
        <p className="pp-muted">Профиль продукции для этого объекта не задан.</p>
      </PanelSection>
    );
  }

  const toggleProduct = (p: ProductType) =>
    setEnabled((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const activeSeries = profile.series.filter((s) => enabled.includes(s.product));
  const years = range(profile.startYear, profile.endYear);

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

      <PanelSection title={`Профиль по датам · ${profile.startYear}–${profile.endYear}`}>
        {view === 'table' ? (
          <ProfileTable profile={profile} series={activeSeries} years={years} />
        ) : (
          <ProfileGraph profile={profile} series={activeSeries} />
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
  const unitOf = (p: ProductType) =>
    profile.products.find((x) => x.product === p)?.unit ?? '';
  const valueAt = (p: ProductType, year: number) =>
    series.find((s) => s.product === p)?.points.find((pt) => pt.year === year)?.value;
  return (
    <div className="pp-table-wrap">
      <table className="pp-table">
        <thead>
          <tr>
            <th className="pp-table__year-col">Год</th>
            <th className="pp-table__group" colSpan={series.length}>
              {profile.measureLabel}
            </th>
          </tr>
          <tr>
            <th />
            {series.map((s) => (
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
              {series.map((s) => (
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
  const points = series[0]?.points ?? [];
  const max = Math.max(profile.limit ?? 0, ...series.flatMap((s) => s.points.map((p) => p.value)), 1);
  const allYears = points.map((p) => p.year);

  const hoverValues =
    hoverYear == null
      ? []
      : series.map((s) => ({
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
              {series.map((s) => {
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
