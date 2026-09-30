import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import type { AnalyticsTabId } from './types';
import { OverviewTab } from './OverviewTab';
import { WarningsTab } from './WarningsTab';
import { RecommendationsTab } from './RecommendationsTab';
import { ScenariosTab } from './ScenariosTab';
import { RoadmapsTab } from './RoadmapsTab';
import { downloadJsonFile } from '../../domain';
import '../../components/ui/ui.css';
import './AnalyticsView.css';

export type AnalyticsViewProps = {
  /** Возврат к карте */
  onNavigateToMap?: () => void;
};

/** Вкладки модуля: подписи и порядок в одном месте (вместо пяти копий разметки). */
const TABS: ReadonlyArray<{ id: AnalyticsTabId; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'warnings', label: 'Предупреждения' },
  { id: 'recommendations', label: 'Рекомендации' },
  { id: 'scenarios', label: 'Сравнение сценариев' },
  { id: 'roadmaps', label: 'Дорожные карты' },
];

/** Состав выгружаемого отчёта. */
type ExportSections = { risks: boolean; roadmap: boolean; profiles: boolean };

const EXPORT_SECTIONS: ReadonlyArray<{ key: keyof ExportSections; label: string }> = [
  { key: 'risks', label: 'Отчет по предупреждениям и рискам' },
  { key: 'roadmap', label: 'Дорожная карта мероприятий' },
  { key: 'profiles', label: 'Производственные профили сценариев' },
];

const EXPORT_FORMATS = [
  { value: 'excel' as const, label: 'Excel (.xlsx / .json)' },
  { value: 'pdf' as const, label: 'PDF документ' },
];


export function AnalyticsView({ onNavigateToMap }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('overview');
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string>('rec-1');

  // Состояние модального окна «Выгрузить результаты»
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSections, setExportSections] = useState<ExportSections>({
    risks: true,
    roadmap: true,
    profiles: true,
  });
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');

  const handleExecuteExport = () => {
    const reportData = {
      title: 'Аналитический отчет по сценарию',
      generatedAt: new Date().toLocaleString('ru-RU'),
      includedSections: {
        risksAndWarnings: exportSections.risks,
        roadmap: exportSections.roadmap,
        productionProfiles: exportSections.profiles,
      },
      format: exportFormat,
    };
    downloadJsonFile(reportData, `Аналитический_отчет_${Date.now()}`);
    setIsExportModalOpen(false);
  };

  const toggleExportSection = (key: keyof ExportSections) => {
    setExportSections((prev) => ({ ...prev, [key]: !prev[key] }));
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
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`analytics-module__tab-btn${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
              >
                {tab.label}
                {isActive && <span className="analytics-module__tab-indicator" />}
              </button>
            );
          })}
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
      <Modal
        open={isExportModalOpen}
        title="Выгрузить результаты"
        onClose={() => setIsExportModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={() => setIsExportModalOpen(false)}
            >
              Отмена
            </button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={handleExecuteExport}>
              Выгрузить отчет
            </button>
          </>
        }
      >
        <p className="ui-modal__desc">
          Выберите состав аналитического пакета для формирования итогового отчета:
        </p>

        <div className="ui-choice-group">
          {EXPORT_SECTIONS.map((section) => (
            <label key={section.key} className="ui-choice">
              <input
                type="checkbox"
                className="ui-checkbox"
                checked={exportSections[section.key]}
                onChange={() => toggleExportSection(section.key)}
              />
              <span>{section.label}</span>
            </label>
          ))}
        </div>

        <div className="ui-choice-group--inline">
          <span className="ui-stat__label">Формат:</span>
          {EXPORT_FORMATS.map((format) => (
            <label key={format.value} className="ui-choice">
              <input
                type="radio"
                name="export-format"
                checked={exportFormat === format.value}
                onChange={() => setExportFormat(format.value)}
              />
              <span>{format.label}</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
