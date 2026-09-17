import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';
import type { AppCheck } from 'firebase-admin/app-check';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Storage } from 'firebase-admin/storage';
import { DEFAULT_FIRESTORE_DATABASE_ID } from './firebaseRuntime';

type StorageBucket = ReturnType<Storage['bucket']>;

const ADMIN_APP_NAME = 'olhos-do-campus-server';

export interface FirebaseAdminConfig {
  emulatorMode: boolean;
  firebaseProjectId: string;
  firestoreDatabaseId: string;
  firebaseStorageBucket?: string;
}

export interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  appCheck: AppCheck;
  firestore: Firestore;
}

let cached: FirebaseAdminServices | undefined;

export function getFirestoreForDatabase(app: App, databaseId: string): Firestore {
  return databaseId === DEFAULT_FIRESTORE_DATABASE_ID ? getFirestore(app) : getFirestore(app, databaseId);
}

export function getFirebaseAdminServices(config: FirebaseAdminConfig): FirebaseAdminServices {
  if (cached !== undefined) return cached;

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  const storageBucket = config.firebaseStorageBucket ?? '';
  const appOptions = config.emulatorMode
    ? { projectId: config.firebaseProjectId, storageBucket }
    : {
        projectId: config.firebaseProjectId,
        credential: applicationDefault(),
        ...(storageBucket === '' ? {} : { storageBucket }),
      };
  const app = existing ?? initializeApp(
    appOptions,
    ADMIN_APP_NAME,
  );
  cached = {
    app,
    auth: getAuth(app),
    appCheck: getAppCheck(app),
    firestore: getFirestoreForDatabase(app, config.firestoreDatabaseId),
  };
  return cached;
}

export function getFirebaseLegacyStorageBucket(config: FirebaseAdminConfig, app?: App): StorageBucket {
  const bucketName = config.firebaseStorageBucket ?? '';
  if (bucketName.trim() === '') {
    throw new Error('FIREBASE_STORAGE_BUCKET é obrigatório para Storage legado ou emulado.');
  }
  const firebaseApp = app ?? getFirebaseAdminServices(config).app;
  return getStorage(firebaseApp).bucket(bucketName);
}
