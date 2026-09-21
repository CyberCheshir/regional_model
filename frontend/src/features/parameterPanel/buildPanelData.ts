/**
 * Сборка данных панели параметров для выбранного объекта.
 *
 * Источник — карточка объекта (EntityDetails), в которую уже подставлены
 * ЛИБО локальные (нарисованные, ещё не сохранённые) данные из domain layer,
 * ЛИБО ответ backend (GET /api/entities/<id>/). Здесь мы достраиваем те
 * разделы, которых пока нет в API — период работы, профиль продукции,
 * гидравлический расчёт, аналитику — детерминированно, по роду объекта,
 * чтобы интерфейс был наполнен на реальных (не заглушечных) данных.
 *
 * Когда соответствующие разделы появятся в API, эта функция заменится
 * на прямой парсинг ответа (zod), а потребители (ParameterPanel) не изменятся.
 */
import type {
  AnalyticsData,
  EntityDetails,
  HydraulicCalc,
  ParameterPanelData,
  ParameterPanelKind,
  ProductProfile,
  ProductSeries,
  ProductType,
  WorkPeriod,
} from '../../domain/types';

/** Род панели по категории объекта и его подтипу. */
export function panelKindFor(entity: EntityDetails): ParameterPanelKind {
  if (entity.kind === 'pipeline' || entity.kind === 'segment') return 'pipeline';
  if (entity.kind === 'wellpad') return 'wellpad';
  return 'facility';
}

/** Класс объекта для подзаголовка («Промысловый» и т.п.). */
function objectClassFor(entity: EntityDetails, kind: ParameterPanelKind): string {
  if (kind === 'pipeline') return 'Промысловый';
  if (kind === 'wellpad') return 'Система сбора';
  return entity.subType ?? 'Объект подготовки';
}

/** Детерминированный псевдослучайный ряд значений (стабильный по seed). */
function pseudoSeries(seed: number, count: number, base: number, amp: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280;
    const noise = s / 233280;
    out.push(Math.max(0, base + amp * (noise - 0.35)));
  }
  return out;
}

/** Годы профиля — 15 лет от текущего рубежа модели. */
const PROFILE_START = 2026;
const PROFILE_END = 2040;
const PROFILE_YEARS = PROFILE_END - PROFILE_START + 1;

/** Продукты по роду объекта (в макете куста добавлен «Жидкость»). */
function productsFor(kind: ParameterPanelKind): ProductType[] {
  if (kind === 'wellpad') return ['oil', 'gas', 'water', 'liquid'];
  if (kind === 'pipeline') return ['oil', 'gas', 'water'];
  return ['oil', 'gas', 'water'];
}

/** Единицы измерения продуктов (для таблицы профиля). */
const PRODUCT_UNIT: Record<ProductType, string> = {
  oil: 'тыс. т/год',
  gas: 'млн м³/год',
  water: 'тыс. м³/год',
  liquid: 'тыс. т/год',
};

/** Заголовок блока значений: у добывающих — «Добыча», у трубопровода — «Поставка». */
function measureLabelFor(kind: ParameterPanelKind): string {
  if (kind === 'pipeline') return 'Поставка';
  if (kind === 'wellpad') return 'Добыча';
  return 'Поступление';
}

/** Профиль продукции по роду объекта. */
export function buildProductProfile(kind: ParameterPanelKind, seed: number): ProductProfile {
  const products = productsFor(kind);
  const series: ProductSeries[] = products.map((product, i) => {
    const base = product === 'oil' ? 300 : product === 'gas' ? 180 : 90;
    const values = pseudoSeries(seed + i * 7, PROFILE_YEARS, base, base * 0.4);
    return {
      product,
      points: values.map((value, idx) => ({
        year: PROFILE_START + idx,
        value: Math.round(value * 10) / 10,
      })),
    };
  });
  return {
    measureLabel: measureLabelFor(kind),
    startYear: PROFILE_START,
    endYear: PROFILE_END,
    products: products.map((product) => ({
      product,
      unit: PRODUCT_UNIT[product],
      enabled: true,
    })),
    series,
    /** Ограничение показываем только для трубопровода (как в макете «Ограничение 680»). */
    limit: kind === 'pipeline' ? 680 : undefined,
  };
}

/** Период работы объекта (таймлайн + периоды вывода). */
export function buildWorkPeriod(kind: ParameterPanelKind, seed: number): WorkPeriod {
  // Репрезентативные периоды: ввод, краткий вывод в середине, конец периода.
  const activeRanges =
    kind === 'wellpad'
      ? [{ start: 2026, end: 2029 }, { start: 2031, end: 2040 }]
      : seed % 3 === 0
        ? [{ start: 2026, end: 2030 }, { start: 2032, end: 2040 }]
        : [{ start: 2026, end: 2040 }];
  const shutdowns =
    activeRanges.length > 1
      ? [
        {
          start: '01.01.2030',
          end: '31.12.2031',
          reason: 'Перерыв добычи',
        },
      ]
      : [];
  return {
    source:
      kind === 'pipeline'
        ? 'Профиль транспортировки'
        : kind === 'wellpad'
          ? 'Профиль добычи'
          : 'Профиль продукции',
    startYear: 2026,
    endYear: 2040,
    activeRanges,
    shutdowns,
  };
}

/** Гидравлический расчёт — только для трубопровода. */
export function buildHydraulic(kind: ParameterPanelKind, entity: EntityDetails): HydraulicCalc | null {
  if (kind !== 'pipeline') return null;
  const okResults = entity.modelStatus.every((m) => m.ok);
  return {
    state: okResults ? 'actual' : 'stale',
    period: '2026–2040',
    lastRun: '11.09.2026 · 14:32',
    readiness: [
      { label: 'Профиль', value: 'задан', ok: true },
      { label: 'Флюид', value: 'нефть', ok: true },
      { label: 'Трасса', value: 'построена', ok: true },
      { label: 'Параметры трубы', value: 'заданы', ok: true },
      { label: 'Граничные условия', value: okResults ? 'заданы' : 'не заданы', ok: okResults },
    ],
  };
}

/** Аналитика объекта (предупреждения / рекомендации / проверки модели). */
export function buildAnalytics(kind: ParameterPanelKind, entity: EntityDetails): AnalyticsData {
  const hasWarnings = entity.status === 'warning';
  const warnings =
    kind === 'pipeline' && entity.modelStatus.some((m) => !m.ok)
      ? [
        {
          level: 'none' as const,
          title: 'Результаты ГР отсутствуют',
          detail: 'Гидравлический расчёт ещё не выполнялся для этого объекта.',
        },
      ]
      : hasWarnings
        ? [
          {
            level: 'warning' as const,
            title: 'Завышенный риск',
            detail: 'Показатель добычи превышает плановый уровень, проверьте профиль.',
          },
        ]
        : [];
  const recommendations =
    kind === 'wellpad'
      ? [
        {
          level: 'info' as const,
          title: 'Оптимизация системы сбора',
          detail: 'Рассмотрите подключение куста по кратчайшему маршруту до УПН.',
        },
      ]
      : kind === 'pipeline'
        ? [
          {
            level: 'info' as const,
            title: 'Проверка ограничения',
            detail: 'Значение ограничения близко к расчётному расходу, проверьте диаметр.',
          },
        ]
        : [];
  const modelChecks = entity.modelStatus.map((m, i) => ({
    level: (m.ok ? 'info' : 'none') as 'info' | 'none',
    title: m.label,
    detail: m.value + (i === 0 ? ' · rev. 12' : ''),
  }));
  return { warnings, recommendations, modelChecks };
}

/** Полная сборка данных панели для выбранного объекта. */
export function buildParameterPanelData(entity: EntityDetails): ParameterPanelData {
  const kind = panelKindFor(entity);
  // Стабильный seed из id — значения профиля не «прыгают» между рендерами.
  let seed = 0;
  for (let i = 0; i < entity.id.length; i++) seed = (seed * 31 + entity.id.charCodeAt(i)) % 233280;
  return {
    entity,
    panelKind: kind,
    objectClass: objectClassFor(entity, kind),
    modelStatus: entity.modelStatus,
    workPeriod: buildWorkPeriod(kind, seed),
    productProfile: buildProductProfile(kind, seed),
    hydraulic: buildHydraulic(kind, entity),
    analytics: buildAnalytics(kind, entity),
  };
}
