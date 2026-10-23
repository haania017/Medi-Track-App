import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { cx } from '../../lib/format';

/**
 * Whether the browser exposes the Web Speech synthesis API. Checked lazily so
 * importing this module never throws in an environment without `window`.
 */
export function speechSupported() {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

/**
 * Small speaker button that reads a medicine name aloud using the browser's
 * built-in speech synthesis.
 *
 * - Renders nothing (and never breaks the page) when speech is unavailable.
 * - Cancels any in-flight speech before starting, so repeated clicks never
 *   produce overlapping voices.
 * - Stops speech when it unmounts (e.g. navigating away).
 *
 * This only reads the name aloud — it is not speech recognition or a way to
 * identify a medicine.
 */
export function PronounceButton({ text, className, label, size = 'sm' }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setSupported(speechSupported());
    return () => {
      mountedRef.current = false;
      if (speechSupported()) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore — speech may already have been torn down.
        }
      }
    };
  }, []);

  const name = String(text || '').trim();
  if (!supported || !name) return null;

  const handleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const synth = window.speechSynthesis;
    try {
      // Stop anything already playing so clicks never overlap.
      synth.cancel();
      const utterance = new window.SpeechSynthesisUtterance(name);
      if (navigator?.language) utterance.lang = navigator.language;
      utterance.rate = 0.95;
      const done = () => {
        if (mountedRef.current) setSpeaking(false);
      };
      utterance.onend = done;
      utterance.onerror = done;
      setSpeaking(true);
      synth.speak(utterance);
    } catch {
      // If speech fails for any reason the rest of the page still works.
      if (mountedRef.current) setSpeaking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label || `Pronounce ${name}`}
      title={`Hear "${name}"`}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-subtle',
        'transition-colors hover:bg-surface-2 hover:text-accent',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
    >
      <Volume2 className={cx('h-3.5 w-3.5', speaking && 'text-accent')} aria-hidden="true" />
    </button>
  );
}

export default PronounceButton;
