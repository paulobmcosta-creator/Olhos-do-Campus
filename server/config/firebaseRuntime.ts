import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LOCAL_FIREBASE_PROJECT_ID = 'olhos-do-campus-local' as const;
export const DEFAULT_FIRESTORE_DATABASE_ID = '(default)' as const;

export interface FirebaseAppletRuntimeConfig {
  projectId: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
}

export interface FirebaseRuntimeResolutionInput {
  firebaseProjectId?: string;
  googleCloudProject?: string;
  firestoreDatabaseId?: string;
  firebaseStorageBucket?: string;
  emulatorMode: boolean;
  requireStorageBucket?: boolean;
  appletConfig?: FirebaseAppletRuntimeConfig;
}

export interface FirebaseRuntimeResolution {
  projectId: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  source: 'environment' | 'firebase-applet-config' | 'google-cloud' | 'emulator-default';
  storageBucketSource?: 'environment' | 'firebase-applet-config' | 'emulator-default';
}

function nonEmpty(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized === '' ? undefined : normalized;
}

function validateDatabaseId(value: string): string {
  const databaseId = value.trim();
  if (databaseId === '') throw new Error('FIRESTORE_DATABASE_ID não pode ser vazio.');
  if (databaseId.includes('/') || /[\r\n]/u.test(databaseId)) {
    throw new Error('FIRESTORE_DATABASE_ID possui formato inválido.');
  }
  return databaseId;
}

export function validateStorageBucket(value: string): string {
  const bucket = value.trim();
  if (bucket === '') throw new Error('FIREBASE_STORAGE_BUCKET não pode ser vazio.');
  if (/^https?:\/\//iu.test(bucket) || bucket.includes('/') || /[\r\n\s]/u.test(bucket)) {
    throw new Error('FIREBASE_STORAGE_BUCKET deve conter somente o nome do bucket, sem protocolo, caminho ou espaços.');
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/u.test(bucket)) {
    throw new Error('FIREBASE_STORAGE_BUCKET possui formato inválido.');
  }
  return bucket;
}

function assertDefaultBucketProjectCoherence(projectId: string, bucket: string): void {
  const suffix = ['.firebasestorage.app', '.appspot.com'].find((candidate) => bucket.endsWith(candidate));
  if (suffix === undefined) return;
  const bucketProjectId = bucket.slice(0, -suffix.length);
  if (bucketProjectId !== projectId) {
    throw new Error('FIREBASE_STORAGE_BUCKET aparenta pertencer a projeto diferente do projeto Firebase ativo.');
  }
}

export function parseFirebaseAppletRuntimeConfig(value: unknown): FirebaseAppletRuntimeConfig {
  if (typeof value !== 'object' || value === null) {
    throw new Error('firebase-applet-config.json deve conter um objeto JSON.');
  }
  const record = value as Record<string, unknown>;
  const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
  const firestoreDatabaseId = typeof record.firestoreDatabaseId === 'string' ? record.firestoreDatabaseId.trim() : '';
  const storageBucket = typeof record.storageBucket === 'string' ? record.storageBucket.trim() : undefined;
  if (projectId === '' || firestoreDatabaseId === '') {
    throw new Error('firebase-applet-config.json deve informar projectId e firestoreDatabaseId.');
  }
  return {
    projectId,
    firestoreDatabaseId: validateDatabaseId(firestoreDatabaseId),
    ...(storageBucket === undefined || storageBucket === '' ? {} : { storageBucket: validateStorageBucket(storageBucket) }),
  };
}

export function loadFirebaseAppletRuntimeConfig(baseDirectory = process.cwd()): FirebaseAppletRuntimeConfig | undefined {
  const path = resolve(baseDirectory, 'firebase-applet-config.json');
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'JSON inválido';
    throw new Error(`Não foi possível ler firebase-applet-config.json: ${detail}`);
  }
  return parseFirebaseAppletRuntimeConfig(parsed);
}

export function resolveFirebaseRuntime(input: FirebaseRuntimeResolutionInput): FirebaseRuntimeResolution {
  const firebaseProjectId = nonEmpty(input.firebaseProjectId);
  const googleCloudProject = nonEmpty(input.googleCloudProject);
  const explicitDatabaseId = nonEmpty(input.firestoreDatabaseId);
  const explicitStorageBucket = nonEmpty(input.firebaseStorageBucket);

  if (firebaseProjectId !== undefined && googleCloudProject !== undefined && firebaseProjectId !== googleCloudProject) {
    throw new Error('FIREBASE_PROJECT_ID e GOOGLE_CLOUD_PROJECT devem identificar o mesmo projeto.');
  }

  let projectId: string;
  let source: FirebaseRuntimeResolution['source'];
  if (firebaseProjectId !== undefined) {
    projectId = firebaseProjectId;
    source = 'environment';
  } else if (googleCloudProject !== undefined) {
    projectId = googleCloudProject;
    source = 'google-cloud';
  } else if (!input.emulatorMode && input.appletConfig !== undefined) {
    projectId = input.appletConfig.projectId;
    source = 'firebase-applet-config';
  } else if (input.emulatorMode) {
    projectId = LOCAL_FIREBASE_PROJECT_ID;
    source = 'emulator-default';
  } else {
    throw new Error('Configure FIREBASE_PROJECT_ID/GOOGLE_CLOUD_PROJECT ou forneça firebase-applet-config.json válido.');
  }

  if (projectId === LOCAL_FIREBASE_PROJECT_ID && !input.emulatorMode) {
    throw new Error('O projeto olhos-do-campus-local somente pode ser utilizado com Firebase Emulator Suite. Configure um projeto Firebase real ou habilite Auth, Firestore e Storage Emulator conjuntamente.');
  }

  const firestoreDatabaseId = explicitDatabaseId !== undefined
    ? validateDatabaseId(explicitDatabaseId)
    : input.emulatorMode
      ? DEFAULT_FIRESTORE_DATABASE_ID
      : input.appletConfig?.projectId === projectId
        ? input.appletConfig.firestoreDatabaseId
        : DEFAULT_FIRESTORE_DATABASE_ID;

  let storageBucket: string | undefined;
  let storageBucketSource: FirebaseRuntimeResolution['storageBucketSource'];
  if (explicitStorageBucket !== undefined) {
    storageBucket = validateStorageBucket(explicitStorageBucket);
    storageBucketSource = 'environment';
  } else if (input.emulatorMode) {
    storageBucket = validateStorageBucket(`${projectId}.appspot.com`);
    storageBucketSource = 'emulator-default';
  } else if (input.requireStorageBucket !== false && input.appletConfig?.projectId === projectId && input.appletConfig.storageBucket !== undefined) {
    storageBucket = input.appletConfig.storageBucket;
    storageBucketSource = 'firebase-applet-config';
  } else if (input.requireStorageBucket === true) {
    throw new Error('FIREBASE_STORAGE_BUCKET é obrigatório quando o projeto ativo não corresponde ao firebase-applet-config.json.');
  }

  if (storageBucket !== undefined) assertDefaultBucketProjectCoherence(projectId, storageBucket);
  return {
    projectId,
    firestoreDatabaseId,
    ...(storageBucket === undefined ? {} : { storageBucket }),
    source,
    ...(storageBucketSource === undefined ? {} : { storageBucketSource }),
  };
}
