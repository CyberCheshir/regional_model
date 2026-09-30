import { useMemo, useState } from 'react';
import { useMapDrawing } from '../map/mapDrawing';
import type {
  CalculationHistoryItem,
  CalculationMode,
  CalculationTaskParams,
  ContourFluid,
  HydraulicSectionItem,
  PvtProperties,
} from './types';
import './TaskSetupTab.css';

export type TaskSetupTabProps = {
  /** Возврат к шагу 1 («Выбор контура») */
  onBack?: () => void;
  /** Запуск расчета с переходом к шагу 3 («Результаты») */
  onRun?: (params: CalculationTaskParams) => void;
  /** Выбранный флюид */
  fluid?: ContourFluid;
};

/** Эталонная история запусков расчетов по макету */
const CALCULATION_HISTORY: CalculationHistoryItem[] = [
  {
    id: 'calc-run-14',
    title: 'Расчет #14 · Контур нефти (2026 г.)',
    status: 'success',
    statusLabel: 'Успешно · 12.09.2026 14:32',
    timestamp: '12.09.2026 14:32',
    summary: 'ΔP = 1.48 МПа, P_вх = 2.68 МПа, T_вых = 8.4 °C',
  },
  {
    id: 'calc-run-13',
    title: 'Расчет #13 · Стресс-тест пикового расхода',
    status: 'warning',
    statusLabel: 'Предупреждение · 11.09.2026',
    timestamp: '11.09.2026 18:15',
    summary: 'Превышение допустимой скорости на участке 2 (v = 2.34 м/с)',
  },
  {
    id: 'calc-run-12',
    title: 'Расчет #12 · Контур газа ГП-1',
    status: 'success',
    statusLabel: 'Успешно · 10.09.2026',
    timestamp: '10.09.2026 11:05',
    summary: 'ΔP = 0.82 МПа, P_вх = 4.20 МПа, без гидратообразования',
  },
];

/** Эталонный список расчетных участков по макету */
const MOCK_SECTIONS: HydraulicSectionItem[] = [
  {
    id: 'sec-1',
    name: 'Куст 14 → Врезка 01',
    lengthKm: 14.5,
    diameterMm: '159 × 6.0',
    roughnessMm: 0.04,
    flowRateTDay: 180.0,
  },
  {
    id: 'sec-2',
    name: 'Врезка 01 → УПН-2',
    lengthKm: 28.3,
    diameterMm: '219 × 8.0',
    roughnessMm: 0.04,
    flowRateTDay: 420.0,
  },
];

export function TaskSetupTab({ onBack, onRun, fluid = 'oil' }: TaskSetupTabProps) {
  const { segments, pipelines, vertices, taps } = useMapDrawing();

  // Параметры термогидравлического расчета (по макету)
  const [calcYear, setCalcYear] = useState<number>(2026);
  const [calcMode, setCalcMode] = useState<CalculationMode>('thermal');
  const [outletPressureMpa, setOutletPressureMpa] = useState<number>(1.2);
  const [ambientTempC, setAmbientTempC] = useState<number>(2.0);

  // Свойства флюида (нефть по умолчанию)
  const [pvt, setPvt] = useState<PvtProperties>({
    densityKgM3: 845.0,
    viscosityCSt: 14.2,
    gasFactorM3T: 45.0,
    waterCutPct: 12.0,
  });

  const [isRunning, setIsRunning] = useState(false);

  // Формируем список расчетных участков: из реальных сегментов модели либо из макета
  const sections = useMemo<HydraulicSectionItem[]>(() => {
    if (segments.length === 0) {
      return MOCK_SECTIONS;
    }

    const nodeNameMap = new Map<string, string>();
    for (const v of vertices) nodeNameMap.set(v.id, v.label);
    for (const t of taps) nodeNameMap.set(t.id, t.label || 'Врезка');

    return segments.map((seg, idx) => {
      const fromId =
        seg.from.type === 'node'
          ? seg.from.nodeId
          : seg.from.type === 'box'
            ? seg.from.boxId
            : seg.from.type === 'tap'
              ? seg.from.tapId
              : undefined;
      const toId =
        seg.to.type === 'node'
          ? seg.to.nodeId
          : seg.to.type === 'box'
            ? seg.to.boxId
            : seg.to.type === 'tap'
              ? seg.to.tapId
              : undefined;

      const fromName = (fromId && nodeNameMap.get(fromId)) || `Узел ${idx * 2 + 1}`;
      const toName = (toId && nodeNameMap.get(toId)) || `Узел ${idx * 2 + 2}`;
      const pipe = pipelines.find((p) => p.id === seg.pipelineId);
      const name = seg.label || (pipe ? `${fromName} → ${toName}` : `Участок ${idx + 1}`);

      const roughness =
        (seg.attributes?.roughness_mm as number) || (pipe?.attributes?.roughness_mm as number) || 0.04;

      const lenM = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
      const lengthKm = lenM > 0 ? Math.round((lenM / 1000) * 10) / 10 : 15.0 + idx * 10;
      const diam = (seg.attributes?.diameter_mm as number) || 219;
      const wall = (seg.attributes?.wall_thickness_mm as number) || 8.0;

      return {
        id: seg.id,
        name,
        lengthKm,
        diameterMm: `${diam} × ${wall}`,
        roughnessMm: roughness,
        flowRateTDay: 200 + idx * 120,
      };
    });
  }, [segments, pipelines, vertices, taps]);

  // Запуск расчета
  const handleStartCalculation = () => {
    setIsRunning(true);
    const params: CalculationTaskParams = {
      year: calcYear,
      mode: calcMode,
      outletPressureMpa,
      ambientTempC,
      pvt,
      sections,
    };

    setTimeout(() => {
      setIsRunning(false);
      if (onRun) onRun(params);
    }, 600);
  };

  const fluidTitle = fluid === 'gas' ? 'ГАЗ' : fluid === 'water' ? 'ВОДА' : 'НЕФТЬ';

  return (
    <div className="task-setup-tab">
      {/* 1. Левая карточка: Параметры расчета, свойства флюида и участки */}
      <div className="task-setup-tab__card">
        <div className="task-setup-tab__eyebrow">ПАРАМЕТРЫ РАСЧЕТА И ГРАНИЧНЫЕ УСЛОВИЯ</div>

        {/* 4 основных параметра режима расчета */}
        <div className="task-setup-tab__form-grid">
          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Расчетный год:</label>
            <select
              className="task-setup-tab__select"
              value={calcYear}
              onChange={(e) => setCalcYear(Number(e.target.value))}
            >
              {[2026, 2027, 2028, 2029, 2030, 2035, 2040, 2046].map((y) => (
                <option key={y} value={y}>
                  {y} год
                </option>
              ))}
            </select>
          </div>

          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Режим расчета:</label>
            <select
              className="task-setup-tab__select"
              value={calcMode}
              onChange={(e) => setCalcMode(e.target.value as CalculationMode)}
            >
              <option value="thermal">Установившийся (термогидравлика)</option>
              <option value="isothermal">Изотермический режим</option>
              <option value="quasisteady">Квазистационарный режим</option>
            </select>
          </div>

          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Граничное давление в стоке (P_вых):</label>
            <div className="task-setup-tab__input-wrap">
              <input
                type="number"
                step="0.1"
                className="task-setup-tab__input"
                value={outletPressureMpa}
                onChange={(e) => setOutletPressureMpa(parseFloat(e.target.value) || 0)}
              />
              <span className="task-setup-tab__unit">МПа</span>
            </div>
          </div>

          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Температура окружающей среды (T_грунта):</label>
            <div className="task-setup-tab__input-wrap">
              <input
                type="number"
                step="0.5"
                className="task-setup-tab__input"
                value={ambientTempC}
                onChange={(e) => setAmbientTempC(parseFloat(e.target.value) || 0)}
              />
              <span className="task-setup-tab__unit">°C</span>
            </div>
          </div>
        </div>

        {/* Свойства флюида */}
        <div className="task-setup-tab__section-title">СВОЙСТВА ФЛЮИДА ({fluidTitle})</div>

        <div className="task-setup-tab__form-grid">
          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Плотность (при 20°C):</label>
            <div className="task-setup-tab__input-wrap">
              <input
                type="number"
                step="0.5"
                className="task-setup-tab__input"
                value={pvt.densityKgM3}
                onChange={(e) =>
                  setPvt((prev) => ({ ...prev, densityKgM3: parseFloat(e.target.value) || 0 }))
                }
              />
              <span className="task-setup-tab__unit">кг/м³</span>
            </div>
          </div>

          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Вязкость кинематическая (при 20°C):</label>
            <div className="task-setup-tab__input-wrap">
              <input
                type="number"
                step="0.1"
                className="task-setup-tab__input"
                value={pvt.viscosityCSt}
                onChange={(e) =>
                  setPvt((prev) => ({ ...prev, viscosityCSt: parseFloat(e.target.value) || 0 }))
                }
              />
              <span className="task-setup-tab__unit">сСт</span>
            </div>
          </div>

          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Газовый фактор (ГФ):</label>
            <div className="task-setup-tab__input-wrap">
              <input
                type="number"
                step="1"
                className="task-setup-tab__input"
                value={pvt.gasFactorM3T}
                onChange={(e) =>
                  setPvt((prev) => ({ ...prev, gasFactorM3T: parseFloat(e.target.value) || 0 }))
                }
              />
              <span className="task-setup-tab__unit">м³/т</span>
            </div>
          </div>

          <div className="task-setup-tab__field">
            <label className="task-setup-tab__label">Обводненность:</label>
            <div className="task-setup-tab__input-wrap">
              <input
                type="number"
                step="0.5"
                className="task-setup-tab__input"
                value={pvt.waterCutPct}
                onChange={(e) =>
                  setPvt((prev) => ({ ...prev, waterCutPct: parseFloat(e.target.value) || 0 }))
                }
              />
              <span className="task-setup-tab__unit">%</span>
            </div>
          </div>
        </div>

        {/* Список расчетных участков */}
        <div className="task-setup-tab__section-title">СПИСОК РАСЧЕТНЫХ УЧАСТКОВ</div>

        <div className="task-setup-tab__table-wrap">
          <table className="task-setup-tab__table">
            <thead>
              <tr>
                <th>Участок</th>
                <th>Длина, км</th>
                <th>Диаметр, мм</th>
                <th>Шероховатость, мм</th>
                <th>Расход, т/сут</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <tr key={sec.id}>
                  <td className="task-setup-tab__col-name">{sec.name}</td>
                  <td className="task-setup-tab__col-num">{sec.lengthKm}</td>
                  <td className="task-setup-tab__col-num">{sec.diameterMm}</td>
                  <td className="task-setup-tab__col-num">{sec.roughnessMm}</td>
                  <td className="task-setup-tab__col-num" style={{ fontWeight: 600, color: '#0f172a' }}>
                    {sec.flowRateTDay.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Нижние кнопки действий */}
        <div className="task-setup-tab__actions">
          {onBack && (
            <button type="button" className="task-setup-tab__btn-back" onClick={onBack}>
              ← Вернуться к выбору контура
            </button>
          )}

          <button
            type="button"
            className="task-setup-tab__btn-run"
            disabled={isRunning || sections.length === 0}
            onClick={handleStartCalculation}
          >
            {isRunning ? '⏳ Выполняется расчет...' : '▶ Запустить гидравлический расчет'}
          </button>
        </div>
      </div>

      {/* 2. Правая колонка: Валидация граничных условий и История */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Карточка 1: Валидация граничных условий */}
        <div className="task-setup-tab__card">
          <div className="task-setup-tab__eyebrow">ВАЛИДАЦИЯ ГРАНИЧНЫХ УСЛОВИЙ</div>
          <h2 className="task-setup-tab__heading">Готовность к запуску</h2>

          <div className="task-setup-tab__checklist">
            <div className="task-setup-tab__check-item">
              <span className="task-setup-tab__check-icon">✓</span>
              <div>
                <h4 className="task-setup-tab__check-title">Расход в узле входа задан</h4>
                <p className="task-setup-tab__check-detail">
                  {sections[0]?.name?.split('→')[0]?.trim() || 'Куст 14'}: {sections[0]?.flowRateTDay || 180} т/сут
                </p>
              </div>
            </div>

            <div className="task-setup-tab__check-item">
              <span className="task-setup-tab__check-icon">✓</span>
              <div>
                <h4 className="task-setup-tab__check-title">Давление в узле приема задано</h4>
                <p className="task-setup-tab__check-detail">
                  Узел приема: {outletPressureMpa.toFixed(1)} МПа
                </p>
              </div>
            </div>

            <div className="task-setup-tab__check-item">
              <span className="task-setup-tab__check-icon">✓</span>
              <div>
                <h4 className="task-setup-tab__check-title">Высотные отметки (пикетаж) загружены</h4>
                <p className="task-setup-tab__check-detail">
                  Профиль трассы:{' '}
                  {sections.reduce((acc, s) => acc + s.lengthKm, 0).toFixed(1)} км
                </p>
              </div>
            </div>

            <div className="task-setup-tab__check-item">
              <span className="task-setup-tab__check-icon">✓</span>
              <div>
                <h4 className="task-setup-tab__check-title">PVT-свойства определены</h4>
                <p className="task-setup-tab__check-detail">
                  Плотность {pvt.densityKgM3} кг/м³, вязкость {pvt.viscosityCSt} сСт
                </p>
              </div>
            </div>
          </div>

          <div className="task-setup-tab__status-banner">
            <span className="task-setup-tab__status-dot" />
            <span>Все параметры корректны (ошибок нет)</span>
          </div>
        </div>

        {/* Карточка 2: История и статус расчетов */}
        <div className="task-setup-tab__card">
          <div className="task-setup-tab__eyebrow">ИСТОРИЯ И СТАТУС РАСЧЕТОВ</div>
          <h2 className="task-setup-tab__heading">Предыдущие расчеты</h2>

          <div className="task-setup-tab__history">
            {CALCULATION_HISTORY.map((item) => (
              <div key={item.id} className="task-setup-tab__history-card">
                <div className="task-setup-tab__history-head">
                  <span className="task-setup-tab__history-title">{item.title}</span>
                  <span
                    className={`task-setup-tab__history-badge task-setup-tab__history-badge--${item.status}`}
                  >
                    {item.status === 'success' ? 'Успешно' : 'Предупреждение'}
                  </span>
                </div>
                <p className="task-setup-tab__history-summary">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
