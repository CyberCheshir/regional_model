/**
 * Вкладка «Аналитика»: предупреждения, рекомендации и проверки состояния модели.
 * Точки-индикаторы: зелёный (всё ок), оранжевый (предупреждение), серый (нет данных).
 */
import type { AnalyticsData, AnalyticsItem } from '../../domain/types';
import { PanelSection } from './parts';

export function AnalyticsTab({ data }: { data: AnalyticsData | null }) {
  if (!data) {
    return (
      <PanelSection title="Аналитика">
        <p className="pp-muted">Аналитика для этого объекта недоступна.</p>
      </PanelSection>
    );
  }
  return (
    <>
      <PanelSection title="Предупреждения">
        {data.warnings.length === 0 ? (
          <ItemRow
            item={{ level: 'info', title: 'Критических предупреждений нет', detail: '' }}
          />
        ) : (
          data.warnings.map((w, i) => <ItemRow key={i} item={w} />)
        )}
      </PanelSection>

      <PanelSection title="Рекомендации">
        {data.recommendations.length === 0 ? (
          <p className="pp-muted">Рекомендаций нет.</p>
        ) : (
          data.recommendations.map((r, i) => <ItemRow key={i} item={r} />)
        )}
      </PanelSection>

      <PanelSection title="Состояние модели">
        {data.modelChecks.map((c, i) => (
          <ItemRow key={i} item={c} />
        ))}
      </PanelSection>
    </>
  );
}

/** Строка аналитики с цветным индикатором уровня. */
function ItemRow({ item }: { item: AnalyticsItem }) {
  const levelClass =
    item.level === 'warning' ? 'warning' : item.level === 'none' ? 'none' : 'ok';
  return (
    <div className={'pp-note pp-note--' + levelClass}>
      <span className="pp-note__dot" aria-hidden="true" />
      <div className="pp-note__body">
        <span className="pp-note__title">{item.title}</span>
        {item.detail && <span className="pp-note__detail">{item.detail}</span>}
      </div>
    </div>
  );
}
