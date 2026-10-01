/**
 * Вкладка «Профиль продукции»: переключатель Таблица/График, чекбоксы продуктов
 * с единицами измерения, профиль по годам (таблица) или столбцы с линией
 * ограничения (график) + tooltip.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductProfile, ProductSeries, ProductType } from '../../domain/types';
import { PanelSection } from './parts';
import { PRODUCT_COLOR, PRODUCT_LABEL } from './productMeta';
import {
  assignAxes,
  chooseIntervals,
  formatTick,
  niceScale,
  prettyUnit,
  type AxisScale,
  type AxisSide,
} from './chartScale';

type View = 'table' | 'graph';

/** Итог загрузки профиля из файла для выбранного объекта. */
export type ProfileImportResult = { ok: true; message: string } | { ok: false; message: string };

/** Колбэк загрузки профиля: разбор файла и запись в модель выполняет вызывающая сторона. */
export type ProfileImportHandler = (file: File) => Promise<ProfileImportResult>;

export function ProductTab({
  profile,
  /** Дополнительная ось для техплощадки: «Поступление ↔ Поставка» */
  showSideAxis = false,
  onImportProfile,
}: {
  profile: ProductProfile | null;
  showSideAxis?: boolean;
  /** Загрузить профиль из файла (.xlsx/.xls/.csv) для выбранного объекта */
  onImportProfile?: ProfileImportHandler;
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

  const importBar = onImportProfile ? <ProfileImportBar onImport={onImportProfile} /> : null;

  if (!profile) {
    return (
      <>
        {importBar}
        <PanelSection title="Профиль продукции">
          <p className="pp-muted">Профиль продукции для этого объекта не задан.</p>
        </PanelSection>
      </>
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

      {importBar}

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

type ImportState =
  | { phase: 'idle' }
  | { phase: 'loading'; fileName: string }
  | { phase: 'done'; result: ProfileImportResult };

/** Кнопка «Загрузить профиль» + статус последней загрузки. */
function ProfileImportBar({ onImport }: { onImport: ProfileImportHandler }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ phase: 'idle' });

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем значение, чтобы повторный выбор того же файла снова вызвал onChange.
    e.target.value = '';
    if (!file) return;
    setState({ phase: 'loading', fileName: file.name });
    try {
      const result = await onImport(file);
      setState({ phase: 'done', result });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setState({
        phase: 'done',
        result: { ok: false, message: `Не удалось прочитать файл «${file.name}»: ${reason}` },
      });
    }
  };

  const loading = state.phase === 'loading';

  return (
    <div className="pp-import">
      <button
        type="button"
        className="pp-add-btn"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title="Файл профиля этого объекта: столбцы Тип, Продукт, Ед.изм, далее годы (2026, 2027, …)"
      >
        {loading ? 'Загрузка…' : 'Загрузить профиль'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={handleChange}
      />
      {state.phase === 'loading' && (
        <span className="pp-import__status" role="status">
          Чтение «{state.fileName}»…
        </span>
      )}
      {state.phase === 'done' && (
        <span
          className={
            'pp-import__status ' +
            (state.result.ok ? 'pp-import__status--ok' : 'pp-import__status--error')
          }
          role={state.result.ok ? 'status' : 'alert'}
        >
          {state.result.message}
        </span>
      )}
    </div>
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

  const unitOf = (p: ProductType) => profile.products.find((x) => x.product === p)?.unit ?? '';
  const valueAt = (s: ProductSeries, year: number) => s.points.find((p) => p.year === year)?.value ?? 0;

  // Распределение рядов по шкалам: тыс. т/год — слева, млн м³/год — справа (без пересчёта единиц).
  const { axes, unplotted } = assignAxes(uniqueSeries.map((s) => ({ product: s.product, unit: unitOf(s.product) })));
  const sides = (['left', 'right'] as const).filter((side) => axes[side]);
  const sideOf = (p: ProductType): AxisSide | undefined => sides.find((side) => axes[side]!.products.includes(p));
  // Линия ограничения — по основной (левой, если есть) шкале, как и раньше по единственной.
  const primary = sides[0];

  const dataMax = (side: AxisSide) =>
    Math.max(
      side === primary ? (profile.limit ?? 0) : 0,
      ...uniqueSeries.filter((s) => sideOf(s.product) === side).flatMap((s) => s.points.map((p) => p.value)),
    );
  const intervals = chooseIntervals(sides.map(dataMax));
  const scales: Partial<Record<AxisSide, AxisScale>> = {};
  for (const side of sides) scales[side] = niceScale(dataMax(side), intervals);
  const gridTicks = primary ? scales[primary]!.ticks.slice(1) : [];

  const plotted = uniqueSeries.filter((s) => sideOf(s.product));
  const heightPct = (s: ProductSeries, v: number) => {
    const side = sideOf(s.product);
    return side ? Math.min(100, (v / scales[side]!.max) * 100) : 0;
  };

  const describe = (year: number) =>
    plotted
      .map((s) => `${PRODUCT_LABEL[s.product]} ${formatNum(valueAt(s, year))} ${prettyUnit(unitOf(s.product))}`)
      .join(', ');

  return (
    <div className="pp-chart">
      <div className="pp-chart__head">
        <span className="pp-chart__eyebrow">{profile.measureLabel.toUpperCase()}</span>
        {profile.limit != null && primary && (
          <span className="pp-chart__limit">
            Ограничение {formatNum(profile.limit)}
          </span>
        )}
      </div>

      {/* Единицы шкал с маркерами рядов: видно, какой продукт читается по какой шкале */}
      <div className="pp-chart__units">
        {sides.map((side) => (
          <span key={side} className={`pp-chart__unit pp-chart__unit--${side}`}>
            {axes[side]!.products.map((p) => (
              <span
                key={p}
                className="pp-chart__unit-swatch"
                style={{ background: PRODUCT_COLOR[p] }}
                title={PRODUCT_LABEL[p]}
                aria-hidden="true"
              />
            ))}
            {prettyUnit(axes[side]!.unit)}
          </span>
        ))}
      </div>

      <div className="pp-chart__frame">
        {sides.map((side) => {
          const scale = scales[side]!;
          const labels = scale.ticks.map((t) => formatTick(t.value, scale.decimals));
          const widthCh = Math.max(...labels.map((l) => l.length));
          return (
            <div
              key={side}
              className={`pp-chart__scale pp-chart__scale--${side}`}
              style={{ width: `calc(${widthCh}ch + 6px)` }}
              aria-hidden="true"
            >
              {scale.ticks.map((t, i) => (
                <span key={t.value} className="pp-chart__tick" style={{ bottom: `${t.fraction * 100}%` }}>
                  {labels[i]}
                </span>
              ))}
            </div>
          );
        })}

        <div className="pp-chart__plot">
          {gridTicks.map((t) => (
            <span
              key={t.value}
              className="pp-chart__grid"
              style={{ bottom: `${t.fraction * 100}%` }}
              aria-hidden="true"
            />
          ))}
          {profile.limit != null && primary && (
            <span
              className="pp-chart__limit-line"
              style={{ bottom: `${Math.min(100, (profile.limit / scales[primary]!.max) * 100)}%` }}
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
                aria-label={`${year}: ${describe(year)}`}
              >
                {plotted.map((s) => (
                  <span
                    key={s.product}
                    className="pp-chart__bar"
                    style={{ height: `${heightPct(s, valueAt(s, year))}%`, background: PRODUCT_COLOR[s.product] }}
                  />
                ))}
              </button>
            ))}
          </div>
          {hoverYear != null && (
            <div className="pp-chart__tooltip">
              <span className="pp-chart__tooltip-date">01.01.{hoverYear}</span>
              {plotted.map((s) => (
                <span className="pp-chart__tooltip-row" key={s.product}>
                  <span className="pp-chart__tooltip-swatch" style={{ background: PRODUCT_COLOR[s.product] }} />
                  {PRODUCT_LABEL[s.product]}: <b>{formatNum(valueAt(s, hoverYear))}</b>{' '}
                  {prettyUnit(unitOf(s.product))}
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

      {unplotted.length > 0 && (
        <p className="pp-chart__note" role="note">
          Не показаны на графике (единица не совпадает со шкалами):{' '}
          {unplotted.map((u) => `${PRODUCT_LABEL[u.product]} (${prettyUnit(u.unit) || 'ед. не задана'})`).join(', ')}.
          Значения — во вкладке «Таблица».
        </p>
      )}
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
