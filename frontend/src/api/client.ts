import type { EntityDetails, MapGraph } from '../domain/types';
import { EntityDetailsSchema, MapGraphSchema, parseOrThrow } from '../domain/schemas';
import { MOCK_ENTITY_DETAILS, MOCK_GRAPH, delay } from './mockData';

/**
 * API-слой (Этап 9.3). Тонкий транспорт: fetch-подобные функции,
 * валидация через Zod. React-query добавляется выше (queries.ts).
 *
 * Имитируем будущее поведение с ошибками сети: 5% вызовов падают.
 */

const NETWORK_FLAKINESS = 0;

async function simulateFetch<T>(
  parse: (raw: unknown) => T,
  data: unknown,
  ms = 150,
): Promise<T> {
  await delay(ms);
  if (Math.random() < NETWORK_FLAKINESS) {
    throw new Error('NETWORK_ERROR: запрос не выполнен (имитация)');
  }
  return parse(data);
}

/** GET /api/map/graph — граф карты. */
export function fetchMapGraph(): Promise<MapGraph> {
  return simulateFetch((raw) => parseOrThrow(MapGraphSchema, raw), MOCK_GRAPH);
}

/** GET /api/entities/:id — карточка объекта. */
export async function fetchEntityDetails(id: string): Promise<EntityDetails> {
  const data = await simulateFetch(
    (raw) => parseOrThrow(EntityDetailsSchema, raw),
    MOCK_ENTITY_DETAILS,
  );
  // Мок возвращает карточку «Северного»; для других id — 404-поведение.
  if (data.id !== id) {
    throw new Error(`NOT_FOUND: объект ${id} не найден`);
  }
  return data;
}
