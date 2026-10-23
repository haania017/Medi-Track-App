import { useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/format';

export function useClickOutside(onOutside) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onOutside?.();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onOutside]);
  return ref;
}

/**
 * Accessible disclosure menu: click to open, Escape or outside click to close.
 */
export function Popover({ trigger, children, align = 'right', className, panelClassName, label }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cx('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cx(
            'absolute z-50 mt-2 min-w-[13rem] animate-fade-in overflow-hidden rounded-xl border border-border bg-elevated p-1.5 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ children, icon: Icon, onClick, tone = 'default', as: Component = 'button', to, ...rest }) {
  const toneClass = tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-content hover:bg-surface-2';
  const className = cx(
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
    toneClass,
  );

  if (Component === 'button') {
    return (
      <button type="button" role="menuitem" onClick={onClick} className={className} {...rest}>
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        <span className="min-w-0 flex-1 truncate">{children}</span>
      </button>
    );
  }

  return (
    <Component to={to} role="menuitem" onClick={onClick} className={className} {...rest}>
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Component>
  );
}

export function MenuLabel({ children }) {
  return <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">{children}</p>;
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-border" role="separator" />;
}

export default Popover;
