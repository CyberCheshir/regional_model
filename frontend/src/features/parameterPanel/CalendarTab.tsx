/**
 * Вкладка «Период работы»: период объекта (ввод/вывод, источник),
 * таймлайн периодов эксплуатации и таблица периодов вывода из эксплуатации.
 */
import { AppIcon } from '../../components/AppIcon';
import type { ParameterPanelKind, WorkPeriod } from '../../domain/types';
import { PanelSection, PropertyRow } from './parts';

export function CalendarTab({
  period,
  panelKind,
  onAddShutdown,
}: {
  period: WorkPeriod | null;
  /** Род объекта — влияет на оформление (у трубопровода больше отступ таймлайна) */
  panelKind?: ParameterPanelKind;
  /** Добавить период вывода (заготовка — открывает ввод строки) */
  onAddShutdown?: () => void;
}) {
  if (!period) {
    return (
      <PanelSection title="Период работы">
        <p className="pp-muted">Период работы для этого объекта не задан.</p>
      </PanelSection>
    );
  }

  return (
    <>
      <PanelSection title="Период объекта">
        <PropertyRow label="Ввод в эксплуатацию">{period.startYear}</PropertyRow>
        <PropertyRow label="Вывод из эксплуатации">{period.endYear}</PropertyRow>
        <PropertyRow label="Источник">{period.source}</PropertyRow>
      </PanelSection>

      <PanelSection title="Периоды эксплуатации">
        <Timeline period={period} panelKind={panelKind} />
        <div className="pp-timeline__axis">
          <span>{period.startYear}</span>
          <span>{period.endYear}</span>
        </div>
      </PanelSection>

      <PanelSection
        title="Периоды вывода из эксплуатации"
        action={
          <button type="button" className="pp-add-btn" onClick={onAddShutdown}>
            <AppIcon name="plus" size={13} />
            Добавить период
          </button>
        }
      >
        <div className="pp-shutdown-table">
          <div className="pp-shutdown-table__head">
            <span>Начало</span>
            <span>Окончание</span>
            <span>Причина</span>
          </div>
          {period.shutdowns.length === 0 ? (
            <div className="pp-shutdown-table__row pp-shutdown-table__row--empty">
              <span>д.мм.г</span>
              <span>д.мм.г</span>
              <span>Укажите причину</span>
            </div>
          ) : (
            period.shutdowns.map((s, i) => (
              <div className="pp-shutdown-table__row" key={`${s.start}-${i}`}>
                <span>{s.start}</span>
                <span>{s.end}</span>
                <span>{s.reason}</span>
              </div>
            ))
          )}
        </div>
      </PanelSection>
    </>
  );
}

/** Полоса таймлайна с отрезками активной эксплуатации и подписями. */
function Timeline({ period, panelKind }: { period: WorkPeriod; panelKind?: ParameterPanelKind }) {
  const span = period.endYear - period.startYear || 1;
  const toPct = (year: number) => ((year - period.startYear) / span) * 100;
  return (
    <div className={'pp-timeline' + (panelKind === 'pipeline' ? ' pp-timeline--pipeline' : '')}>
      <div className="pp-timeline__track">
        {period.activeRanges.map((r, i) => (
          <span
            className="pp-timeline__range"
            key={i}
            style={{ left: `${toPct(r.start)}%`, width: `${toPct(r.end) - toPct(r.start)}%` }}
          />
        ))}
        {period.activeRanges.map((r, i) => (
          <span className="pp-timeline__marker" key={`m${i}`} style={{ left: `${toPct(r.start)}%` }}>
            <span className="pp-timeline__marker-label">
              {r.start}–{r.end}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
