import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEmailProvider } from '../server/config/env';

async function importEnvironment(): Promise<unknown> {
  vi.resetModules();
  return import('../server/config/env');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Validação Estrita de EMAIL_PROVIDER (0.7.6)', () => {
  it('aceita "ews" e "resend" válidos', () => {
    expect(parseEmailProvider('ews')).toBe('ews');
    expect(parseEmailProvider('resend')).toBe('resend');
    expect(parseEmailProvider(' ews ')).toBe('ews');
    expect(parseEmailProvider(' resend ')).toBe('resend');
  });

  it('usa "ews" como padrão quando o valor for ausente (undefined)', () => {
    expect(parseEmailProvider(undefined)).toBe('ews');
  });

  it('rejeita explicitamente string vazia', () => {
    expect(() => parseEmailProvider('')).toThrow(/EMAIL_PROVIDER não pode ser vazio/iu);
    expect(() => parseEmailProvider('   ')).toThrow(/EMAIL_PROVIDER não pode ser vazio/iu);
  });

  it('rejeita valores inválidos, typos ou protocolos não suportados', () => {
    expect(() => parseEmailProvider('resned')).toThrow(/EMAIL_PROVIDER inválido: 'resned'/iu);
    expect(() => parseEmailProvider('smtp')).toThrow(/EMAIL_PROVIDER inválido: 'smtp'/iu);
    expect(() => parseEmailProvider('sendgrid')).toThrow(/EMAIL_PROVIDER inválido: 'sendgrid'/iu);
    expect(() => parseEmailProvider('foo')).toThrow(/EMAIL_PROVIDER inválido: 'foo'/iu);
    expect(() => parseEmailProvider('EWS')).toThrow(/EMAIL_PROVIDER inválido: 'EWS'/iu);
    expect(() => parseEmailProvider('Resend')).toThrow(/EMAIL_PROVIDER inválido: 'Resend'/iu);
  });
});

describe('Validação e Hardening de EWS_URL (0.7.6)', () => {
  it('rejeita EWS_URL com credenciais embutidas (usuário e/ou senha)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('EMAIL_PROVIDER', 'ews');
    vi.stubEnv('EWS_URL', 'https://usuario:senha@webmail.ifes.edu.br/EWS/Exchange.asmx');
    await expect(importEnvironment()).rejects.toThrow(/não pode conter usuário ou senha embutidos/iu);

    vi.stubEnv('EWS_URL', 'https://usuario@webmail.ifes.edu.br/EWS/Exchange.asmx');
    await expect(importEnvironment()).rejects.toThrow(/não pode conter usuário ou senha embutidos/iu);
  });

  it('rejeita EWS_URL que não utilize o protocolo HTTPS', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('EMAIL_PROVIDER', 'ews');
    vi.stubEnv('EWS_URL', 'http://webmail.ifes.edu.br/EWS/Exchange.asmx');
    await expect(importEnvironment()).rejects.toThrow(/deve usar estritamente o protocolo HTTPS/iu);
  });

  it('aceita EWS_URL HTTPS válida sem credenciais embutidas', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('EMAIL_PROVIDER', 'ews');
    vi.stubEnv('EWS_URL', 'https://webmail.ifes.edu.br/EWS/Exchange.asmx');
    const imported = await importEnvironment() as { SERVER_ENV: { ewsUrl: string; emailProvider: string } };
    expect(imported.SERVER_ENV.emailProvider).toBe('ews');
    expect(imported.SERVER_ENV.ewsUrl).toBe('https://webmail.ifes.edu.br/EWS/Exchange.asmx');
  });
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
