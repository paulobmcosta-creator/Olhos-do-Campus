/**
 * Utilitário centralizado de normalização textual e extração de tokens para busca (G09C-F001).
 * Garante consistência bidirecional entre indexação e consulta.
 */

export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function extractSearchTokens(...values: string[]): string[] {
  return [
    ...new Set(
      values
        .flatMap((value) =>
          normalizeSearchText(value)
            .replace(/[^a-z0-9]+/gu, ' ')
            .split(/\s+/u),
        )
        .filter((token) => token.length >= 3)
        .slice(0, 80),
    ),
  ];
}

export function normalizeSearchKeyword(keyword: string): string {
  const normalized = normalizeSearchText(keyword).replace(/[^a-z0-9]+/gu, ' ');
  const tokens = normalized.split(/\s+/u).filter((token) => token.length > 0);
  return tokens[0] ?? '';
}
