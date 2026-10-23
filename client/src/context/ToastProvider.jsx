import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { cx } from '../lib/format';

const ToastContext = createContext(null);

const TONE_STYLES = {
  success: { icon: CheckCircle2, className: 'border-success/30 bg-success-soft text-content', iconClass: 'text-success' },
  error: { icon: XCircle, className: 'border-danger/30 bg-danger-soft text-content', iconClass: 'text-danger' },
  warning: { icon: AlertTriangle, className: 'border-warning/30 bg-warning-soft text-content', iconClass: 'text-warning' },
  info: { icon: Info, className: 'border-info/30 bg-info-soft text-content', iconClass: 'text-info' },
};

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, { tone = 'info', duration = 4500, title } = {}) => {
      counter += 1;
      const id = counter;
      setToasts((current) => [...current, { id, message, tone, title }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      push,
      dismiss,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error', duration: 7000 }),
      warning: (message, options) => push(message, { ...options, tone: 'warning' }),
      info: (message, options) => push(message, { ...options, tone: 'info' }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const tone = TONE_STYLES[toast.tone] || TONE_STYLES.info;
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role="status"
              aria-live="polite"
              className={cx(
                'pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-start gap-3 rounded-xl border p-3.5 shadow-pop',
                tone.className,
              )}
            >
              <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', tone.iconClass)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
                <p className="text-sm leading-snug">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-md p-1 text-subtle transition-colors hover:bg-surface/60 hover:text-content"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}

export default ToastProvider;
