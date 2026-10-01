/**
 * Вкладка «Период работы»: период объекта (ввод/вывод, источник),
 * таймлайн периодов эксплуатации и таблица периодов вывода из эксплуатации.
 */
import { useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import type { ParameterPanelKind, ShutdownPeriod, WorkPeriod } from '../../domain/types';
import { PanelSection, PropertyRow } from './parts';

export function CalendarTab({
  period,
  panelKind,
  onChangeShutdowns,
}: {
  period: WorkPeriod | null;
  /** Род объекта — влияет на оформление (у трубопровода больше отступ таймлайна) */
  panelKind?: ParameterPanelKind;
  /** Сохранить изменённый список периодов вывода */
  onChangeShutdowns?: (shutdowns: ShutdownPeriod[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<ShutdownPeriod>({ start: '', end: '', reason: '' });
  const [formError, setFormError] = useState('');

  const saveShutdown = () => {
    const start = Number(draft.start);
    const end = Number(draft.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < period!.startYear || end > period!.endYear || start > end) {
      setFormError(`Укажите годы от ${period!.startYear} до ${period!.endYear}; начало не позже окончания.`);
      return;
    }
    if (!draft.reason.trim()) {
      setFormError('Укажите причину вывода из эксплуатации.');
      return;
    }
    onChangeShutdowns?.([...period!.shutdowns, { start: String(start), end: String(end), reason: draft.reason.trim() }]);
    setDraft({ start: '', end: '', reason: '' });
    setFormError('');
    setIsAdding(false);
  };
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

      <PanelSection title="Периоды вывода из эксплуатации">
        <button
          type="button"
          className="pp-add-btn pp-period-add"
          aria-label="Добавить период вывода из эксплуатации"
          title="Добавить период вывода из эксплуатации"
          onClick={() => { setIsAdding(true); setFormError(''); }}
        >
          <AppIcon name="plus" size={13} />
        </button>
        {isAdding && (
          <div className="pp-shutdown-form">
            <label>Начало<input type="number" min={period.startYear} max={period.endYear} placeholder="Год" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label>
            <label>Окончание<input type="number" min={period.startYear} max={period.endYear} placeholder="Год" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label>
            <label className="pp-shutdown-form__reason">Причина<input type="text" placeholder="Например, ремонт" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label>
            <div className="pp-shutdown-form__actions">
              <button type="button" className="pp-icon-btn" aria-label="Сохранить период" title="Сохранить период" onClick={saveShutdown}>
                <AppIcon name="save" size={15} />
              </button>
              <button type="button" className="pp-add-btn pp-add-btn--ghost" onClick={() => { setIsAdding(false); setFormError(''); }}>Отмена</button>
            </div>
            {formError && <span className="pp-shutdown-form__error">{formError}</span>}
          </div>
        )}
        <div className="pp-shutdown-table">
          <div className="pp-shutdown-table__head">
            <span>Начало</span>
            <span>Окончание</span>
            <span>Причина</span>
            <span aria-hidden="true" />
          </div>
          {period.shutdowns.length === 0 ? (
            <div className="pp-shutdown-table__row pp-shutdown-table__row--empty">
              <span>д.мм.г</span>
              <span>д.мм.г</span>
              <span>Укажите причину</span>
              <span />
            </div>
          ) : (
            period.shutdowns.map((s, i) => (
              <div className="pp-shutdown-table__row" key={`${s.start}-${s.end}-${i}`}>
                <span>{s.start}</span>
                <span>{s.end}</span>
                <span>{s.reason}</span>
                <button type="button" className="pp-shutdown-table__delete" aria-label={`Удалить период ${s.start}–${s.end}`} title="Удалить период" onClick={() => onChangeShutdowns?.(period.shutdowns.filter((_, index) => index !== i))}>×</button>
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
        {period.shutdowns.map((s, i) => {
          const start = Number(s.start);
          const end = Number(s.end);
          return (
            <span className={`pp-timeline__shutdown pp-timeline__shutdown--${i % 2 === 0 ? 'top' : 'bottom'}`} key={`shutdown-${i}`} style={{ left: `${toPct(start)}%`, width: `${Math.max(toPct(end) - toPct(start), 1.5)}%` }} title={`${s.start}–${s.end}: ${s.reason}`}>
              <span className="pp-timeline__shutdown-label">Вывод {s.start}–{s.end}</span>
            </span>
          );
        })}
        {period.activeRanges.map((r, i) => (
          <span className="pp-timeline__marker" key={`m${i}`} style={{ left: `${toPct(r.start)}%` }}>
            <span className="pp-timeline__marker-label">{r.start}–{r.end}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
