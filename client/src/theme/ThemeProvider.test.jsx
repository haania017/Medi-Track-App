import { describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { THEME_STORAGE_KEY } from './palettes';

function ThemeProbe() {
  const { mode, resolvedMode, lightPalette, darkPalette, setMode, setLightPalette, setDarkPalette } = useTheme();
  return (
    <div>
      <p data-testid="mode">{mode}</p>
      <p data-testid="resolved">{resolvedMode}</p>
      <p data-testid="light">{lightPalette}</p>
      <p data-testid="dark">{darkPalette}</p>
      <button type="button" onClick={() => setMode('light')}>
        light
      </button>
      <button type="button" onClick={() => setMode('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setMode('system')}>
        system
      </button>
      <button type="button" onClick={() => setLightPalette('ocean')}>
        ocean
      </button>
      <button type="button" onClick={() => setLightPalette('emerald')}>
        emerald
      </button>
      <button type="button" onClick={() => setDarkPalette('rose-night')}>
        rose-night
      </button>
    </div>
  );
}

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );
}

describe('Theme system', () => {
  it('defaults to system mode with the monochrome and midnight palettes', () => {
    renderTheme();
    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(screen.getByTestId('light')).toHaveTextContent('monochrome');
    expect(screen.getByTestId('dark')).toHaveTextContent('midnight');
  });

  it('applies light and dark mode attributes on the document element', async () => {
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole('button', { name: 'light' }));
    expect(document.documentElement).toHaveAttribute('data-mode', 'light');
    expect(document.documentElement).toHaveAttribute('data-palette', 'monochrome');

    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(document.documentElement).toHaveAttribute('data-mode', 'dark');
    // The dark palette is independent of the light one.
    expect(document.documentElement).toHaveAttribute('data-palette', 'midnight');
  });

  it('switches light and dark palettes independently', async () => {
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole('button', { name: 'emerald' }));
    await user.click(screen.getByRole('button', { name: 'rose-night' }));

    expect(screen.getByTestId('light')).toHaveTextContent('emerald');
    expect(screen.getByTestId('dark')).toHaveTextContent('rose-night');

    await user.click(screen.getByRole('button', { name: 'light' }));
    expect(document.documentElement).toHaveAttribute('data-palette', 'emerald');

    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(document.documentElement).toHaveAttribute('data-palette', 'rose-night');
  });

  it('persists the choice to localStorage', async () => {
    const user = userEvent.setup();
    renderTheme();

    await user.click(screen.getByRole('button', { name: 'dark' }));
    await user.click(screen.getByRole('button', { name: 'ocean' }));

    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
    expect(stored.mode).toBe('dark');
    expect(stored.lightPalette).toBe('ocean');
  });

  it('restores a previously stored theme on first render', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ mode: 'dark', lightPalette: 'lavender', darkPalette: 'violet-night' }),
    );

    renderTheme();
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(screen.getByTestId('light')).toHaveTextContent('lavender');
    expect(screen.getByTestId('dark')).toHaveTextContent('violet-night');
    expect(document.documentElement).toHaveAttribute('data-mode', 'dark');
    expect(document.documentElement).toHaveAttribute('data-palette', 'violet-night');
  });

  it('follows the operating system preference in system mode', async () => {
    window.matchMedia = (query) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });

    renderTheme();
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-mode', 'dark');
  });

  it('ignores an invalid stored palette and falls back to the defaults', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ mode: 'sepia', lightPalette: 'neon', darkPalette: 'nope' }),
    );

    renderTheme();
    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    expect(screen.getByTestId('light')).toHaveTextContent('monochrome');
    expect(screen.getByTestId('dark')).toHaveTextContent('midnight');
  });

  it('notifies a persistence callback when the theme changes', async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();

    render(
      <ThemeProvider onPersist={onPersist}>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'light' }));
    });

    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)[0];
    expect(last).toMatchObject({ mode: 'light' });
  });
});
