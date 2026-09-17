function apiOrigin(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    if (import.meta.env.PROD) throw new Error('VITE_API_BASE_URL é obrigatória no build do Cloudflare Pages.');
    return '';
  }
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== parsed.href.replace(/\/$/u, '')) {
    throw new Error('VITE_API_BASE_URL deve ser uma origem HTTP/HTTPS sem caminho.');
  }
  if (import.meta.env.PROD && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL deve usar HTTPS em produção.');
  }
  return parsed.origin;
}

export const FRONTEND_ENV = {
  apiBaseUrl: apiOrigin(import.meta.env.VITE_API_BASE_URL),
} as const;
