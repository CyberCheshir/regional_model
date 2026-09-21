/**
 * Вкладка «Гидравлический расчёт» (только трубопровод): состояние расчёта,
 * расчётный период, последний расчёт, готовность модели и переход в расчёт.
 */
import { AppIcon } from '../../components/AppIcon';
import type { HydraulicCalc } from '../../domain/types';
import { ChecklistRow, PanelSection, PropertyRow } from './parts';

const STATE_BADGE: Record<HydraulicCalc['state'], { label: string; className: string }> = {
  actual: { label: 'Актуален', className: 'pp-calc-state--actual' },
  stale: { label: 'Устарел', className: 'pp-calc-state--stale' },
  none: { label: 'Не выполнялся', className: 'pp-calc-state--none' },
};

export function HydraulicTab({
  calc,
  onOpenCalc,
}: {
  calc: HydraulicCalc | null;
  onOpenCalc?: () => void;
}) {
  if (!calc) {
    return (
      <PanelSection title="Гидравлический расчёт">
        <p className="pp-muted">Гидравлический расчёт доступен только для трубопроводов.</p>
      </PanelSection>
    );
  }
  const badge = STATE_BADGE[calc.state];
  return (
    <>
      <PanelSection
        title="Состояние расчёта"
        action={<span className={`pp-calc-state ${badge.className}`}>{badge.label}</span>}
      >
        <PropertyRow label="Расчётный период">{calc.period}</PropertyRow>
        <PropertyRow label="Последний расчёт">{calc.lastRun}</PropertyRow>
      </PanelSection>

      <PanelSection title="Готовность модели">
        {calc.readiness.map((r) => (
          <ChecklistRow key={r.label} level={r.ok ? 'ok' : 'none'} label={r.label} value={r.value} />
        ))}
      </PanelSection>

      <PanelSection title="Переход в расчёт">
        <button type="button" className="pp-primary-btn" onClick={onOpenCalc}>
          Открыть гидравлический расчёт
          <AppIcon name="chevron-right" size={15} />
        </button>
      </PanelSection>
    </>
  );
}
