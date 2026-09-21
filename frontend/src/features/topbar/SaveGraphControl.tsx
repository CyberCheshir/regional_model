import { useState } from 'react';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { SAVE_START_PROGRESS, useSaveGraph, type SaveProgress } from '../../api/useSaveGraph';
import { useMapDrawing } from '../map/mapDrawing';
import { ScenarioDialog } from './ScenarioDialog';
import './SaveGraphControl.css';

/**
 * Кнопка «Сохранить» + индикатор прогресса.
 *
 * Данные берёт напрямую из domain layer подсистемы рисования (`useMapDrawing`):
 * нарисованные объекты (vertices), рёбра (segments), трубопроводы (pipelines),
 * лицензионные участки (areas) — и асинхронно записывает их в БД
 * (POST /api/map/save/), показывая процесс по этапам.
 */
export function SaveGraphControl() {
  const { vertices, segments, pipelines, areas, taps } = useMapDrawing();
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [summary, setSummary] = useState('');
  // Диалог ввода имени сценария при сохранении.
  const [dialogOpen, setDialogOpen] = useState(false);
  // Имя текущего сценария (последнее сохранённое) — подставляется в диалог.
  const [scenarioName, setScenarioName] = useState('');

  const mutation = useSaveGraph({ onProgress: (p) => setProgress(p) });

  /** Сохранить граф под указанным именем проекта. */
  const saveAs = (name: string) => {
    setDialogOpen(false);
    setScenarioName(name);
    setSummary('');
    setProgress(SAVE_START_PROGRESS);
    mutation.mutate(
      { vertices, segments, pipelines, areas, taps, projectName: name },
      {
        onSuccess: (data) => {
          const c = data.counts;
          setSummary(`${c.facilities} об. / ${c.nodes} уз. / ${c.segments} сегм.`);
        },
      },
    );
  };

  const saving = mutation.isPending;
  const failed = progress?.stage === 'error';
  const done = progress?.stage === 'done';
  const total = vertices.length + segments.length + areas.length;

  return (
    <div className="save-control">
      <button
        type="button"
        className="save-control__button"
        onClick={() => setDialogOpen(true)}
        disabled={saving || total === 0}
        title={total === 0 ? 'Нечего сохранять — нарисуйте объекты или рёбра' : 'Сохранить модель в БД'}
      >
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>

      {/* Диалог выбора имени сценария перед сохранением */}
      <ScenarioDialog
        open={dialogOpen}
        initialName={scenarioName}
        onConfirm={saveAs}
        onCancel={() => setDialogOpen(false)}
      />

      {/* Прогрессбар процесса сохранения (появляется при сохранении/ошибке) */}
      {progress && (saving || failed || done) && (
        <div className={`save-control__popover${failed ? ' is-error' : ''}`}>
          <ProgressBar value={progress.value} label={progress.label} />
          {done && !failed && summary && (
            <span className="save-control__summary">{summary}</span>
          )}
        </div>
      )}
    </div>
  );
}
