import { useState } from 'react';
import type { CalculationTaskParams, ContourFluid, HydraulicTabId } from './types';
import { ContourTab } from './ContourTab';
import { TaskSetupTab } from './TaskSetupTab';
import { ResultsTab } from './ResultsTab';
import './HydraulicCalcView.css';

export type HydraulicCalcViewProps = {
  /** Возврат к карте */
  onNavigateToMap?: () => void;
};

export function HydraulicCalcView({ onNavigateToMap }: HydraulicCalcViewProps) {
  const [activeTab, setActiveTab] = useState<HydraulicTabId>('contour');
  const [selectedFluid, setSelectedFluid] = useState<ContourFluid>('oil');
  const [calcParams, setCalcParams] = useState<CalculationTaskParams | null>(null);

  return (
    <div className="hydraulic-calc">
      {/* 1. Шапка модуля гидравлических расчетов */}
      <header className="hydraulic-calc__header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 className="hydraulic-calc__title" style={{ margin: 0 }}>Гидравлические расчеты</h1>
          {onNavigateToMap && (
            <button
              type="button"
              className="profiles-tab__btn-export"
              onClick={onNavigateToMap}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              ← Вернуться к карте
            </button>
          )}
        </div>
        <p className="hydraulic-calc__subtitle">
          Моделирование режимов транспорта флюидов, расчет давлений и температур.
        </p>

        {/* Навигационные вкладки шагов расчета */}
        <nav className="hydraulic-calc__tabs" role="tablist">
          <button
            type="button"
            className={`hydraulic-calc__tab-btn${activeTab === 'contour' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('contour')}
            role="tab"
            aria-selected={activeTab === 'contour'}
          >
            Выбор контура
            {activeTab === 'contour' && <span className="hydraulic-calc__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`hydraulic-calc__tab-btn${activeTab === 'task' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('task')}
            role="tab"
            aria-selected={activeTab === 'task'}
          >
            Постановка задачи
            {activeTab === 'task' && <span className="hydraulic-calc__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`hydraulic-calc__tab-btn${activeTab === 'results' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('results')}
            role="tab"
            aria-selected={activeTab === 'results'}
          >
            Результаты
            {activeTab === 'results' && <span className="hydraulic-calc__tab-indicator" />}
          </button>
        </nav>
      </header>

      {/* 2. Контентная область активного шага */}
      <main className="hydraulic-calc__content">
        {activeTab === 'contour' && (
          <ContourTab
            fluid={selectedFluid}
            onFluidChange={setSelectedFluid}
            onNext={() => setActiveTab('task')}
          />
        )}

        {activeTab === 'task' && (
          <TaskSetupTab
            fluid={selectedFluid}
            onBack={() => setActiveTab('contour')}
            onRun={(params) => {
              setCalcParams(params);
              setActiveTab('results');
            }}
          />
        )}

        {activeTab === 'results' && (
          <ResultsTab
            params={calcParams}
            onBackToTask={() => setActiveTab('task')}
          />
        )}
      </main>
    </div>
  );
}
