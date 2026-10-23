import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { Popover, MenuLabel, MenuSeparator } from '../ui/Popover';
import { useTheme } from '../../theme/ThemeProvider';
import { DARK_PALETTES, LIGHT_PALETTES } from '../../theme/palettes';
import { cx } from '../../lib/format';

const MODES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeMenu({ compact = false }) {
  const { mode, setMode, lightPalette, setLightPalette, darkPalette, setDarkPalette, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;

  return (
    <Popover
      label="Appearance"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Change appearance"
          className={cx(
            'inline-flex items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-content',
            compact ? 'h-9 w-9' : 'h-10 w-10',
          )}
        >
          <Palette className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      panelClassName="w-72"
    >
      {() => (
        <>
          <MenuLabel>Mode</MenuLabel>
          <div className="grid grid-cols-3 gap-1 p-1">
            {MODES.map((item) => {
              const Icon = item.icon;
              const active = mode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  aria-pressed={active}
                  className={cx(
                    'flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                    active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-content',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <MenuSeparator />
          <MenuLabel>{isDark ? 'Dark palette' : 'Light palette'}</MenuLabel>
          <div className="grid grid-cols-2 gap-1 p-1">
            {palettes.map((palette) => {
              const active = (isDark ? darkPalette : lightPalette) === palette.key;
              return (
                <button
                  key={palette.key}
                  type="button"
                  onClick={() => (isDark ? setDarkPalette(palette.key) : setLightPalette(palette.key))}
                  aria-pressed={active}
                  title={palette.description}
                  className={cx(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                    active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-content',
                  )}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-md border border-border" aria-hidden="true">
                    {palette.swatch.map((color) => (
                      <span key={color} className="h-4 w-2.5" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="truncate">{palette.name}</span>
                </button>
              );
            })}
          </div>
          <p className="px-3 pb-1 pt-2 text-[11px] leading-snug text-subtle">
            Switch between light and dark to pick the other six palettes.
          </p>
        </>
      )}
    </Popover>
  );
}

export default ThemeMenu;
