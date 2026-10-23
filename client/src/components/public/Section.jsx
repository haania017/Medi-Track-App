import { cx } from '../../lib/format';

/**
 * Consistent marketing-page section: eyebrow, title, optional description,
 * generous vertical rhythm and an optional muted background band.
 *
 * `reveal` applies a subtle entrance animation. It is pure CSS, so the content
 * is always present in the DOM and the global reduced-motion rule disables it
 * for anyone who prefers less motion.
 */
export function Section({ id, eyebrow, title, description, children, muted = false, reveal = false, className }) {
  return (
    <section
      id={id}
      className={cx('scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20', muted && 'bg-surface-2/60', reveal && 'animate-fade-up', className)}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 max-w-2xl">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
          ) : null}
          {title ? (
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content sm:text-3xl">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export default Section;
