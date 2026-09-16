import { ReCaptchaEnterpriseProvider, getToken, initializeAppCheck } from 'firebase/app-check';
import type { AppCheck } from 'firebase/app-check';
import { publicFirebaseApp } from '../../config/firebase';
import { FIREBASE_ENV } from '../../config/firebaseEnvironment';

let appCheck: AppCheck | undefined;

function getInstance(): AppCheck | undefined {
  if (!FIREBASE_ENV.appCheckEnabled) return undefined;
  if (appCheck !== undefined) return appCheck;
  if (FIREBASE_ENV.appCheckDebug) {
    (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  appCheck = initializeAppCheck(publicFirebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(FIREBASE_ENV.recaptchaEnterpriseSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheck;
}

export async function getAppCheckToken(forceRefresh = false): Promise<string | undefined> {
  const instance = getInstance();
  if (instance === undefined) return undefined;
  return (await getToken(instance, forceRefresh)).token;
}
