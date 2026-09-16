export function parsePort(value: string | undefined, fallback = 3000): number {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/u.test(value.trim())) throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  const port = Number(value.trim());
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }
  return port;
}
