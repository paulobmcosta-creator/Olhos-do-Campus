import { z } from 'zod';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const nonEmpty = z.string().trim().min(1);
const port = z.coerce.number().int().min(1).max(65_535);

const appletConfigResult = z.object({
  apiKey: nonEmpty,
  authDomain: nonEmpty,
  projectId: nonEmpty,
  storageBucket: nonEmpty,
  messagingSenderId: nonEmpty,
  appId: nonEmpty,
  recaptchaSiteKey: z.string().trim().optional().default(''),
}).safeParse(firebaseAppletConfig);

const explicitWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const explicitValues = Object.values(explicitWebConfig);
const hasAnyExplicitWebConfig = explicitValues.some((value) => value !== undefined && value.trim() !== '');
const hasCompleteExplicitWebConfig = explicitValues.every((value) => value !== undefined && value.trim() !== '');
if (hasAnyExplicitWebConfig && !hasCompleteExplicitWebConfig) {
  throw new Error('Configuração Firebase do frontend inválida ou parcial: informe todas as variáveis VITE_FIREBASE_* principais.');
}

const hasAppletWebConfig = appletConfigResult.success;
const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === undefined
  ? (!hasAppletWebConfig && !hasCompleteExplicitWebConfig && !import.meta.env.PROD)
  : import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

const localDefaults = {
  apiKey: 'local-emulator-api-key',
  authDomain: 'olhos-do-campus-local.firebaseapp.com',
  projectId: 'olhos-do-campus-local',
  storageBucket: 'olhos-do-campus-local.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:local-emulator',
  recaptchaSiteKey: 'local-app-check-disabled',
} as const;

const appletDefaults = appletConfigResult.success
  ? {
      apiKey: appletConfigResult.data.apiKey,
      authDomain: appletConfigResult.data.authDomain,
      projectId: appletConfigResult.data.projectId,
      storageBucket: appletConfigResult.data.storageBucket,
      messagingSenderId: appletConfigResult.data.messagingSenderId,
      appId: appletConfigResult.data.appId,
      recaptchaSiteKey: appletConfigResult.data.recaptchaSiteKey,
    }
  : undefined;

const selectedDefaults = useEmulators
  ? localDefaults
  : hasCompleteExplicitWebConfig
    ? undefined
    : appletDefaults;

const parsed = z.object({
  apiKey: nonEmpty,
  authDomain: nonEmpty,
  projectId: nonEmpty,
  storageBucket: nonEmpty,
  messagingSenderId: nonEmpty,
  appId: nonEmpty,
  recaptchaEnterpriseSiteKey: z.string().trim(),
  useEmulators: z.boolean(),
  authEmulatorHost: nonEmpty,
  authEmulatorPort: port,
  appCheckEnabled: z.boolean(),
  appCheckDebug: z.boolean(),
}).safeParse({
  apiKey: explicitWebConfig.apiKey ?? selectedDefaults?.apiKey,
  authDomain: explicitWebConfig.authDomain ?? selectedDefaults?.authDomain,
  projectId: explicitWebConfig.projectId ?? selectedDefaults?.projectId,
  storageBucket: explicitWebConfig.storageBucket ?? selectedDefaults?.storageBucket,
  messagingSenderId: explicitWebConfig.messagingSenderId ?? selectedDefaults?.messagingSenderId,
  appId: explicitWebConfig.appId ?? selectedDefaults?.appId,
  recaptchaEnterpriseSiteKey:
    import.meta.env.VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? selectedDefaults?.recaptchaSiteKey ?? '',
  useEmulators,
  authEmulatorHost: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1',
  authEmulatorPort: import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? 9099,
  appCheckEnabled: import.meta.env.VITE_APP_CHECK_ENABLED === 'true' || __ODC_AI_STUDIO_PREVIEW__,
  appCheckDebug: import.meta.env.VITE_APP_CHECK_DEBUG === 'true' || __ODC_AI_STUDIO_PREVIEW__,
});

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Configuração Firebase do frontend inválida ou parcial: ${fields}.`);
}
if (import.meta.env.PROD && parsed.data.useEmulators) {
  throw new Error('VITE_USE_FIREBASE_EMULATORS não pode estar habilitado em produção.');
}
if (import.meta.env.PROD && !parsed.data.appCheckEnabled) {
  throw new Error('VITE_APP_CHECK_ENABLED deve ser true em produção.');
}
if (import.meta.env.PROD && parsed.data.appCheckDebug) {
  throw new Error('VITE_APP_CHECK_DEBUG não pode estar habilitado em produção.');
}
if (parsed.data.appCheckDebug && !import.meta.env.DEV) {
  throw new Error('O modo de depuração do App Check somente pode ser utilizado em desenvolvimento.');
}
if (!parsed.data.useEmulators && parsed.data.apiKey === 'local-emulator-api-key') {
  throw new Error('A configuração local de demonstração não pode ser utilizada fora dos emuladores.');
}
if (parsed.data.appCheckEnabled && parsed.data.recaptchaEnterpriseSiteKey === '') {
  throw new Error('VITE_FIREBASE_RECAPTCHA_ENTERPRISE_SITE_KEY deve ser informado quando App Check estiver habilitado.');
}

export const FIREBASE_ENV = parsed.data;
