import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const ENV_EXAMPLE_PATH = join(ROOT, '.env.example');

describe('G.6 — Consistência de Documentação de Variáveis de Ambiente', () => {
  it('.env.example existe', () => {
    expect(existsSync(ENV_EXAMPLE_PATH)).toBe(true);
  });

  it('documenta ALLOWED_WEB_ORIGINS sem valores sensíveis e sem wildcard', () => {
    const content = readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
    expect(content).toContain('ALLOWED_WEB_ORIGINS=');
    const match = content.match(/ALLOWED_WEB_ORIGINS=(.*)/);
    expect(match).toBeTruthy();
    const value = (match?.[1] ?? '').trim();
    expect(value).not.toContain('*');
    expect(value).not.toContain('secret');
    expect(value).toContain('http://localhost:5173');
  });

  it('documenta todas as variáveis essenciais de backend consumidas em server/config/env.ts', () => {
    const content = readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
    const requiredVars = [
      'NODE_ENV',
      'PORT',
      'FIREBASE_PROJECT_ID',
      'FIRESTORE_DATABASE_ID',
      'ALLOWED_ADMIN_DOMAINS',
      'APP_CHECK_ENFORCEMENT',
      'ALLOWED_WEB_ORIGINS',
      'PHOTO_STORAGE_PROVIDER',
      'EMAIL_PROVIDER',
      'MAINTENANCE_HMAC_SECRET',
      'FIREBASE_AUTH_EMULATOR_HOST',
      'FIRESTORE_EMULATOR_HOST',
      'FIREBASE_STORAGE_EMULATOR_HOST',
    ];

    for (const varName of requiredVars) {
      expect(content, `Variável ${varName} deve estar em .env.example`).toContain(`${varName}=`);
    }
  });

  it('não contém credenciais reais ou segredos versionados', () => {
    const content = readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
    expect(content).not.toMatch(/re_1234567890/); // fake resend key
    expect(content).not.toMatch(/AIza[0-9A-Za-z-_]{35}/); // real google api key
    expect(content).not.toMatch(/ghp_[0-9A-Za-z]{36}/);
  });
});
