import { createHash } from 'node:crypto';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw new Error('O endereço eletrônico informado é inválido.');
  }
  return normalized;
}

export function emailDomain(normalizedEmail: string): string {
  return normalizedEmail.slice(normalizedEmail.lastIndexOf('@') + 1);
}

export function hashNormalizedEmail(normalizedEmail: string): string {
  return createHash('sha256').update(normalizedEmail, 'utf8').digest('hex');
}
