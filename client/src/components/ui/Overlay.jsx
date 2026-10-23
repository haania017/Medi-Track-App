import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cx } from '../../lib/format';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Keep the latest onClose in a ref so the focus/scroll effect below can depend
  // only on `open`. Depending on the callback identity would re-run the effect
  // on every parent render, which steals focus from controlled inputs after
  // each keystroke (making them stop accepting input after one character).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const getFocusable = () =>
      panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll(
              'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep keyboard focus inside the dialog.
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => {
      const scope = panelRef.current;
      if (!scope) return;
      // Prefer the first form field; fall back to the first button/link.
      const field = scope.querySelector('input:not([type="hidden"]), textarea, select');
      const fallback = scope.querySelector('button:not([data-close]), a[href]');
      (field || fallback)?.focus?.();
    }, 30);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(timer);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-elevated shadow-pop sm:rounded-2xl',
          sizes[size],
        )}
      >
        {title ? (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-content">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              data-close
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-content"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        This action takes effect immediately. You can review what changed afterwards.
      </p>
    </Modal>
  );
}

export default Modal;
