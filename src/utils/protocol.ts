const YEAR_SUFFIX_PATTERN = /-\d{4}$/;
const DIACRITICS_PATTERN = /\p{Diacritic}/gu;
const INVALID_PREFIX_CHARACTERS = /[^A-Z0-9-]/g;
const DUPLICATE_HYPHENS = /-{2,}/g;

export function normalizeProtocolPrefix(prefix: string): string {
  const cleaned = prefix
    .trim()
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .toUpperCase()
    .replace(INVALID_PREFIX_CHARACTERS, '-')
    .replace(DUPLICATE_HYPHENS, '-')
    .replace(/^-|-$/g, '');

  const withoutTrailingYear = cleaned.replace(YEAR_SUFFIX_PATTERN, '');
  return withoutTrailingYear.replace(/^-|-$/g, '') || 'INF';
}

export function formatProtocol(prefix: string, year: number, sequence: number): string {
  const safePrefix = normalizeProtocolPrefix(prefix);
  const safeSequence = Math.max(1, Math.trunc(sequence));
  return `${safePrefix}-${year}-${String(safeSequence).padStart(6, '0')}`;
}
