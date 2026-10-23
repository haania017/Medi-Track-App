import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import api, { qs } from '../../lib/api';
import { cx } from '../../lib/format';

function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Medicine-name input with autocomplete against the small curated reference
 * sample. Suggestions are candidates only: the user still chooses, and free
 * text is always allowed. Nothing is auto-selected.
 */
export function MedicineNameInput({
  value = '',
  onChange,
  onSelect,
  error,
  label = 'Medicine name',
  placeholder = 'e.g. Panadol',
  required = false,
}) {
  const fieldId = `medicine-name-${useId()}`;
  const listId = `${fieldId}-list`;
  const boxRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounced = useDebounced(value, 250);

  const query = useQuery({
    queryKey: ['medicine-catalog', debounced],
    queryFn: () => api.get(`/medicine-info/search${qs({ q: debounced, limit: 8 })}`),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const options = query.data?.data ?? [];
  const catalogNote = query.data?.meta?.catalog?.limitations;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const choose = (entry) => {
    onSelect?.(entry);
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (!open || options.length === 0) {
      if (event.key === 'ArrowDown') setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (index + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault();
      choose(options[highlight]);
    }
  };

  const showList = open && debounced.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full">
      <label htmlFor={fieldId} className="label">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative">
        <input
          id={fieldId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={highlight >= 0 ? `${listId}-option-${highlight}` : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange?.(event.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cx('field pr-10', error && 'border-danger')}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-subtle" aria-hidden="true">
          {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
      </div>

      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {showList ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Medicine suggestions"
          className="absolute z-50 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-border bg-elevated p-1.5 shadow-pop"
        >
          {options.length ? (
            options.map((option, index) => (
              <button
                key={option.id || `${option.brandName}-${option.strength}-${option.form}`}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={highlight === index}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(option)}
                className={cx(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                  highlight === index ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-content">
                    {option.brandName}
                    {option.strength ? ` ${option.strength}` : ''}
                  </span>
                  <span className="block truncate text-xs text-subtle">
                    {option.genericName} · {option.form}
                  </span>
                </span>
                {option.strength ? (
                  <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted">
                    {option.strength}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-subtle">
              {query.isLoading || query.isFetching
                ? 'Searching…'
                : 'No matching medicine in the reference sample. You can type the name yourself.'}
            </p>
          )}

          {catalogNote ? (
            <p className="mt-1 border-t border-border px-3 pb-1 pt-2 text-[11px] leading-relaxed text-subtle">
              {catalogNote}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="hint mt-1.5">
          Start typing to see suggestions, or enter the name yourself. Suggestions come from a limited
          reference sample, not a complete list.
        </p>
      )}
    </div>
  );
}

export default MedicineNameInput;
