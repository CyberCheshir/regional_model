import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ErrorBoundary.css';

export type ErrorBoundaryProps = {
  /** Подпись зоны для сообщения (например «Карта») */
  label?: string;
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Граница ошибок рендера (Error Boundary). Без неё необработанное исключение в
 * любой зоне размонтирует ВСЁ дерево React — интерфейс «исчезает» (пустое поле).
 * Здесь ошибка локализуется: зона показывает понятное сообщение, остальной UI живёт.
 *
 * Класс-компонент — единственный допустимый способ поймать ошибки рендера
 * (хук-аналога в React 18 нет).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Логируем — при отладке текст ошибки виден в консоли.
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="error-boundary" role="alert">
          <p className="error-boundary__title">
            Ошибка в разделе{this.props.label ? ` «${this.props.label}»` : ''}
          </p>
          <p className="error-boundary__text">{error.message}</p>
          <button type="button" className="error-boundary__retry" onClick={this.handleReload}>
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
