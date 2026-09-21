import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildSavePayload, saveMapGraph, type MapSaveInput, type MapSaveResult } from './mapSave';
import { queryKeys } from './queries';

/** Этапы асинхронного сохранения (для индикатора прогресса). */
export type SaveStage = 'prepare' | 'upload' | 'apply' | 'done' | 'error';

export type SaveProgress = {
  /** Прогресс 0..100 */
  value: number;
  /** Текст текущего этапа */
  label: string;
  stage: SaveStage;
};

export const SAVE_START_PROGRESS: SaveProgress = { value: 0, label: '', stage: 'prepare' };

/**
 * Прогресс-план сохранения (одного POST-запроса). Реального прогресса от сервера
 * нет (запрос один), поэтому этапы клиентские: подготовка снимка → отправка →
 * применение на сервере → готово. Значения подобраны так, чтобы шкала не «зависала»
 * на 0% и не доходила до 100% до ответа сервера.
 */
export const SAVE_STAGES: Record<Exclude<SaveStage, 'error'>, SaveProgress> = {
  prepare: { value: 10, label: 'Сбор снимка модели…', stage: 'prepare' },
  upload: { value: 55, label: 'Отправка на сервер…', stage: 'upload' },
  apply: { value: 85, label: 'Запись в БД…', stage: 'apply' },
  done: { value: 100, label: 'Сохранено', stage: 'done' },
};

/** Минимальная пауза, чтобы этапы были различимы глазом. */
const STEP_DELAY_MS = 220;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type UseSaveGraphOptions = {
  /** Колбэк смены прогресса (вызывается на каждом этапе) */
  onProgress?: (progress: SaveProgress) => void;
};

/**
 * Асинхронное сохранение графа из domain layer (mapDrawing) в БД.
 *
 * Снимок собирается из переданного состояния рисования, затем отправляется
 * POST /api/map/save/. Прогресс отдаётся через onProgress по этапам. После
 * успеха инвалидируется кэш графа карты (react-query), чтобы данные перечитались.
 */
export function useSaveGraph(options: UseSaveGraphOptions = {}) {
  const queryClient = useQueryClient();
  const { onProgress } = options;

  const mutation = useMutation<MapSaveResult, Error, MapSaveInput>({
    mutationFn: async (input) => {
      console.debug('[save] сценарий:', input.projectName ?? '(без имени)');
      onProgress?.(SAVE_STAGES.prepare);
      const payload = buildSavePayload(input);
      await wait(STEP_DELAY_MS);

      onProgress?.(SAVE_STAGES.upload);
      // Небольшая задержка перед fetch — чтобы этап «Отправка» был виден.
      await wait(STEP_DELAY_MS);
      onProgress?.(SAVE_STAGES.apply);
      const result = await saveMapGraph(payload);

      onProgress?.(SAVE_STAGES.done);
      return result;
    },
    onSuccess: () => {
      // Данные на сервере изменились — перечитываем граф карты и список сценариев.
      void queryClient.invalidateQueries({ queryKey: queryKeys.mapGraph });
      void queryClient.invalidateQueries({ queryKey: queryKeys.scenarios });
    },
    onError: (error) => {
      onProgress?.({
        value: 100,
        label: error.message || 'Ошибка сохранения',
        stage: 'error',
      });
    },
  });

  return mutation;
}
