import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../lib/format';

const VARIANTS = {
  primary:
    'bg-primary text-primary-fg hover:opacity-90 active:opacity-95 border border-transparent shadow-sm',
  secondary:
    'bg-surface-2 text-content border border-border hover:bg-surface-2/70 hover:border-border-strong',
  outline:
    'bg-transparent text-content border border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-content border border-transparent hover:bg-surface-2',
  danger: 'bg-danger text-white border border-transparent hover:opacity-90',
  'danger-ghost':
    'bg-transparent text-danger border border-transparent hover:bg-danger-soft',
  accent: 'bg-accent text-accent-fg border border-transparent hover:opacity-90',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline border-transparent p-0',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'h-10 w-10 p-0 justify-center',
  'icon-sm': 'h-8 w-8 p-0 justify-center',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className,
    loading = false,
    disabled = false,
    as: Component = 'button',
    type = 'button',
    fullWidth = false,
    ...rest
  },
  ref,
) {
  const isLink = variant === 'link';
  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      disabled={Component === 'button' ? disabled || loading : undefined}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition-all',
        'disabled:cursor-not-allowed disabled:opacity-55',
        !isLink && SIZES[size],
        isLink && 'text-sm',
        VARIANTS[variant] || VARIANTS.primary,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : null}
      {children}
    </Component>
  );
});

export default Button;
