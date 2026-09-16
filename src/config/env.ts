const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const FRONTEND_ENV = {
  apiBaseUrl: typeof rawApiBaseUrl === 'string' ? rawApiBaseUrl.replace(/\/$/u, '') : '',
} as const;
