import type { EntityDetails, MapGraph } from '../domain/types';
import { EntityDetailsSchema, MapGraphSchema, parseOrThrow } from '../domain/schemas';
import { MOCK_ENTITY_DETAILS, MOCK_GRAPH } from './mockData';

/**
 * API-слой. Реальные запросы к Django-backend (см. backend/), dev-прокси
 * '/api' → http://localhost:8000 настроен в vite.config.ts.
 *
 * Каждый ответ проходит zod-валидацию (parseOrThrow). Если backend недоступен
 * (сервер не поднят / сеть), используется МОК — чтобы интерфейс не пустел.
 * Флаг USE_MOCK_FALLBACK управляет этим поведением.
 */

/** Резервный режим: при недоступности API отдаём мок-данные. */
const USE_MOCK_FALLBACK = true;

/** Базовый префикс API (dev-прокси Vite или тот же origin в проде). */
const API_BASE = '/api';

/** Ошибка HTTP-ответа с кодом статуса (для обработки 404 отдельно). */
export class ApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

/** GET-запрос с zod-валидацией ответа. */
async function getJson<T>(path: string, parse: (raw: unknown) => T): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new ApiHttpError(response.status, `HTTP ${response.status} на ${path}`);
  }
  const raw: unknown = await response.json();
  return parse(raw);
}

/** GET /api/map/graph/ — граф карты. */
export async function fetchMapGraph(): Promise<MapGraph> {
  try {
    return await getJson('/map/graph/', (raw) => parseOrThrow(MapGraphSchema, raw));
  } catch (error) {
    if (USE_MOCK_FALLBACK) {
      console.warn('[api] /map/graph/ недоступен, используется мок:', error);
      return MOCK_GRAPH;
    }
    throw error;
  }
}

/** GET /api/entities/:id/ — карточка объекта (инспектор). */
export async function fetchEntityDetails(id: string): Promise<EntityDetails> {
  try {
    return await getJson(`/entities/${encodeURIComponent(id)}/`, (raw) =>
      parseOrThrow(EntityDetailsSchema, raw),
    );
  } catch (error) {
    // 404 — объекта нет: отдельный тип ошибки, чтобы UI показал «не найдено».
    if (error instanceof ApiHttpError && error.status === 404) {
      throw new Error(`NOT_FOUND: объект ${id} не найден`);
    }
    if (USE_MOCK_FALLBACK) {
      console.warn('[api] /entities/ недоступен, используется мок:', error);
      const mock = MOCK_ENTITY_DETAILS;
      if (mock.id !== id) {
        throw new Error(`NOT_FOUND: объект ${id} не найден`);
      }
      return mock;
    }
    throw error;
  }
}
