import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  applyTheme,
  readStoredTheme,
  resolveMode,
  writeStoredTheme,
} from './palettes';

const ThemeContext = createContext(null);

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children, initialTheme = null, onPersist = null }) {
  const stored = initialTheme || readStoredTheme();
  const [mode, setMode] = useState(stored?.mode || 'system');
  const [lightPalette, setLightPalette] = useState(stored?.lightPalette || DEFAULT_LIGHT);
  const [darkPalette, setDarkPalette] = useState(stored?.darkPalette || DEFAULT_DARK);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  // Track OS preference changes so 'system' mode stays live.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => setPrefersDark(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  // Apply to <html> and persist locally on every change.
  useEffect(() => {
    const theme = { mode, lightPalette, darkPalette };
    applyTheme({ ...theme, prefersDark });
    writeStoredTheme(theme);
    onPersist?.(theme);
    // onPersist is intentionally not in deps: it is a stable callback in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lightPalette, darkPalette, prefersDark]);

  const setTheme = useCallback((theme) => {
    if (theme.mode !== undefined) setMode(theme.mode);
    if (theme.lightPalette !== undefined) setLightPalette(theme.lightPalette);
    if (theme.darkPalette !== undefined) setDarkPalette(theme.darkPalette);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      lightPalette,
      darkPalette,
      resolvedMode: resolveMode(mode, prefersDark),
      prefersDark,
      setMode,
      setLightPalette,
      setDarkPalette,
      setTheme,
    }),
    [mode, lightPalette, darkPalette, prefersDark, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}

export default ThemeProvider;
