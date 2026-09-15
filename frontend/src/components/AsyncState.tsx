import type { ReactNode } from 'react';
import { AppIcon } from './AppIcon';
import './AsyncState.css';

export type AsyncStateProps = {
  /** Состояние загрузки */
  loading: boolean;
  /** Состояние ошибки */
  error: Error | null;
  /** Нет данных после успешной загрузки */
  empty?: boolean;
  /** Сообщение для empty-состояния */
  emptyMessage?: string;
  /** Повторить запрос после ошибки */
  onRetry?: () => void;
  /** Обычный контент (рендерится, если не loading/error/empty) */
  children: ReactNode;
};

/**
 * Обёртка для зон, работающих с асинхронными данными (Этап 9.5):
 * единые loading / error / empty состояния вместо дублирования в каждой зоне.
 */
export function AsyncState({
  loading,
  error,
  empty = false,
  emptyMessage = 'Нет данных',
  onRetry,
  children,
}: AsyncStateProps) {
  if (loading) {
    return (
      <div className="async-state" role="status" aria-live="polite">
        <span className="async-state__spinner" aria-hidden="true" />
        <p className="async-state__text">Загрузка…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="async-state async-state--error" role="alert">
        <span className="async-state__icon">
          <AppIcon name="tab-alerts" size={24} />
        </span>
        <p className="async-state__text">Не удалось загрузить данные: {error.message}</p>
        {onRetry && (
          <button type="button" className="async-state__retry" onClick={onRetry}>
            Повторить
          </button>
        )}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="async-state">
        <span className="async-state__icon">
          <AppIcon name="tab-general" size={24} />
        </span>
        <p className="async-state__text">{emptyMessage}</p>
      </div>
    );
  }
  return <>{children}</>;
}
