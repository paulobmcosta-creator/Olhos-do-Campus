import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

function resolveOptionalProxyTarget(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (normalized === undefined || normalized === '') return undefined;
  const parsed = new URL(normalized);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== normalized.replace(/\/$/u, '')) {
    throw new Error('VITE_DEV_API_PROXY_TARGET deve ser uma origem HTTP/HTTPS sem caminho.');
  }
  return parsed.origin;
}

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const devApiProxyTarget = resolveOptionalProxyTarget(
    process.env.VITE_DEV_API_PROXY_TARGET ?? loadedEnv.VITE_DEV_API_PROXY_TARGET,
  );

  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      ...(devApiProxyTarget === undefined
        ? {}
        : {
            proxy: {
              '/api': {
                target: devApiProxyTarget,
                changeOrigin: true,
                secure: true,
              },
            },
          }),
    },
  };
});
