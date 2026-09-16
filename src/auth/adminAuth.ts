import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import type { AuthError, Unsubscribe, User } from 'firebase/auth';
import { configureFirebaseAuthentication, getAdminAuth } from '../config/firebase';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(): Promise<'popup' | 'redirect'> {
  await configureFirebaseAuthentication();
  try {
    await signInWithPopup(getAdminAuth(), provider);
    return 'popup';
  } catch (error) {
    const code = (error as Partial<AuthError>).code;
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(getAdminAuth(), provider);
      return 'redirect';
    }
    throw error;
  }
}

export async function completeAdminRedirect(): Promise<void> {
  await configureFirebaseAuthentication();
  await getRedirectResult(getAdminAuth());
}

export async function logoutAdmin(): Promise<void> {
  await configureFirebaseAuthentication();
  await signOut(getAdminAuth());
}

export async function getAdminIdToken(forceRefresh = false): Promise<string> {
  await configureFirebaseAuthentication();
  const user = getAdminAuth().currentUser;
  if (user === null) throw new Error('Não existe sessão Google administrativa ativa.');
  return user.getIdToken(forceRefresh);
}

export async function observeAdminUser(listener: (user: User | null) => void): Promise<Unsubscribe> {
  await configureFirebaseAuthentication();
  return onAuthStateChanged(getAdminAuth(), listener);
}
