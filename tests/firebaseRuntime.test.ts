import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIRESTORE_DATABASE_ID,
  LOCAL_FIREBASE_PROJECT_ID,
  parseFirebaseAppletRuntimeConfig,
  resolveFirebaseRuntime,
  validateStorageBucket,
} from '../server/config/firebaseRuntime';

const APPLET = {
  projectId: 'gen-lang-client-0120954905',
  firestoreDatabaseId: 'ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf',
  storageBucket: 'gen-lang-client-0120954905.firebasestorage.app',
} as const;

describe('resolução da integração Firebase gerenciada 0.6.0', () => {
  it('usa projectId, banco nomeado e bucket do firebase-applet-config fora do Emulator', () => {
    expect(resolveFirebaseRuntime({ emulatorMode: false, appletConfig: APPLET })).toEqual({
      projectId: APPLET.projectId,
      firestoreDatabaseId: APPLET.firestoreDatabaseId,
      storageBucket: APPLET.storageBucket,
      source: 'firebase-applet-config',
      storageBucketSource: 'firebase-applet-config',
    });
  });

  it('mantém o Emulator no projeto local, banco padrão e bucket local quando não há override', () => {
    expect(resolveFirebaseRuntime({ emulatorMode: true, appletConfig: APPLET })).toEqual({
      projectId: LOCAL_FIREBASE_PROJECT_ID,
      firestoreDatabaseId: DEFAULT_FIRESTORE_DATABASE_ID,
      storageBucket: `${LOCAL_FIREBASE_PROJECT_ID}.appspot.com`,
      source: 'emulator-default',
      storageBucketSource: 'emulator-default',
    });
  });

  it('rejeita olhos-do-campus-local sem Emulator Suite', () => {
    expect(() => resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: LOCAL_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: `${LOCAL_FIREBASE_PROJECT_ID}.appspot.com`,
    })).toThrow(/somente pode ser utilizado com Firebase Emulator Suite/iu);
  });

  it('respeita projeto, banco e bucket explícitos', () => {
    expect(resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: 'projeto-institucional',
      firestoreDatabaseId: 'infraestrutura',
      firebaseStorageBucket: 'projeto-institucional.firebasestorage.app',
      appletConfig: APPLET,
    })).toEqual({
      projectId: 'projeto-institucional',
      firestoreDatabaseId: 'infraestrutura',
      storageBucket: 'projeto-institucional.firebasestorage.app',
      source: 'environment',
      storageBucketSource: 'environment',
    });
  });

  it('não herda banco nem bucket de outro projeto quando há projeto explícito', () => {
    const runtime = resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: 'outro-projeto',
      firebaseStorageBucket: 'outro-projeto.firebasestorage.app',
      appletConfig: APPLET,
    });
    expect(runtime.firestoreDatabaseId).toBe(DEFAULT_FIRESTORE_DATABASE_ID);
    expect(runtime.storageBucket).toBe('outro-projeto.firebasestorage.app');
    expect(runtime.storageBucketSource).toBe('environment');

    expect(() => resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: 'outro-projeto',
      appletConfig: APPLET,
    })).toThrow(/FIREBASE_STORAGE_BUCKET é obrigatório/iu);
  });

  it('prioriza GOOGLE_CLOUD_PROJECT e usa configuração gerenciada somente quando o projeto coincide', () => {
    expect(resolveFirebaseRuntime({
      emulatorMode: false,
      googleCloudProject: APPLET.projectId,
      appletConfig: APPLET,
    })).toEqual({
      projectId: APPLET.projectId,
      firestoreDatabaseId: APPLET.firestoreDatabaseId,
      storageBucket: APPLET.storageBucket,
      source: 'google-cloud',
      storageBucketSource: 'firebase-applet-config',
    });

    expect(resolveFirebaseRuntime({
      emulatorMode: false,
      googleCloudProject: 'outro-projeto-cloud',
      firebaseStorageBucket: 'outro-projeto-cloud.firebasestorage.app',
      appletConfig: APPLET,
    })).toEqual({
      projectId: 'outro-projeto-cloud',
      firestoreDatabaseId: DEFAULT_FIRESTORE_DATABASE_ID,
      storageBucket: 'outro-projeto-cloud.firebasestorage.app',
      source: 'google-cloud',
      storageBucketSource: 'environment',
    });
  });

  it('rejeita mistura evidente entre projeto ativo e bucket padrão de outro projeto', () => {
    expect(() => resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: 'projeto-a',
      firebaseStorageBucket: 'projeto-b.firebasestorage.app',
    })).toThrow(/projeto diferente/iu);
    expect(() => resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: 'projeto-a',
      firebaseStorageBucket: 'projeto-b.appspot.com',
    })).toThrow(/projeto diferente/iu);
  });

  it('rejeita FIREBASE_PROJECT_ID e GOOGLE_CLOUD_PROJECT divergentes', () => {
    expect(() => resolveFirebaseRuntime({
      emulatorMode: false,
      firebaseProjectId: 'projeto-a',
      googleCloudProject: 'projeto-b',
      firebaseStorageBucket: 'projeto-a.firebasestorage.app',
    })).toThrow(/devem identificar o mesmo projeto/iu);
  });

  it('valida o conteúdo mínimo do firebase-applet-config', () => {
    expect(parseFirebaseAppletRuntimeConfig({
      ...APPLET,
      apiKey: 'valor-público-ignorado-no-servidor',
    })).toEqual(APPLET);
    expect(() => parseFirebaseAppletRuntimeConfig({ projectId: APPLET.projectId, firestoreDatabaseId: APPLET.firestoreDatabaseId })).toThrow(/storageBucket/iu);
  });

  it('rejeita bucket vazio, URL, caminho e caracteres inválidos', () => {
    for (const bucket of ['', 'https://bucket.example', 'bucket/path', 'Bucket Com Espaço', 'a']) {
      expect(() => validateStorageBucket(bucket)).toThrow();
    }
    expect(validateStorageBucket('gen-lang-client-0120954905.firebasestorage.app')).toBe('gen-lang-client-0120954905.firebasestorage.app');
  });
});
