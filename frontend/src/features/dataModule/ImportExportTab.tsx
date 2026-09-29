import { useRef, useState, useMemo } from 'react';
import { IMPORT_TEMPLATES } from './mockData';
import { useMapDrawing } from '../map/mapDrawing';
import {
  buildElementGroups,
  buildModelObjects,
  downloadDomainObjects,
  downloadCsvFile,
  parseDomainObjectsCSV,
  parsePlatformsFile,
  parseProfilesFile,
  parseElevationsFile,
} from '../../domain';
import './ImportExportTab.css';

export function ImportExportTab() {
  const {
    vertices,
    pipelines,
    segments,
    taps,
    batchUpdateEntityParams,
    applyPlatformCoordinates,
    applyEntityProfiles,
    applyPipelineElevations,
  } = useMapDrawing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTplId, setActiveTplId] = useState<string | null>(null);

  // Список объектов текущей модели из domain layer
  const objects = useMemo(() => {
    const groups = buildElementGroups({ vertices, pipelines, segments, taps });
    const entityParamMap = new Map();
    for (const v of vertices) entityParamMap.set(v.id, v);
    for (const p of pipelines) entityParamMap.set(p.id, p);
    for (const t of taps) entityParamMap.set(t.id, t);
    return buildModelObjects(groups, entityParamMap);
  }, [vertices, pipelines, segments, taps]);

  // Статус последней загрузки (динамический)
  const [lastUpload, setLastUpload] = useState<{
    fileName: string;
    date: string;
    foundCount: number;
    totalCount: number;
    newRows: number;
    conflicts: number;
  }>({
    fileName: 'Профили_ПДИМ.xlsx',
    date: '20.09.2026',
    foundCount: 0,
    totalCount: 0,
    newRows: 0,
    conflicts: 0,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /** Скачивание шаблона или текущей выгрузки через domain layer */
  const handleDownloadTemplate = (tplId: string, filename: string) => {
    // Если есть предзаготовленный образец в /templates/
    if (filename.endsWith('.xlsx')) {
      const a = document.createElement('a');
      a.href = `/templates/${encodeURIComponent(filename)}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.info(`[domain] скачан файл образца: ${filename}`);
      return;
    }

    if (tplId === 'tpl-objects' || tplId === 'tpl-params') {
      downloadDomainObjects(objects, 'csv', filename.replace(/\.(xlsx|csv|json)$/, ''));
      console.info(`[domain] скачан файл объектов из domain layer: ${filename}`);
      return;
    }

    if (tplId === 'tpl-profiles') {
      const csv = 'Наименование;Тип;Продукт;Ед.изм;2026;2027;2028;2029;2030\r\nсистема сбора газа;Добыча;Нефть;тыс.т/год;0;0;0;0;0\r\nсистема сбора жидкости;Добыча;Нефть;тыс.т/год;1347.2;2150.5;2411.3;2311.1;2152.0';
      downloadCsvFile(csv, filename);
      console.info(`[domain] скачан шаблон профилей: ${filename}`);
      return;
    }

    if (tplId === 'tpl-elevations') {
      const csv = 'PipelineID;PipelineName;PointNo;Distance_km;Elevation_m;GroundTemperature_C;SegmentRoughness_mm;InsulationThickness_mm;HeatTransferCoeff_Wm2K\r\nт.вр. - ПСП;т.вр. - ПСП;1;0;312.5;2.5;0.015;50;1.2';
      downloadCsvFile(csv, filename);
      console.info(`[domain] скачан шаблон высотных отметок: ${filename}`);
    }
  };

  /** Обработка выбора файла для загрузки */
  const handleTriggerUpload = (tplId: string) => {
    setActiveTplId(tplId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.info(`[import] обработка загрузки шаблона ${activeTplId || 'custom'}: ${file.name}`);

      // 1. «площадки.xlsx» для объекты и координаты
      if (
        activeTplId === 'tpl-objects' ||
        file.name.toLowerCase().includes('площадк') ||
        file.name.toLowerCase().includes('координат')
      ) {
        const items = await parsePlatformsFile(file);
        if (items.length > 0) {
          const res = applyPlatformCoordinates(items);
          setLastUpload({
            fileName: file.name,
            date: new Date().toLocaleDateString('ru-RU'),
            foundCount: res.updatedCount + res.createdCount,
            totalCount: items.length,
            newRows: res.createdCount,
            conflicts: 0,
          });
          setToastMessage(
            `Импортированы координаты: ${res.updatedCount} обновлено, ${res.createdCount} создано на карте`,
          );
          setTimeout(() => setToastMessage(null), 3500);
          return;
        }
      }

      // 2. «добыча-поставка.xlsx» для профили
      if (
        activeTplId === 'tpl-profiles' ||
        file.name.toLowerCase().includes('добыч') ||
        file.name.toLowerCase().includes('поставк') ||
        file.name.toLowerCase().includes('профил')
      ) {
        const items = await parseProfilesFile(file);
        if (items.length > 0) {
          const res = applyEntityProfiles(items);
          const periodStr = items[0]?.period || '2026–2046';
          setLastUpload({
            fileName: file.name,
            date: new Date().toLocaleDateString('ru-RU'),
            foundCount: res.updatedCount,
            totalCount: items.length,
            newRows: items.length,
            conflicts: 0,
          });
          setToastMessage(`Импортированы профили для ${res.updatedCount} объектов (${periodStr} гг.)`);
          setTimeout(() => setToastMessage(null), 3500);
          return;
        }
      }

      // 3. «параметры по длине трубопроводов.xlsx» для высотные отметки трубопроводов
      if (
        activeTplId === 'tpl-elevations' ||
        file.name.toLowerCase().includes('длин') ||
        file.name.toLowerCase().includes('высот') ||
        file.name.toLowerCase().includes('отметк')
      ) {
        const items = await parseElevationsFile(file);
        if (items.length > 0) {
          const res = applyPipelineElevations(items);
          const totalPoints = items.reduce((acc, it) => acc + it.points.length, 0);
          setLastUpload({
            fileName: file.name,
            date: new Date().toLocaleDateString('ru-RU'),
            foundCount: res.updatedCount,
            totalCount: items.length,
            newRows: totalPoints,
            conflicts: 0,
          });
          setToastMessage(
            `Импортированы высотные отметки для ${res.updatedCount} трубопроводов (${totalPoints} точек трассы)`,
          );
          setTimeout(() => setToastMessage(null), 3500);
          return;
        }
      }

      // 4. Параметры объектов (CSV)
      const text = await file.text();
      const parsedUpdates = parseDomainObjectsCSV(text);

      if (parsedUpdates.length > 0) {
        const targetIds = parsedUpdates.map((u) => u.id);
        const conditionToStatus = (cond?: string): 'running' | 'warning' | 'stopped' => {
          if (cond === 'Остановлен') return 'stopped';
          if (cond === 'Предупреждение') return 'warning';
          return 'running';
        };

        for (const update of parsedUpdates) {
          batchUpdateEntityParams([update.id], {
            owner: update.owner,
            period: update.period,
            condition: update.condition,
            source: update.source,
            status: conditionToStatus(update.condition),
          });
        }

        setLastUpload({
          fileName: file.name,
          date: new Date().toLocaleDateString('ru-RU'),
          foundCount: parsedUpdates.length,
          totalCount: parsedUpdates.length,
          newRows: parsedUpdates.length,
          conflicts: 0,
        });

        setToastMessage(`Импортировано и обновлено ${targetIds.length} объектов в domain layer`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        setToastMessage(`Файл ${file.name} прочитан`);
        setTimeout(() => setToastMessage(null), 2500);
      }
    } catch (err) {
      console.error('[import] ошибка импорта файла:', err);
      setToastMessage(`Ошибка при чтении файла: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="import-tab">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 1. Верхняя информационная карточка */}
      <div className="import-tab__intro-card">
        <h3 className="import-tab__intro-title">Импорт данных по шаблонам ПДИМ</h3>
        <p className="import-tab__intro-desc">
          Все шаблоны и файлы генерируются напрямую из <strong>Domain Layer</strong> модели.
          При загрузке параметры автоматически применяются к сущностям и передаются на карту и в инспектор.
        </p>
        {toastMessage && (
          <div style={{ marginTop: '10px', color: '#0e8345', fontWeight: 600, fontSize: '12.5px' }}>
            ✓ {toastMessage}
          </div>
        )}
      </div>

      {/* 2. Основная сетка: 4 карточки шаблонов слева + Результаты последней загрузки справа */}
      <div className="import-tab__grid">
        <div className="import-tab__templates-grid">
          {IMPORT_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="import-tab__tpl-card">
              <h4 className="import-tab__tpl-title">{tpl.title}</h4>
              <p className="import-tab__tpl-desc">{tpl.description}</p>
              <div className="import-tab__tpl-filename">{tpl.filename}</div>

              <div className="import-tab__tpl-actions">
                <button
                  type="button"
                  className="import-tab__btn-tpl import-tab__btn-tpl--download"
                  onClick={() => handleDownloadTemplate(tpl.id, tpl.filename)}
                  title="Скачать данные / шаблон из domain layer"
                >
                  Шаблон
                </button>
                <button
                  type="button"
                  className="import-tab__btn-tpl import-tab__btn-tpl--upload"
                  onClick={() => handleTriggerUpload(tpl.id)}
                  title="Загрузить файл в domain layer"
                >
                  Загрузить
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Правая карточка: Статус последней загрузки */}
        <div className="import-tab__card">
          <div className="import-tab__eyebrow">ПОСЛЕДНЯЯ ЗАГРУЗКА</div>
          <h2 className="import-tab__heading">{lastUpload.fileName}</h2>
          <div className="import-tab__subtext">{lastUpload.date} · пользователь: инженер-моделировщик</div>

          <table className="import-tab__stats-table">
            <tbody>
              <tr>
                <td className="import-tab__stats-label">Структура файла</td>
                <td className="import-tab__stats-val import-tab__stats-val--ok">Корректно</td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Объекты найдены</td>
                <td className="import-tab__stats-val import-tab__stats-val--ok">
                  {lastUpload.foundCount} из {lastUpload.totalCount || objects.length || '—'}
                </td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Обновлено строк</td>
                <td className="import-tab__stats-val">{lastUpload.newRows}</td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Конфликты</td>
                <td className="import-tab__stats-val">
                  {lastUpload.conflicts > 0 ? (
                    <span className="import-tab__stats-val--warn">{lastUpload.conflicts}</span>
                  ) : (
                    '0'
                  )}
                </td>
              </tr>
              <tr>
                <td className="import-tab__stats-label">Пропуски полей</td>
                <td className="import-tab__stats-val import-tab__stats-val--ok">0</td>
              </tr>
            </tbody>
          </table>

          <div className="import-tab__audit-actions">
            <button
              type="button"
              className="import-tab__btn-view"
              onClick={() => alert(`Загружено ${lastUpload.foundCount} объектов из файла ${lastUpload.fileName}`)}
            >
              Просмотреть аудит
            </button>
            <button
              type="button"
              className="import-tab__btn-apply"
              onClick={() => {
                setToastMessage('Данные успешно синхронизированы в domain layer');
                setTimeout(() => setToastMessage(null), 2500);
              }}
            >
              Синхронизировать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
