import './Toast.css';

export type ToastTone = 'success' | 'error';

export function Toast({ message, tone = 'success' }: { message: string; tone?: ToastTone }) {
  return (
    <div className={`toast toast--${tone}`} role="status" aria-live="polite">
      <span className="toast__dot" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
