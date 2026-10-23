import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Info, Monitor, Moon, Palette, Sun } from 'lucide-react';
import api from '../../../lib/api';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Feedback';
import { Badge } from '../../../components/ui/Misc';
import { useToast } from '../../../context/ToastProvider';
import { useAuth } from '../../../context/AuthProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { DARK_PALETTES, LIGHT_PALETTES, THEME_STORAGE_KEY } from '../../../theme/palettes';
import { cx } from '../../../lib/format';

const MODES = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Always light' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Always dark' },
  { value: 'system', label: 'System', icon: Monitor, hint: 'Follow this device' },
];

function PaletteGrid({ palettes, active, onSelect, modeLabel }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {palettes.map((palette) => {
        const selected = active === palette.key;
        return (
          <button
            key={palette.key}
            type="button"
            onClick={() => onSelect(palette.key)}
            aria-pressed={selected}
            className={cx(
              'group rounded-xl border p-3 text-left transition-all',
              selected
                ? 'border-accent bg-accent-soft/50 ring-2 ring-ring/25'
                : 'border-border hover:border-border-strong hover:bg-surface-2',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex overflow-hidden rounded-lg border border-border" aria-hidden="true">
                {palette.swatch.map((color) => (
                  <span key={color} className="h-10 w-7" style={{ backgroundColor: color }} />
                ))}
              </div>
              {selected ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-fg">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold text-content">{palette.name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-subtle">{palette.description}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
              {selected ? `Active ${modeLabel} palette` : `Use as ${modeLabel} palette`}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function AppearanceSettingsPage() {
  const { mode, lightPalette, darkPalette, resolvedMode, setMode, setLightPalette, setDarkPalette } = useTheme();
  const { user, setUser } = useAuth();
  const client = useQueryClient();
  const toast = useToast();
  const [saved, setSaved] = useState(false);

  const appearance = { mode, lightPalette, darkPalette };

  const saveMutation = useMutation({
    mutationFn: (payload) => api.patch('/users/me/preferences', { appearance: payload }),
    onSuccess: (payload) => {
      setUser(payload.data.user);
      client.setQueryData(['auth', 'me'], { user: payload.data.user });
      setSaved(true);
      toast.success('Appearance saved to your account.');
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const resetToAccount = () => {
    const account = user?.appearance;
    if (!account) return;
    setMode(account.mode || 'system');
    setLightPalette(account.lightPalette || 'monochrome');
    setDarkPalette(account.darkPalette || 'midnight');
    toast.info('Reverted to your saved account appearance.');
  };

  const forgetLocal = () => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
      toast.success('This device will now use your saved account appearance on next load.');
    } catch {
      toast.error('Could not clear the local preference.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={Monitor}
          title="Mode"
          description="Light, dark, or follow whatever this device is set to."
        />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((option) => {
              const Icon = option.icon;
              const active = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  aria-pressed={active}
                  className={cx(
                    'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors',
                    active ? 'border-accent bg-accent-soft/50' : 'border-border hover:bg-surface-2',
                  )}
                >
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <span className="mt-1 text-sm font-semibold text-content">{option.label}</span>
                  <span className="text-xs text-subtle">{option.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="hint mt-3">
            Currently rendering in <strong className="font-semibold text-muted">{resolvedMode}</strong> mode
            {mode === 'system' ? ' based on this device' : ''}.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={Palette}
          title="Light palettes"
          description="Six distinct light appearances. The one marked active is what light mode uses."
          action={<Badge tone={resolvedMode === 'light' ? 'success' : 'muted'}>{resolvedMode === 'light' ? 'In use now' : 'Used in light mode'}</Badge>}
        />
        <CardBody>
          <PaletteGrid
            palettes={LIGHT_PALETTES}
            active={lightPalette}
            modeLabel="light"
            onSelect={(key) => {
              setLightPalette(key);
              if (mode === 'dark') setMode('light');
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={Moon}
          title="Dark palettes"
          description="Six distinct dark appearances, independent of the light choice."
          action={<Badge tone={resolvedMode === 'dark' ? 'success' : 'muted'}>{resolvedMode === 'dark' ? 'In use now' : 'Used in dark mode'}</Badge>}
        />
        <CardBody>
          <PaletteGrid
            palettes={DARK_PALETTES}
            active={darkPalette}
            modeLabel="dark"
            onSelect={(key) => {
              setDarkPalette(key);
              setMode('dark');
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={Info} title="Saving your appearance" />
        <CardBody className="space-y-4">
          <Notice tone="neutral" icon={Info}>
            Changes apply instantly on this device. Save them to your account to use the same appearance
            wherever you sign in — the server value is only applied on a device that has no local choice yet.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate(appearance)}
            >
              Save to my account
            </Button>
            <Button variant="secondary" onClick={resetToAccount}>
              Revert to saved
            </Button>
            <Button variant="ghost" onClick={forgetLocal}>
              Reset this device
            </Button>
          </div>
          <p className="hint">
            Active now: {mode} mode · light palette “{lightPalette}” · dark palette “{darkPalette}”.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export default AppearanceSettingsPage;
