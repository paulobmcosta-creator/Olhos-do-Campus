import { afterEach, describe, expect, it, vi } from 'vitest';

async function importEnvironment(): Promise<unknown> {
  vi.resetModules();
  return import('../server/config/env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('configuração coerente do Firebase Emulator Suite', () => {
  it('falha quando Auth e Firestore estão configurados, mas Storage Emulator está ausente', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', '');
    vi.stubEnv('ALLOWED_ADMIN_DOMAINS', 'ifes.edu.br');
    await expect(importEnvironment()).rejects.toThrow(/Auth, Firestore e Storage conjuntamente/iu);
  });

  it('rejeita protocolo HTTP no FIREBASE_STORAGE_EMULATOR_HOST', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', 'http://127.0.0.1:9199');
    vi.stubEnv('ALLOWED_ADMIN_DOMAINS', 'ifes.edu.br');
    await expect(importEnvironment()).rejects.toThrow(/host:porta, sem protocolo/iu);
  });

  it('aceita os três hosts locais e resolve bucket local coerente', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    vi.stubEnv('FIRESTORE_DATABASE_ID', '');
    vi.stubEnv('FIREBASE_STORAGE_BUCKET', '');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', '127.0.0.1:9199');
    vi.stubEnv('ALLOWED_ADMIN_DOMAINS', 'ifes.edu.br');
    const imported = await importEnvironment() as { SERVER_ENV: { emulatorMode: boolean; firebaseProjectId: string; firebaseStorageBucket: string } };
    expect(imported.SERVER_ENV).toMatchObject({
      emulatorMode: true,
      firebaseProjectId: 'olhos-do-campus-local',
      firebaseStorageBucket: 'olhos-do-campus-local.appspot.com',
    });
  });
});
