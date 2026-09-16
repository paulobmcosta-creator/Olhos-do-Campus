// @vitest-environment node
import { readFileSync } from 'node:fs';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { deleteObject, getBytes, listAll, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, describe, it } from 'vitest';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  const [firestoreHost = '127.0.0.1', firestorePort = '8080'] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  const [storageHost = '127.0.0.1', storagePort = '9199'] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');
  environment = await initializeTestEnvironment({
    projectId: 'olhos-do-campus-local',
    firestore: { host: firestoreHost, port: Number(firestorePort), rules: readFileSync('firestore.rules', 'utf8') },
    storage: { host: storageHost, port: Number(storagePort), rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => { await environment.cleanup(); });

const contexts = () => [
  environment.unauthenticatedContext(),
  environment.authenticatedContext('anonymous', { firebase: { sign_in_provider: 'anonymous' } }),
  environment.authenticatedContext('google', { email: 'user@ifes.edu.br', firebase: { sign_in_provider: 'google.com' } }),
  environment.authenticatedContext('admin', { email: 'admin@ifes.edu.br', role: 'Administrador', firebase: { sign_in_provider: 'google.com' } }),
];

describe('regras server-only do Firestore', () => {
  it('nega leitura e escrita de todas as coleções de negócio a clientes Web', async () => {
    const paths = [
      'occurrences/occ-1',
      'occurrences/occ-1/events/event-1',
      'occurrences/occ-1/photos/photo-1',
      'storageCleanupTasks/task-1',
      'protocolCounters/2026',
      'categories/cat-iluminacao',
      'locations/ifes-bsf',
      'systemSettings/operational',
      'adminUsers/example',
      'auditLogs/example',
    ];
    for (const context of contexts()) {
      const firestore = context.firestore();
      for (const path of paths) {
        const reference = doc(firestore, path);
        await assertFails(getDoc(reference));
        await assertFails(setDoc(reference, { test: true }));
        await assertFails(deleteDoc(reference));
      }
      for (const path of ['occurrences', 'protocolCounters', 'categories', 'locations', 'systemSettings', 'adminUsers', 'auditLogs', 'storageCleanupTasks']) {
        await assertFails(getDocs(collection(firestore, path)));
      }
      await assertFails(getDocs(collection(firestore, 'occurrences/occ-1/events')));
      await assertFails(getDocs(collection(firestore, 'occurrences/occ-1/photos')));
    }
  }, 20000);
});

describe('regras deny-by-default do Storage', () => {
  it('nega leitura, escrita e listagem para não autenticado, anônimo, Google e usuário administrativo', async () => {
    for (const context of contexts()) {
      const storage = context.storage();
      const object = ref(storage, 'occurrences/test/photo.jpg');
      await assertFails(uploadBytes(object, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' }));
      await assertFails(getBytes(object));
      await assertFails(deleteObject(object));
      await assertFails(listAll(ref(storage, 'occurrences')));
    }
  }, 30000);
});
