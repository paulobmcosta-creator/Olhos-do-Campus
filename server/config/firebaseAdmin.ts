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
import type { ServerEnvironment } from './env';
import { DEFAULT_FIRESTORE_DATABASE_ID } from './firebaseRuntime';

type StorageBucket = ReturnType<Storage['bucket']>;

const ADMIN_APP_NAME = 'olhos-do-campus-server';

export interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  appCheck: AppCheck;
  firestore: Firestore;
  storage: Storage;
  bucket: StorageBucket;
}

let cached: FirebaseAdminServices | undefined;

export function getFirestoreForDatabase(app: App, databaseId: string): Firestore {
  return databaseId === DEFAULT_FIRESTORE_DATABASE_ID ? getFirestore(app) : getFirestore(app, databaseId);
}

export function getFirebaseAdminServices(environment: ServerEnvironment): FirebaseAdminServices {
  if (cached !== undefined) return cached;

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  const app = existing ?? initializeApp(
    environment.emulatorMode
      ? { projectId: environment.firebaseProjectId, storageBucket: environment.firebaseStorageBucket }
      : { projectId: environment.firebaseProjectId, storageBucket: environment.firebaseStorageBucket, credential: applicationDefault() },
    ADMIN_APP_NAME,
  );
  const storage = getStorage(app);

  cached = {
    app,
    auth: getAuth(app),
    appCheck: getAppCheck(app),
    firestore: getFirestoreForDatabase(app, environment.firestoreDatabaseId),
    storage,
    bucket: storage.bucket(environment.firebaseStorageBucket),
  };
  return cached;
}

export function resetFirebaseAdminServicesForTests(): void {
  cached = undefined;
}
