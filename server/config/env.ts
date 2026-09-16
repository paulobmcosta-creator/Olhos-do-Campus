import { parsePort } from './port';
import { loadFirebaseAppletRuntimeConfig, resolveFirebaseRuntime } from './firebaseRuntime';

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} deve ser "true" ou "false".`);
}

function parseDomains(value: string | undefined): string[] {
  if (value === undefined) return [];
  return [...new Set(value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];
}

function validateEmulatorHost(name: string, value: string): void {
  if (value === '') return;
  if (/^https?:\/\//iu.test(value) || /[/?#\s]/u.test(value) || !/^[A-Za-z0-9.-]+:\d{2,5}$/u.test(value)) {
    throw new Error(`${name} deve usar o formato host:porta, sem protocolo HTTP/HTTPS.`);
  }
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST?.trim() ?? '';
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? '';
const storageEmulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST?.trim() ?? '';
validateEmulatorHost('FIREBASE_AUTH_EMULATOR_HOST', authEmulatorHost);
validateEmulatorHost('FIRESTORE_EMULATOR_HOST', firestoreEmulatorHost);
validateEmulatorHost('FIREBASE_STORAGE_EMULATOR_HOST', storageEmulatorHost);

const emulatorFlags = [authEmulatorHost !== '', firestoreEmulatorHost !== '', storageEmulatorHost !== ''];
if (emulatorFlags.some(Boolean) && !emulatorFlags.every(Boolean)) {
  throw new Error('A configuração de emuladores está parcial: informe Auth, Firestore e Storage conjuntamente.');
}

const emulatorMode = emulatorFlags.every(Boolean);
const appletConfig = loadFirebaseAppletRuntimeConfig();
const firebaseRuntime = resolveFirebaseRuntime({
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  emulatorMode,
  ...(appletConfig === undefined ? {} : { appletConfig }),
});
const appCheckEnforcement = parseBoolean('APP_CHECK_ENFORCEMENT', process.env.APP_CHECK_ENFORCEMENT, false);
const allowedAdminDomains = parseDomains(process.env.ALLOWED_ADMIN_DOMAINS ?? (isProduction ? undefined : 'ifes.edu.br'));

if (allowedAdminDomains.length === 0) throw new Error('ALLOWED_ADMIN_DOMAINS deve conter ao menos um domínio administrativo autorizado.');
if (isProduction && emulatorMode) throw new Error('Emuladores Firebase não podem ser utilizados em produção.');
if (isProduction && !appCheckEnforcement) throw new Error('APP_CHECK_ENFORCEMENT deve ser true em produção.');
if (isProduction && firebaseRuntime.storageBucket.trim() === '') throw new Error('FIREBASE_STORAGE_BUCKET é obrigatório em produção.');

export const SERVER_ENV = {
  port: parsePort(process.env.PORT, 3000),
  nodeEnv,
  isProduction,
  firebaseProjectId: firebaseRuntime.projectId,
  firestoreDatabaseId: firebaseRuntime.firestoreDatabaseId,
  firebaseStorageBucket: firebaseRuntime.storageBucket,
  firebaseConfigurationSource: firebaseRuntime.source,
  storageBucketConfigurationSource: firebaseRuntime.storageBucketSource,
  allowedAdminDomains,
  appCheckEnforcement,
  emulatorMode,
  authEmulatorHost,
  firestoreEmulatorHost,
  storageEmulatorHost,
} as const;

export type ServerEnvironment = typeof SERVER_ENV;
