import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/work/**', '**/outputs/**'],
    testTimeout: 15_000,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
