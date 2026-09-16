import { describe, expect, it } from 'vitest';
import { formatProtocol, normalizeProtocolPrefix } from '../src/utils/protocol';

describe('protocolo', () => {
  it('gera o formato institucional previsto', () => {
    expect(formatProtocol('INF', 2026, 1)).toBe('INF-2026-000001');
  });

  it('não duplica o ano quando o prefixo legado já o contém', () => {
    expect(formatProtocol('INF-2026', 2026, 42)).toBe('INF-2026-000042');
    expect(normalizeProtocolPrefix('INF-2026')).toBe('INF');
  });

  it('normaliza caracteres e hífens do prefixo', () => {
    expect(normalizeProtocolPrefix(' infra física -- ')).toBe('INFRA-FISICA');
  });
});
