import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TRACKING_KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/u;
const KEY_LENGTH = 32;

function randomPart(): string {
  return Array.from({ length: 4 }, () => CHARACTERS[randomInt(CHARACTERS.length)] ?? 'A').join('');
}

export function generateTrackingKey(): string {
  return `${randomPart()}-${randomPart()}-${randomPart()}`;
}

export function normalizeTrackingKey(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidTrackingKeyFormat(value: string): boolean {
  return TRACKING_KEY_PATTERN.test(normalizeTrackingKey(value));
}

function deriveTrackingKey(normalizedKey: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(normalizedKey, salt, KEY_LENGTH, { N: 16_384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err !== null) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashTrackingKey(trackingKey: string): Promise<{ trackingKeyHash: string; trackingKeySalt: string }> {
  const normalized = normalizeTrackingKey(trackingKey);
  if (!isValidTrackingKeyFormat(normalized)) throw new Error('A chave de acompanhamento possui formato inválido.');
  const salt = randomBytes(16);
  const hash = await deriveTrackingKey(normalized, salt);
  return { trackingKeyHash: hash.toString('base64'), trackingKeySalt: salt.toString('base64') };
}

export async function verifyTrackingKey(
  trackingKey: string,
  trackingKeyHash: string,
  trackingKeySalt: string,
): Promise<boolean> {
  const normalized = normalizeTrackingKey(trackingKey);
  if (!isValidTrackingKeyFormat(normalized)) return false;
  try {
    const salt = Buffer.from(trackingKeySalt, 'base64');
    const expected = Buffer.from(trackingKeyHash, 'base64');
    if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await deriveTrackingKey(normalized, salt);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const DUMMY_SALT = Buffer.from('4f6c686f73446f43616d70757353616c', 'hex');
const DUMMY_HASH = Buffer.alloc(KEY_LENGTH, 0);

/**
 * G09B-F002: Executa verificação criptográfica dummy com custo idêntico (scrypt N=16384, r=8, p=1)
 * quando o protocolo consultado não existe, eliminando timing oracle entre protocolo inexistente
 * e chave incorreta.
 */
export async function verifyTrackingKeyDummy(trackingKey: string): Promise<boolean> {
  const normalized = normalizeTrackingKey(trackingKey);
  if (!isValidTrackingKeyFormat(normalized)) return false;
  try {
    const actual = await deriveTrackingKey(normalized, DUMMY_SALT);
    return actual.length === DUMMY_HASH.length && timingSafeEqual(actual, DUMMY_HASH);
  } catch {
    return false;
  }
}

