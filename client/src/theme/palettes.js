/**
 * Palette catalogue. Keys must match the CSS variable blocks in index.css.
 * `swatch` is only used to draw the picker preview; the real colours live in CSS.
 */

export const LIGHT_PALETTES = [
  {
    key: 'monochrome',
    name: 'Pure Monochrome',
    description: 'White surfaces, black controls, neutral grey borders.',
    swatch: ['#ffffff', '#f5f5f5', '#0a0a0a'],
  },
  {
    key: 'ocean',
    name: 'Ocean Blue',
    description: 'Light surfaces with calm blue accents.',
    swatch: ['#ffffff', '#f1f5f9', '#2563eb'],
  },
  {
    key: 'emerald',
    name: 'Emerald',
    description: 'Light surfaces with emerald accents.',
    swatch: ['#ffffff', '#f0f5f2', '#059669'],
  },
  {
    key: 'lavender',
    name: 'Lavender',
    description: 'Light surfaces with violet accents.',
    swatch: ['#ffffff', '#f4f1fa', '#7c3aed'],
  },
  {
    key: 'rose',
    name: 'Rose',
    description: 'Light surfaces with muted rose accents.',
    swatch: ['#ffffff', '#fceef1', '#be123c'],
  },
  {
    key: 'amber',
    name: 'Amber',
    description: 'Light surfaces with warm amber accents.',
    swatch: ['#ffffff', '#faf3e6', '#b45309'],
  },
];

export const DARK_PALETTES = [
  {
    key: 'midnight',
    name: 'Midnight Monochrome',
    description: 'Near-black surfaces, white text, neutral grey borders.',
    swatch: ['#121212', '#0a0a0a', '#fafafa'],
  },
  {
    key: 'midnight-blue',
    name: 'Midnight Blue',
    description: 'Charcoal-blue surfaces with blue accents.',
    swatch: ['#0d1526', '#070c17', '#3b82f6'],
  },
  {
    key: 'emerald-night',
    name: 'Emerald Night',
    description: 'Dark green surfaces with emerald accents.',
    swatch: ['#081d16', '#04120d', '#10b981'],
  },
  {
    key: 'violet-night',
    name: 'Violet Night',
    description: 'Dark surfaces with violet accents.',
    swatch: ['#130e22', '#0b0716', '#8b5cf6'],
  },
  {
    key: 'rose-night',
    name: 'Rose Night',
    description: 'Dark surfaces with rose accents.',
    swatch: ['#200d14', '#15070c', '#f43f5e'],
  },
  {
    key: 'amber-night',
    name: 'Amber Night',
    description: 'Dark surfaces with amber accents.',
    swatch: ['#1c1509', '#120d05', '#f59e0b'],
  },
];

export const DEFAULT_LIGHT = 'monochrome';
export const DEFAULT_DARK = 'midnight';

export const LIGHT_KEYS = LIGHT_PALETTES.map((p) => p.key);
export const DARK_KEYS = DARK_PALETTES.map((p) => p.key);

export const palettesFor = (mode) => (mode === 'dark' ? DARK_PALETTES : LIGHT_PALETTES);

export function paletteName(mode, key) {
  const found = palettesFor(mode).find((p) => p.key === key);
  return found?.name || key;
}

export const THEME_STORAGE_KEY = 'meditrack.theme';

export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      mode: ['system', 'light', 'dark'].includes(parsed.mode) ? parsed.mode : 'system',
      lightPalette: LIGHT_KEYS.includes(parsed.lightPalette) ? parsed.lightPalette : DEFAULT_LIGHT,
      darkPalette: DARK_KEYS.includes(parsed.darkPalette) ? parsed.darkPalette : DEFAULT_DARK,
    };
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Storage can be unavailable (private mode); the in-memory theme still works.
  }
}

/** Resolve 'system' against the OS preference. */
export function resolveMode(mode, prefersDark) {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

/** Apply the theme to <html> so the CSS variable blocks take effect. */
export function applyTheme({ mode, lightPalette, darkPalette, prefersDark }) {
  const resolved = resolveMode(mode, prefersDark);
  const root = document.documentElement;
  root.setAttribute('data-mode', resolved);
  root.setAttribute('data-palette', resolved === 'dark' ? darkPalette : lightPalette);
  root.style.colorScheme = resolved;
}
