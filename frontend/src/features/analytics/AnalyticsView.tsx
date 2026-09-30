import { useState } from 'react';
import type { AnalyticsTabId } from './types';
import { OverviewTab } from './OverviewTab';
import { WarningsTab } from './WarningsTab';
import { RecommendationsTab } from './RecommendationsTab';
import { ScenariosTab } from './ScenariosTab';
import { RoadmapsTab } from './RoadmapsTab';
import { downloadJsonFile } from '../../domain';
import './AnalyticsView.css';

export type AnalyticsViewProps = {
  /** Возврат к карте */
  onNavigateToMap?: () => void;
};

export function AnalyticsView({ onNavigateToMap }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('overview');
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string>('rec-1');

  // Состояние модального окна «Выгрузить результаты»
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportRisks, setExportRisks] = useState(true);
  const [exportRoadmap, setExportRoadmap] = useState(true);
  const [exportProfiles, setExportProfiles] = useState(true);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  const handleExecuteExport = () => {
    const reportData = {
      title: 'Аналитический отчет по сценарию',
      generatedAt: new Date().toLocaleString('ru-RU'),
      includedSections: {
        risksAndWarnings: exportRisks,
        roadmap: exportRoadmap,
        productionProfiles: exportProfiles,
      },
      format: exportFormat,
    };
    downloadJsonFile(reportData, `Аналитический_отчет_${Date.now()}`);
    setIsExportModalOpen(false);
  };

  return (
    <div className="analytics-module">
      {/* 1. Шапка модуля аналитики */}
      <header className="analytics-module__header">
        <div className="analytics-module__top-row">
          <h1 className="analytics-module__title">Аналитика</h1>

          <div className="analytics-module__actions">
            <button
              type="button"
              className="analytics-module__btn-export"
              onClick={() => setIsExportModalOpen(true)}
            >
              Выгрузить результаты
            </button>
            {onNavigateToMap && (
              <button
                type="button"
                className="analytics-module__btn-back"
                onClick={onNavigateToMap}
              >
                ← К карте
              </button>
            )}
          </div>
        </div>

        <p className="analytics-module__subtitle">
          Предупреждения и рекомендации по иерархии модели, сравнение рассчитанных сценариев и дорожные карты.
        </p>

        {/* Навигационные вкладки подраздела */}
        <nav className="analytics-module__tabs" role="tablist">
          <button
            type="button"
            className={`analytics-module__tab-btn${activeTab === 'overview' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
            role="tab"
            aria-selected={activeTab === 'overview'}
          >
            Обзор
            {activeTab === 'overview' && <span className="analytics-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`analytics-module__tab-btn${activeTab === 'warnings' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('warnings')}
            role="tab"
            aria-selected={activeTab === 'warnings'}
          >
            Предупреждения
            {activeTab === 'warnings' && <span className="analytics-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`analytics-module__tab-btn${activeTab === 'recommendations' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
            role="tab"
            aria-selected={activeTab === 'recommendations'}
          >
            Рекомендации
            {activeTab === 'recommendations' && <span className="analytics-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`analytics-module__tab-btn${activeTab === 'scenarios' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('scenarios')}
            role="tab"
            aria-selected={activeTab === 'scenarios'}
          >
            Сравнение сценариев
            {activeTab === 'scenarios' && <span className="analytics-module__tab-indicator" />}
          </button>

          <button
            type="button"
            className={`analytics-module__tab-btn${activeTab === 'roadmaps' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('roadmaps')}
            role="tab"
            aria-selected={activeTab === 'roadmaps'}
          >
            Дорожные карты
            {activeTab === 'roadmaps' && <span className="analytics-module__tab-indicator" />}
          </button>
        </nav>
      </header>

      {/* 2. Контентная область активного подраздела */}
      <main className="analytics-module__content">
        {activeTab === 'overview' && (
          <OverviewTab
            onOpenWarnings={() => setActiveTab('warnings')}
            onOpenRoadmap={() => setActiveTab('roadmaps')}
          />
        )}

        {activeTab === 'warnings' && (
          <WarningsTab
            onOpenRecommendations={(recId) => {
              if (recId) setSelectedRecommendationId(recId);
              setActiveTab('recommendations');
            }}
            onShowOnMap={onNavigateToMap}
          />
        )}

        {activeTab === 'recommendations' && (
          <RecommendationsTab
            initialRecommendationId={selectedRecommendationId}
            onOpenRoadmap={() => setActiveTab('roadmaps')}
          />
        )}

        {activeTab === 'scenarios' && <ScenariosTab />}

        {activeTab === 'roadmaps' && (
          <RoadmapsTab
            onOpenRecommendation={(recId) => {
              setSelectedRecommendationId(recId);
              setActiveTab('recommendations');
            }}
            onShowOnMap={onNavigateToMap}
          />
        )}
      </main>

      {/* 3. Модальное окно «Выгрузить результаты» */}
      {isExportModalOpen && (
        <div className="analytics-dialog-overlay" onClick={() => setIsExportModalOpen(false)}>
          <div className="analytics-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="analytics-dialog__header">
              <h3 className="analytics-dialog__title">Выгрузить результаты</h3>
              <button
                type="button"
                className="analytics-dialog__close"
                onClick={() => setIsExportModalOpen(false)}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            <div className="analytics-dialog__body">
              <p className="analytics-dialog__desc">
                Выберите состав аналитического пакета для формирования итогового отчета:
              </p>

              <div className="analytics-dialog__checkbox-group">
                <label className="analytics-dialog__label">
                  <input
                    type="checkbox"
                    className="analytics-dialog__checkbox"
                    checked={exportRisks}
                    onChange={(e) => setExportRisks(e.target.checked)}
                  />
                  <span>Отчет по предупреждениям и рискам</span>
                </label>

                <label className="analytics-dialog__label">
                  <input
                    type="checkbox"
                    className="analytics-dialog__checkbox"
                    checked={exportRoadmap}
                    onChange={(e) => setExportRoadmap(e.target.checked)}
                  />
                  <span>Дорожная карта мероприятий</span>
                </label>

                <label className="analytics-dialog__label">
                  <input
                    type="checkbox"
                    className="analytics-dialog__checkbox"
                    checked={exportProfiles}
                    onChange={(e) => setExportProfiles(e.target.checked)}
                  />
                  <span>Производственные профили сценариев</span>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>Формат:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="export-format"
                    checked={exportFormat === 'excel'}
                    onChange={() => setExportFormat('excel')}
                  />
                  <span>Excel (.xlsx / .json)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="export-format"
                    checked={exportFormat === 'pdf'}
                    onChange={() => setExportFormat('pdf')}
                  />
                  <span>PDF документ</span>
                </label>
              </div>
            </div>

            <div className="analytics-dialog__footer">
              <button
                type="button"
                className="analytics-dialog__btn-cancel"
                onClick={() => setIsExportModalOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="analytics-dialog__btn-submit"
                onClick={handleExecuteExport}
              >
                Выгрузить отчет
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
