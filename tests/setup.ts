import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
}
