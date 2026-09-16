import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { Unsubscribe, User } from 'firebase/auth';
import { configureFirebaseAuthentication, getPublicAuth } from '../config/firebase';

let pendingAnonymousSignIn: Promise<User> | undefined;

export async function ensureAnonymousSession(): Promise<User> {
  await configureFirebaseAuthentication();
  const auth = getPublicAuth();
  if (auth.currentUser?.isAnonymous === true) return auth.currentUser;
  pendingAnonymousSignIn ??= signInAnonymously(auth)
    .then((credential) => credential.user)
    .finally(() => {
      pendingAnonymousSignIn = undefined;
    });
  return pendingAnonymousSignIn;
}

export async function getPublicIdToken(forceRefresh = false): Promise<string> {
  const user = await ensureAnonymousSession();
  return user.getIdToken(forceRefresh);
}

export async function observePublicUser(listener: (user: User | null) => void): Promise<Unsubscribe> {
  await configureFirebaseAuthentication();
  return onAuthStateChanged(getPublicAuth(), listener);
}
