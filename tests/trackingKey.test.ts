import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateTrackingKey, hashTrackingKey, isValidTrackingKeyFormat, verifyTrackingKey } from '../server/utils/trackingKey';

describe('proteção criptográfica da chave de acompanhamento', () => {
  it('gera chave no formato previsto e não utiliza Math.random', () => {
    const key = generateTrackingKey();
    expect(isValidTrackingKeyFormat(key)).toBe(true);
  });
  it('scrypt com salt valida a chave correta e rejeita a incorreta', async () => {
    const key = generateTrackingKey();
    const first = await hashTrackingKey(key);
    expect(await verifyTrackingKey(key, first.trackingKeyHash, first.trackingKeySalt)).toBe(true);
    expect(await verifyTrackingKey('AAAA-BBBB-CCCC', first.trackingKeyHash, first.trackingKeySalt)).toBe(false);
  });
  it('normaliza caixa da chave deliberadamente', async () => {
    const key = generateTrackingKey();
    const derived = await hashTrackingKey(key);
    expect(await verifyTrackingKey(key.toLowerCase(), derived.trackingKeyHash, derived.trackingKeySalt)).toBe(true);
  });

  it('usa scrypt e timingSafeEqual na implementação de verificação', () => {
    const source = readFileSync(join(process.cwd(), 'server/utils/trackingKey.ts'), 'utf8');
    expect(source).toContain('scrypt');
    expect(source).toContain('timingSafeEqual');
    expect(source).not.toContain('Math.random');
    expect(source).not.toMatch(/MD5|SHA-?1/iu);
  });
  it('salt diferente produz derivação diferente e formato inválido é rejeitado', async () => {
    const key = generateTrackingKey();
    const first = await hashTrackingKey(key);
    const second = await hashTrackingKey(key);
    expect(first.trackingKeySalt).not.toBe(second.trackingKeySalt);
    expect(first.trackingKeyHash).not.toBe(second.trackingKeyHash);
    expect(await verifyTrackingKey('invalida', first.trackingKeyHash, first.trackingKeySalt)).toBe(false);
    expect(await verifyTrackingKey(key, 'hash-invalido', first.trackingKeySalt)).toBe(false);
  });
});
