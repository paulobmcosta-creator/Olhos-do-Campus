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

function parseOrigins(value: string | undefined, isProduction: boolean): string[] {
  const origins = [...new Set((value ?? '').split(',').map((item) => item.trim()).filter(Boolean))];
  for (const origin of origins) {
    if (origin === '*') throw new Error('ALLOWED_WEB_ORIGINS não permite wildcard.');
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error('ALLOWED_WEB_ORIGINS deve conter somente origens HTTP/HTTPS sem caminho.');
    }
    if (isProduction && parsed.protocol !== 'https:') throw new Error('ALLOWED_WEB_ORIGINS deve usar HTTPS em produção.');
  }
  return origins;
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
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
const photoStorageProvider = process.env.PHOTO_STORAGE_PROVIDER?.trim() === '' || process.env.PHOTO_STORAGE_PROVIDER === undefined
  ? (isProduction ? undefined : 'firebase-storage')
  : process.env.PHOTO_STORAGE_PROVIDER.trim();
if (photoStorageProvider !== 'r2' && photoStorageProvider !== 'firebase-storage') {
  throw new Error('PHOTO_STORAGE_PROVIDER deve ser "r2" ou "firebase-storage".');
}
if (isProduction && photoStorageProvider !== 'r2') throw new Error('PHOTO_STORAGE_PROVIDER=r2 é obrigatório em produção.');
const legacyPhotoFallbackEnabled = parseBoolean('LEGACY_PHOTO_FALLBACK_ENABLED', process.env.LEGACY_PHOTO_FALLBACK_ENABLED, false);
const appletConfig = loadFirebaseAppletRuntimeConfig();
const firebaseRuntime = resolveFirebaseRuntime({
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID,
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  emulatorMode,
  requireStorageBucket: photoStorageProvider === 'firebase-storage' || legacyPhotoFallbackEnabled,
  ...(appletConfig === undefined ? {} : { appletConfig }),
});
const appCheckEnforcement = parseBoolean('APP_CHECK_ENFORCEMENT', process.env.APP_CHECK_ENFORCEMENT, false);
const allowedAdminDomains = parseDomains(process.env.ALLOWED_ADMIN_DOMAINS ?? (isProduction ? undefined : 'ifes.edu.br'));
const allowedWebOrigins = parseOrigins(process.env.ALLOWED_WEB_ORIGINS ?? (isProduction ? undefined : 'http://localhost:5173,http://127.0.0.1:5173'), isProduction);
export function parseEmailProvider(value: string | undefined): 'ews' | 'resend' {
  if (value === undefined) return 'ews';
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error('EMAIL_PROVIDER não pode ser vazio. Valores permitidos são "ews" ou "resend".');
  }
  if (trimmed !== 'ews' && trimmed !== 'resend') {
    throw new Error(`EMAIL_PROVIDER inválido: '${value}'. Valores permitidos são 'ews' ou 'resend'.`);
  }
  return trimmed;
}

const emailProvider: 'ews' | 'resend' = parseEmailProvider(process.env.EMAIL_PROVIDER);

const ewsEnabled = parseBoolean('EWS_ENABLED', process.env.EWS_ENABLED, isProduction && emailProvider === 'ews');
const ewsUrl = nonEmpty(process.env.EWS_URL) ?? (isProduction ? undefined : 'https://webmail.ifes.edu.br/EWS/Exchange.asmx');
if (ewsUrl !== undefined) {
  try {
    const parsed = new URL(ewsUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      throw new Error('EWS_URL deve usar estritamente o protocolo HTTPS e conter um hostname válido.');
    }
    if (parsed.username !== '' || parsed.password !== '') {
      throw new Error('EWS_URL não pode conter usuário ou senha embutidos. Use EWS_USERNAME e EWS_PASSWORD.');
    }
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.includes('HTTPS') || error.message.includes('EWS_USERNAME') || error.message.includes('embutidos'))) throw error;
    throw new Error(`EWS_URL inválida: '${ewsUrl}'.`);
  }
}
const ewsDomain = nonEmpty(process.env.EWS_DOMAIN) ?? 'UPD1';
const ewsUsername = nonEmpty(process.env.EWS_USERNAME);
const ewsPassword = nonEmpty(process.env.EWS_PASSWORD);
const ewsFrom = nonEmpty(process.env.EWS_FROM);

const resendEnabled = parseBoolean('RESEND_ENABLED', process.env.RESEND_ENABLED, isProduction && emailProvider === 'resend');
const resendApiKey = nonEmpty(process.env.RESEND_API_KEY);
const resendFrom = nonEmpty(process.env.RESEND_FROM);
const resendWebhookSecret = nonEmpty(process.env.RESEND_WEBHOOK_SECRET);
const maintenanceHmacSecret = nonEmpty(process.env.MAINTENANCE_HMAC_SECRET);
const r2AccountId = nonEmpty(process.env.R2_ACCOUNT_ID);
const r2AccessKeyId = nonEmpty(process.env.R2_ACCESS_KEY_ID);
const r2SecretAccessKey = nonEmpty(process.env.R2_SECRET_ACCESS_KEY);
const r2BucketName = nonEmpty(process.env.R2_BUCKET_NAME);
const r2Endpoint = nonEmpty(process.env.R2_ENDPOINT) ?? (r2AccountId === undefined ? undefined : `https://${r2AccountId}.r2.cloudflarestorage.com`);

if (allowedAdminDomains.length === 0) throw new Error('ALLOWED_ADMIN_DOMAINS deve conter ao menos um domínio administrativo autorizado.');
if (isProduction && emulatorMode) throw new Error('Emuladores Firebase não podem ser utilizados em produção.');
if (isProduction && !appCheckEnforcement) throw new Error('APP_CHECK_ENFORCEMENT deve ser true em produção.');
if (isProduction && allowedWebOrigins.length === 0) throw new Error('ALLOWED_WEB_ORIGINS deve conter ao menos uma origem em produção.');
if (emailProvider === 'ews' && ewsEnabled && (ewsUrl === undefined || ewsUsername === undefined || ewsPassword === undefined || ewsFrom === undefined)) {
  throw new Error('EWS_URL, EWS_USERNAME, EWS_PASSWORD e EWS_FROM são obrigatórios quando EMAIL_PROVIDER=ews e EWS_ENABLED=true.');
}
if (emailProvider === 'resend' && resendEnabled && (resendApiKey === undefined || resendFrom === undefined)) {
  throw new Error('RESEND_API_KEY e RESEND_FROM são obrigatórios quando EMAIL_PROVIDER=resend e RESEND_ENABLED=true.');
}
if (isProduction && emailProvider === 'resend' && resendEnabled && resendWebhookSecret === undefined) {
  throw new Error('RESEND_WEBHOOK_SECRET é obrigatório quando Resend está habilitado em produção.');
}
if (photoStorageProvider === 'r2' && [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName, r2Endpoint].some((value) => value === undefined)) {
  throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e endpoint R2 válido são obrigatórios para PHOTO_STORAGE_PROVIDER=r2.');
}
if (legacyPhotoFallbackEnabled && firebaseRuntime.storageBucket === undefined) throw new Error('FIREBASE_STORAGE_BUCKET é obrigatório quando o fallback legado está habilitado.');

export const SERVER_ENV = {
  port: parsePort(process.env.PORT, 3000),
  nodeEnv,
  isProduction,
  firebaseProjectId: firebaseRuntime.projectId,
  firestoreDatabaseId: firebaseRuntime.firestoreDatabaseId,
  firebaseStorageBucket: firebaseRuntime.storageBucket ?? '',
  firebaseConfigurationSource: firebaseRuntime.source,
  storageBucketConfigurationSource: firebaseRuntime.storageBucketSource ?? 'not-configured',
  allowedAdminDomains,
  appCheckEnforcement,
  emulatorMode,
  authEmulatorHost,
  firestoreEmulatorHost,
  storageEmulatorHost,
  photoStorageProvider,
  legacyPhotoFallbackEnabled,
  r2AccountId,
  r2AccessKeyId,
  r2SecretAccessKey,
  r2BucketName,
  r2Endpoint,
  emailProvider,
  ewsEnabled,
  ewsUrl,
  ewsDomain,
  ewsUsername,
  ewsPassword,
  ewsFrom,
  resendEnabled,
  resendApiKey,
  resendFrom,
  resendWebhookSecret,
  allowedWebOrigins,
  maintenanceHmacSecret,
  maintenanceReplayWindowSeconds: 300,
} as const;

export type ServerEnvironment = typeof SERVER_ENV;
