import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { FIREBASE_ENV } from './firebaseEnvironment';

const PUBLIC_APP_NAME = 'olhos-do-campus-public';
const ADMIN_APP_NAME = 'olhos-do-campus-admin';

const options = {
  apiKey: FIREBASE_ENV.apiKey,
  authDomain: FIREBASE_ENV.authDomain,
  projectId: FIREBASE_ENV.projectId,
  storageBucket: FIREBASE_ENV.storageBucket,
  messagingSenderId: FIREBASE_ENV.messagingSenderId,
  appId: FIREBASE_ENV.appId,
};

function namedApp(name: string): FirebaseApp {
  return getApps().some((candidate) => candidate.name === name) ? getApp(name) : initializeApp(options, name);
}

export const publicFirebaseApp = namedApp(PUBLIC_APP_NAME);
export const adminFirebaseApp = namedApp(ADMIN_APP_NAME);
export const publicFirebaseAuth = getAuth(publicFirebaseApp);
export const adminFirebaseAuth = getAuth(adminFirebaseApp);

let configurationPromise: Promise<void> | undefined;

export function configureFirebaseAuthentication(): Promise<void> {
  configurationPromise ??= (async () => {
    if (FIREBASE_ENV.useEmulators) {
      const url = `http://${FIREBASE_ENV.authEmulatorHost}:${FIREBASE_ENV.authEmulatorPort}`;
      connectAuthEmulator(publicFirebaseAuth, url, { disableWarnings: true });
      connectAuthEmulator(adminFirebaseAuth, url, { disableWarnings: true });
    }
    await Promise.all([
      setPersistence(publicFirebaseAuth, browserSessionPersistence),
      setPersistence(adminFirebaseAuth, browserLocalPersistence),
    ]);
  })();
  return configurationPromise;
}

export function getPublicAuth(): Auth {
  return publicFirebaseAuth;
}

export function getAdminAuth(): Auth {
  return adminFirebaseAuth;
}
