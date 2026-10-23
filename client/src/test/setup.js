import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom does not implement matchMedia, which the theme system relies on.
function createMatchMedia(matches = false) {
  return (query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

/**
 * Some Node versions (22+) define a global `localStorage` that is unavailable
 * unless the process is started with --localstorage-file, which can shadow the
 * one jsdom would otherwise provide. Install a small in-memory implementation
 * so components that persist preferences behave the same as in a browser.
 */
function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

const memoryStorage = createMemoryStorage();

function installStorage(target) {
  if (!target) return;
  try {
    Object.defineProperty(target, 'localStorage', {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
  } catch {
    // If the runtime forbids redefining it, leave whatever is already there.
  }
}

beforeEach(() => {
  window.matchMedia = createMatchMedia(false);
  installStorage(globalThis);
  installStorage(window);
  memoryStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
