// @vitest-environment node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { connectStorageEmulator, getBytes, getStorage, listAll, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp, type App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage, type Storage as AdminStorage } from 'firebase-admin/storage';
import type { AuthorizedAdminProfile, AdminRole } from '../src/models/admin';
import type { CreateOccurrenceInput } from '../src/models/occurrence';
import type { NewOccurrenceEvent, NewOccurrenceRecord } from '../server/models/occurrenceDomain';
import { FirestoreAdminUserRepository } from '../server/repositories/adminUserRepository';
import { FirestoreAuditLogRepository } from '../server/repositories/auditLogRepository';
import { FirestoreCategoryRepository } from '../server/repositories/categoryRepository';
import { FirestoreLocationRepository } from '../server/repositories/locationRepository';
import { FirestoreOccurrenceEventRepository } from '../server/repositories/occurrenceEventRepository';
import { FirestoreOccurrenceRepository } from '../server/repositories/occurrenceRepository';
import { DEFAULT_OPERATIONAL_CONFIG, REFERENCE_LOCATIONS, REFERENCE_CATEGORIES } from '../server/repositories/referenceSeedData';
import { FirestoreOperationalTeamRepository } from '../server/repositories/operationalTeamRepository';
import { FirestoreSlaConfigRepository } from '../server/repositories/slaConfigRepository';
import { CloudStoragePhotoRepository } from '../server/repositories/cloudStoragePhotoRepository';
import { FirestorePhotoMetadataRepository } from '../server/repositories/photoMetadataRepository';
import { FirestoreStorageCleanupTaskRepository } from '../server/repositories/storageCleanupTaskRepository';
import { FirestoreSystemConfigRepository } from '../server/repositories/systemConfigRepository';
import { ImageProcessingService } from '../server/services/imageProcessingService';
import { OccurrenceService } from '../server/services/occurrenceService';
import { PhotoService } from '../server/services/photoService';
import { HttpError } from '../server/types/errors';
import { hashNormalizedEmail } from '../server/utils/email';

const projectId = 'olhos-do-campus-local';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';

const createInput: CreateOccurrenceInput = {
  location: { campusId: 'ifes-bsf', buildingId: 'bloco-01', floorId: 'sem-pavimento', roomId: 'sala-de-aula-1' },
  categoryId: 'cat-iluminacao',
  description: 'A luminária do ambiente não está funcionando durante o período de uso.',
  immediateRisk: false,
};

let publicApp: FirebaseApp;
let adminClientApp: FirebaseApp;
let publicAuth: Auth;
let adminClientAuth: Auth;
let publicStorage: FirebaseStorage;
let adminApp: AdminApp;
let adminAuth: AdminAuth;
let firestore: Firestore;
let adminStorage: AdminStorage;

beforeAll(() => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
  process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = storageHost;

  publicApp = initializeApp({ apiKey: 'local-emulator-api-key', projectId, appId: 'public-local', storageBucket: `${projectId}.appspot.com` }, 'firebase-integration-public');
  adminClientApp = initializeApp({ apiKey: 'local-emulator-api-key', projectId, appId: 'admin-local', storageBucket: `${projectId}.appspot.com` }, 'firebase-integration-admin');
  publicAuth = getAuth(publicApp);
  adminClientAuth = getAuth(adminClientApp);
  connectAuthEmulator(publicAuth, `http://${authHost}`, { disableWarnings: true });
  connectAuthEmulator(adminClientAuth, `http://${authHost}`, { disableWarnings: true });
  publicStorage = getStorage(publicApp);
  const [storageHostname = '127.0.0.1', storagePort = '9199'] = storageHost.split(':');
  connectStorageEmulator(publicStorage, storageHostname, Number(storagePort));
  publicStorage.maxUploadRetryTime = 1000;
  publicStorage.maxOperationRetryTime = 1000;

  adminApp = initializeAdminApp({ projectId, storageBucket: `${projectId}.appspot.com` }, 'firebase-integration-server');
  adminAuth = getAdminAuth(adminApp);
  firestore = getFirestore(adminApp);
  adminStorage = getAdminStorage(adminApp);
});

beforeEach(async () => {
  const endpoint = `http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
  const response = await fetch(endpoint, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Falha ao limpar Firestore Emulator: HTTP ${response.status}.`);
});

afterAll(async () => {
  await Promise.all([deleteApp(publicApp), deleteApp(adminClientApp), deleteAdminApp(adminApp)]);
});

function runBootstrap(args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', 'firebase:bootstrap-admin', '--', ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FIREBASE_PROJECT_ID: projectId,
        GOOGLE_CLOUD_PROJECT: projectId,
        ALLOWED_ADMIN_DOMAINS: 'ifes.edu.br',
        FIRESTORE_EMULATOR_HOST: firestoreHost,
        FIREBASE_AUTH_EMULATOR_HOST: authHost,
        FIREBASE_STORAGE_EMULATOR_HOST: storageHost,
      },
      shell: process.platform === 'win32',
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.on('close', (code) => resolve({ code, output }));
  });
}

function profile(role: AdminRole, email: string): AuthorizedAdminProfile {
  return {
    id: hashNormalizedEmail(email),
    uid: `${role.toLowerCase()}-uid`,
    email,
    displayName: role,
    role,
    teamIds: [],
    active: true,
  };
}

async function seedAdminUser(repository: FirestoreAdminUserRepository, actor: AuthorizedAdminProfile): Promise<void> {
  const existing = await repository.getById(actor.id);
  if (!existing) {
    try {
      await repository.create({
        email: actor.email,
        normalizedEmail: actor.email,
        displayName: actor.displayName,
        role: actor.role,
        active: true,
        actorId: 'integration-seed',
      });
    } catch {
      // ignore
    }
  }
}

async function makePersistentService(): Promise<{
  service: OccurrenceService;
  occurrences: FirestoreOccurrenceRepository;
  events: FirestoreOccurrenceEventRepository;
  categories: FirestoreCategoryRepository;
  locations: FirestoreLocationRepository;
  configs: FirestoreSystemConfigRepository;
  administrator: AuthorizedAdminProfile;
  manager: AuthorizedAdminProfile;
  secondManager: AuthorizedAdminProfile;
}> {
  const occurrences = new FirestoreOccurrenceRepository(firestore);
  const events = new FirestoreOccurrenceEventRepository(firestore);
  const categories = new FirestoreCategoryRepository(firestore);
  const locations = new FirestoreLocationRepository(firestore);
  const configs = new FirestoreSystemConfigRepository(firestore);
  const adminUsers = new FirestoreAdminUserRepository(firestore);
  const auditLogs = new FirestoreAuditLogRepository(firestore);
  const administrator = profile('Administrador', 'admin@ifes.edu.br');
  const manager = profile('Gestor', 'gestor@ifes.edu.br');
  const secondManager = profile('Gestor', 'gestor2@ifes.edu.br');
  const teams = new FirestoreOperationalTeamRepository(firestore);
  const slaConfigs = new FirestoreSlaConfigRepository(firestore);

  await Promise.all([
    categories.seed(REFERENCE_CATEGORIES, 'integration-seed'),
    locations.seed(REFERENCE_LOCATIONS, 'integration-seed'),
    configs.seed(DEFAULT_OPERATIONAL_CONFIG, 'integration-seed'),
  ]);
  await seedAdminUser(adminUsers, administrator);
  await seedAdminUser(adminUsers, manager);
  await seedAdminUser(adminUsers, secondManager);
  await slaConfigs.seedDefaults('integration-seed');

  return {
    service: new OccurrenceService(
      occurrences,
      events,
      categories,
      locations,
      configs,
      adminUsers,
      teams,
      slaConfigs,
      auditLogs,
      new PhotoService(
        new CloudStoragePhotoRepository(adminStorage.bucket(`${projectId}.appspot.com`)),
        new FirestorePhotoMetadataRepository(firestore),
        new FirestoreStorageCleanupTaskRepository(firestore),
        new ImageProcessingService(),
      ),
    ),
    occurrences,
    events,
    categories,
    locations,
    configs,
    administrator,
    manager,
    secondManager,
  };
}

async function moveToAnalysis(service: OccurrenceService, id: string, version: number, actor: AuthorizedAdminProfile): Promise<number> {
  const triage = await service.update(id, { expectedVersion: version, status: 'Em triagem' }, actor, 'move-triage');
  const analysis = await service.update(id, { expectedVersion: triage.version, status: 'Em análise' }, actor, 'move-analysis');
  return analysis.version;
}

function directRecord(sequence: number): NewOccurrenceRecord {
  return {
    categoryId: 'cat-iluminacao',
    categoryNameSnapshot: 'Iluminação',
    location: {
      campusId: 'ifes-bsf', campusName: 'IFES — Campus Barra de São Francisco',
      buildingId: 'bloco-01', buildingName: 'Bloco 01', floorId: 'sem-pavimento', floor: '', roomId: 'sala-de-aula-1', room: 'SALA DE AULA 1',
    },
    description: `Ocorrência concorrente ${sequence}`,
    immediateRisk: false,
    priority: 'Normal',
    trackingKeyHash: `hash-${sequence}`,
    trackingKeySalt: `salt-${sequence}`,
    dataClassification: 'TEST',
    searchTokens: ['ocorrencia','concorrente'],
  };
}

function initialEvent(date: Date, correlationId: string): NewOccurrenceEvent {
  return {
    schemaVersion: 2,
    eventType: 'OCCURRENCE_CREATED',
    visibility: 'PUBLIC',
    createdAt: date,
    actorType: 'SYSTEM',
    actorRoleSnapshot: 'Sistema',
    publicDescription: 'Ocorrência criada em teste de integração.',
    correlationId,
  };
}

async function expectGenericNotFound(action: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await action;
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, message: error.message };
    throw error;
  }
  throw new Error('A operação deveria ter retornado 404.');
}

describe('Firebase Emulator Suite — fundação de segurança preservada', { timeout: 20000 }, () => {
  it('cria sessão anônima e o Admin SDK valida o ID Token', async () => {
    const credential = await signInAnonymously(publicAuth);
    expect(credential.user.isAnonymous).toBe(true);
    const decoded = await adminAuth.verifyIdToken(await credential.user.getIdToken());
    expect(decoded.uid).toBe(credential.user.uid);
    expect(decoded.firebase.sign_in_provider).toBe('anonymous');
  });

  it('mantém as instâncias públicas e administrativas independentes', async () => {
    await signInAnonymously(publicAuth);
    expect(publicAuth.currentUser).not.toBeNull();
    expect(adminClientAuth.currentUser).toBeNull();
    expect(publicAuth.app.name).not.toBe(adminClientAuth.app.name);
  });

  it('nega leitura, escrita e listagem no Storage Emulator', { timeout: 30000 }, async () => {
    await signInAnonymously(publicAuth);
    const object = ref(publicStorage, 'occurrences/example.jpg');
    await expect(uploadBytes(object, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg' })).rejects.toBeDefined();
    await expect(getBytes(object)).rejects.toBeDefined();
    await expect(listAll(ref(publicStorage, 'occurrences'))).rejects.toBeDefined();
  });

  it('executa bootstrap em dry-run sem persistir e depois cria o primeiro Administrador', async () => {
    const email = 'bootstrap@ifes.edu.br';
    const id = hashNormalizedEmail(email);
    const dryRun = await runBootstrap([`--email=${email}`, '--display-name=Administrador Bootstrap', '--emulator', '--dry-run']);
    expect(dryRun.code).toBe(0);
    expect((await firestore.doc(`adminUsers/${id}`).get()).exists).toBe(false);

    const actual = await runBootstrap([`--email=${email}`, '--display-name=Administrador Bootstrap', '--emulator']);
    expect(actual.code).toBe(0);
    expect((await firestore.doc(`adminUsers/${id}`).get()).data()).toMatchObject({
      normalizedEmail: email,
      role: 'Administrador',
      active: true,
    });
    expect(actual.output).not.toMatch(/Bearer|ID Token|refresh token/iu);
  });
});

describe('Firebase Emulator Suite — domínio persistente 0.6.0', { timeout: 20000 }, () => {
  it('cria ocorrência, evento inicial, contador e Timestamps e persiste após nova instância', async () => {
    const first = await makePersistentService();
    const created = await first.service.create(createInput, 'integration-create');
    expect(created.protocol).toBe('INF-2026-000001');
    expect(created.trackingKey).toMatch(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}$/u);

    const stored = await first.occurrences.findByProtocol(created.protocol);
    expect(stored).toBeDefined();
    const raw = await firestore.doc(`occurrences/${stored!.id}`).get();
    const rawData = raw.data() ?? {};
    expect(rawData.createdAt).toBeInstanceOf(Timestamp);
    expect(rawData.updatedAt).toBeInstanceOf(Timestamp);
    expect(rawData).not.toHaveProperty('trackingKey');
    expect(JSON.stringify(rawData)).not.toContain(created.trackingKey);
    expect(rawData.trackingKeyHash).not.toBe(created.trackingKey);
    expect(rawData.trackingKeySalt).not.toBe(created.trackingKey);

    const counter = await firestore.doc('protocolCounters/2026').get();
    expect(counter.data()).toMatchObject({ year: 2026, lastSequence: 1 });
    const events = await first.events.listByOccurrenceId(stored!.id);
    expect(events.map((event) => event.eventType)).toContain('OCCURRENCE_CREATED');

    const second = await makePersistentService();
    const tracked = await second.service.track(created.protocol, created.trackingKey);
    expect(tracked.protocol).toBe(created.protocol);
  });


  it('integra Firestore e Storage sem persistir bytes ou Data URL no documento de domínio', async () => {
    const fixture = await makePersistentService();
    const source = readFileSync(new URL('./fixtures/photo-with-exif-gps.jpg', import.meta.url));
    const created = await fixture.service.create(createInput, [{ buffer: source, declaredMimeType: 'image/jpeg' }], 'photo-integration-create');
    const occurrence = await fixture.occurrences.findByProtocol(created.protocol);
    expect(occurrence).toBeDefined();

    const photosSnapshot = await firestore.collection(`occurrences/${occurrence!.id}/photos`).get();
    expect(photosSnapshot.size).toBe(1);
    const data = photosSnapshot.docs[0]!.data();
    expect(data).toMatchObject({ kind: 'INITIAL', visibility: 'INTERNAL', status: 'READY', contentType: 'image/webp' });
    expect(data.storagePath).toMatch(new RegExp(`^occurrences/${occurrence!.id}/initial/[0-9a-f-]+\\.webp$`, 'u'));
    expect(data.thumbnailStoragePath).toMatch(new RegExp(`^occurrences/${occurrence!.id}/initial-thumbnails/[0-9a-f-]+\\.webp$`, 'u'));
    expect(data).not.toHaveProperty('bytes');
    expect(data).not.toHaveProperty('photoDataUrl');
    expect(data).not.toHaveProperty('solutionPhotoDataUrl');
    expect(JSON.stringify(data)).not.toMatch(/data:image/iu);

    const occurrenceRaw = (await firestore.doc(`occurrences/${occurrence!.id}`).get()).data() ?? {};
    expect(occurrenceRaw).not.toHaveProperty('photos');
    expect(JSON.stringify(occurrenceRaw)).not.toMatch(/data:image/iu);

    const fullFile = adminStorage.bucket(`${projectId}.appspot.com`).file(String(data.storagePath));
    const thumbFile = adminStorage.bucket(`${projectId}.appspot.com`).file(String(data.thumbnailStoragePath));
    expect((await fullFile.exists())[0]).toBe(true);
    expect((await thumbFile.exists())[0]).toBe(true);
    const [fullMetadata] = await fullFile.getMetadata();
    expect(fullMetadata.contentType).toBe('image/webp');
    expect(fullMetadata.metadata).toMatchObject({ occurrenceId: occurrence!.id, photoId: photosSnapshot.docs[0]!.id, kind: 'INITIAL', schemaVersion: '1' });
    expect(fullMetadata.metadata).not.toHaveProperty('firebaseStorageDownloadTokens');
  });

  it('persiste três fotografias iniciais e rejeita a quarta antes de criar ocorrência adicional', async () => {
    const fixture = await makePersistentService();
    const source = readFileSync(new URL('./fixtures/photo-with-exif-gps.jpg', import.meta.url));
    const incoming = { buffer: source, declaredMimeType: 'image/jpeg' } as const;
    const created = await fixture.service.create(createInput, [incoming, incoming, incoming], 'three-photos');
    const stored = await fixture.occurrences.findByProtocol(created.protocol);
    expect((await firestore.collection(`occurrences/${stored!.id}/photos`).get()).size).toBe(3);

    await expect(fixture.service.create({ ...createInput, description: 'Tentativa com quatro fotografias.' }, [incoming, incoming, incoming, incoming], 'four-photos'))
      .rejects.toMatchObject({ status: 400, code: 'PHOTO_COUNT_EXCEEDED' });
    const all = await firestore.collection('occurrences').get();
    expect(all.size).toBe(1);
  });

  it('adiciona solução interna, publica explicitamente e exclui com optimistic locking', async () => {
    const fixture = await makePersistentService();
    const source = readFileSync(new URL('./fixtures/photo-with-exif-gps.jpg', import.meta.url));
    const created = await fixture.service.create(createInput, 'resolution-photo-create');
    const stored = await fixture.occurrences.findByProtocol(created.protocol);
    const added = await fixture.service.addResolutionPhotos(stored!.id, { expectedVersion: stored!.version }, [{ buffer: source, declaredMimeType: 'image/jpeg' }], fixture.manager, 'resolution-add');
    expect(added.version).toBe(stored!.version + 1);
    const resolution = added.photos.find((photo) => photo.kind === 'RESOLUTION');
    expect(resolution).toMatchObject({ visibility: 'INTERNAL', status: 'READY' });

    await expect(fixture.service.updatePhotoVisibility(stored!.id, resolution!.id, { expectedVersion: stored!.version, visibility: 'PUBLIC' }, fixture.manager, 'resolution-conflict'))
      .rejects.toMatchObject({ status: 409, code: 'PHOTO_VERSION_CONFLICT' });

    const published = await fixture.service.updatePhotoVisibility(stored!.id, resolution!.id, { expectedVersion: added.version, visibility: 'PUBLIC' }, fixture.manager, 'resolution-public');
    expect(published.photos.find((photo) => photo.id === resolution!.id)?.visibility).toBe('PUBLIC');
    const tracked = await fixture.service.track(created.protocol, created.trackingKey);
    expect(tracked.photos).toEqual([expect.objectContaining({ id: resolution!.id, kind: 'RESOLUTION' })]);

    const deleted = await fixture.service.deletePhoto(stored!.id, resolution!.id, { expectedVersion: published.version }, fixture.administrator, 'resolution-delete');
    expect(deleted.photos.find((photo) => photo.id === resolution!.id)?.status).toBe('DELETED');
    await expect(fixture.service.getAdminPhoto(stored!.id, resolution!.id, 'full', fixture.administrator)).rejects.toMatchObject({ status: 404 });
  });

  it('gera protocolos concorrentes sem duplicidade e mantém contador anual transacional', async () => {
    const repository = new FirestoreOccurrenceRepository(firestore);
    const date = new Date('2026-08-10T15:00:00.000Z');
    const created = await Promise.all(Array.from({ length: 20 }, (_, index) => repository.createWithProtocol(
      directRecord(index + 1),
      'INF',
      [initialEvent(date, `concurrent-${index + 1}`)],
    )));
    const protocols = created.map((item) => item.protocol);
    expect(new Set(protocols).size).toBe(20);
    expect(protocols).toContain('INF-2026-000001');
    expect(protocols).toContain('INF-2026-000020');
    expect((await firestore.doc('protocolCounters/2026').get()).data()?.lastSequence).toBe(20);
  });

  it('reinicia a sequência por ano sem reiniciar o contador do ano anterior', async () => {
    const repository = new FirestoreOccurrenceRepository(firestore);
    await repository.createWithProtocol(directRecord(1), 'INF', [initialEvent(new Date('2026-12-31T12:00:00-03:00'), 'year-2026-a')]);
    const second2026 = await repository.createWithProtocol(directRecord(2), 'INF', [initialEvent(new Date('2026-12-31T13:00:00-03:00'), 'year-2026-b')]);
    const first2027 = await repository.createWithProtocol(directRecord(3), 'INF', [initialEvent(new Date('2027-01-01T12:00:00-03:00'), 'year-2027-a')]);
    expect(second2026.protocol).toBe('INF-2026-000002');
    expect(first2027.protocol).toBe('INF-2027-000001');
    expect((await firestore.doc('protocolCounters/2026').get()).data()?.lastSequence).toBe(2);
    expect((await firestore.doc('protocolCounters/2027').get()).data()?.lastSequence).toBe(1);
  });

  it('retorna a mesma resposta genérica para chave incorreta e protocolo inexistente', async () => {
    const fixture = await makePersistentService();
    const created = await fixture.service.create(createInput, 'track-generic');
    const wrong = await expectGenericNotFound(fixture.service.track(created.protocol, 'AAAA-BBBB-CCCC'));
    const missing = await expectGenericNotFound(fixture.service.track('INF-2026-999999', 'AAAA-BBBB-CCCC'));
    expect(wrong).toEqual(missing);
    expect(wrong.status).toBe(404);
  });

  it('persiste eventos de situação, prioridade, atribuição, mensagem pública e nota interna sem vazar a nota', async () => {
    const fixture = await makePersistentService();
    const created = await fixture.service.create(createInput, 'event-flow-create');
    const initial = await fixture.occurrences.findByProtocol(created.protocol);
    expect(initial).toBeDefined();
    let current = await fixture.service.update(initial!.id, { expectedVersion: 1, status: 'Em triagem' }, fixture.administrator, 'event-status');
    current = await fixture.service.update(current.id, {
      expectedVersion: current.version,
      priority: 'Alta',
      assignedToAdminUserId: fixture.secondManager.id,
      newPublicMessage: 'Equipe responsável acionada.',
      newInternalNote: 'Observação administrativa reservada.',
    }, fixture.administrator, 'event-mixed');

    expect(current.version).toBe(3);
    expect(current.assignedToAdminUserId).toBe(fixture.secondManager.id);
    const events = await fixture.events.listByOccurrenceId(current.id);
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'OCCURRENCE_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'RESPONSIBLE_CHANGED', 'PUBLIC_MESSAGE_ADDED', 'INTERNAL_NOTE_ADDED',
    ]));
    const tracked = await fixture.service.track(created.protocol, created.trackingKey);
    expect(tracked.publicMessages.at(-1)?.message).toBe('Equipe responsável acionada.');
    expect(JSON.stringify(tracked)).not.toContain('Observação administrativa reservada.');
    expect(JSON.stringify(tracked)).not.toContain(fixture.secondManager.id);
  });

  it('resolve e reabre de forma explícita, removendo resolvedAt e registrando eventos específicos', async () => {
    const fixture = await makePersistentService();
    const created = await fixture.service.create(createInput, 'resolve-create');
    const stored = await fixture.occurrences.findByProtocol(created.protocol);
    const version = await moveToAnalysis(fixture.service, stored!.id, stored!.version, fixture.administrator);
    let current = await fixture.service.update(stored!.id, { expectedVersion: version, status: 'Em atendimento' }, fixture.administrator, 'resolve-service');
    current = await fixture.service.update(current.id, { expectedVersion: current.version, status: 'Resolvida' }, fixture.administrator, 'resolve-done');
    expect(current.resolvedAt).toBeDefined();
    const resolvedVersion = current.version;
    current = await fixture.service.update(current.id, { expectedVersion: resolvedVersion, status: 'Em análise' }, fixture.manager, 'resolve-reopen');
    expect(current.resolvedAt).toBeUndefined();
    const types = (await fixture.events.listByOccurrenceId(current.id)).map((event) => event.eventType);
    expect(types).toContain('OCCURRENCE_RESOLVED');
    expect(types).toContain('OCCURRENCE_REOPENED');
  });

  it('Gestor pode reabrir e ambos os papéis ativos visualizam todas as ocorrências', async () => {
    const fixture = await makePersistentService();
    const first = await fixture.service.create(createInput, 'role-first');
    const second = await fixture.service.create({ ...createInput, description: 'Segunda ocorrência não atribuída para teste de papel.' }, 'role-second');
    const stored = await fixture.occurrences.findByProtocol(first.protocol);
    const version = await moveToAnalysis(fixture.service, stored!.id, stored!.version, fixture.administrator);
    let current = await fixture.service.update(stored!.id, { expectedVersion: version, assignedToAdminUserId: fixture.secondManager.id }, fixture.administrator, 'role-assign');
    current = await fixture.service.update(current.id, { expectedVersion: current.version, status: 'Em atendimento' }, fixture.secondManager, 'role-service');
    current = await fixture.service.update(current.id, { expectedVersion: current.version, status: 'Resolvida' }, fixture.secondManager, 'role-resolve');
    current = await fixture.service.update(current.id, { expectedVersion: current.version, status: 'Em análise' }, fixture.secondManager, 'role-reopen');
    expect(current.status).toBe('Em análise');

    const managerList = await fixture.service.list({}, fixture.secondManager);
    expect(managerList.items.map((item) => item.protocol).sort()).toEqual([first.protocol, second.protocol].sort());
    const secondStored = await fixture.occurrences.findByProtocol(second.protocol);
    await expect(fixture.service.getById(secondStored!.id, fixture.secondManager)).resolves.toMatchObject({ protocol: second.protocol });
    expect((await fixture.service.list({}, fixture.manager)).items).toHaveLength(2);
    expect((await fixture.service.list({}, fixture.administrator)).items).toHaveLength(2);
  });

  it('aplica optimistic locking e rejeita a segunda alteração baseada na mesma versão', async () => {
    const fixture = await makePersistentService();
    const created = await fixture.service.create(createInput, 'version-create');
    const stored = await fixture.occurrences.findByProtocol(created.protocol);
    const baseVersion = stored!.version;
    const first = await fixture.service.update(stored!.id, { expectedVersion: baseVersion, priority: 'Alta' }, fixture.administrator, 'version-first');
    expect(first.version).toBe(baseVersion + 1);
    await expect(fixture.service.update(stored!.id, { expectedVersion: baseVersion, newPublicMessage: 'Alteração concorrente.' }, fixture.manager, 'version-second'))
      .rejects.toMatchObject({ status: 409 });
  });

  it('valida vínculo de duplicidade e rejeita ciclo A → B → C → A', async () => {
    const fixture = await makePersistentService();
    const a = await fixture.service.create({ ...createInput, description: 'Ocorrência A para teste de duplicidade.' }, 'dup-a');
    const b = await fixture.service.create({ ...createInput, description: 'Ocorrência B para teste de duplicidade.' }, 'dup-b');
    const c = await fixture.service.create({ ...createInput, description: 'Ocorrência C para teste de duplicidade.' }, 'dup-c');
    const sa = await fixture.occurrences.findByProtocol(a.protocol);
    const sb = await fixture.occurrences.findByProtocol(b.protocol);
    const sc = await fixture.occurrences.findByProtocol(c.protocol);
    const va = await moveToAnalysis(fixture.service, sa!.id, sa!.version, fixture.administrator);
    const vb = await moveToAnalysis(fixture.service, sb!.id, sb!.version, fixture.administrator);
    const vc = await moveToAnalysis(fixture.service, sc!.id, sc!.version, fixture.administrator);

    const bLinked = await fixture.service.update(sb!.id, { expectedVersion: vb, status: 'Duplicada', duplicateOfProtocol: c.protocol }, fixture.administrator, 'dup-b-c');
    expect(bLinked.duplicateOfProtocol).toBe(c.protocol);
    const aLinked = await fixture.service.update(sa!.id, { expectedVersion: va, status: 'Duplicada', duplicateOfProtocol: b.protocol }, fixture.administrator, 'dup-a-b');
    expect(aLinked.duplicateOfProtocol).toBe(b.protocol);
    await expect(fixture.service.update(sc!.id, { expectedVersion: vc, status: 'Duplicada', duplicateOfProtocol: a.protocol }, fixture.administrator, 'dup-c-a'))
      .rejects.toMatchObject({ status: 409 });
  });

  it('persiste categorias, localizações e configuração operacional entre instâncias', async () => {
    const fixture = await makePersistentService();
    const active = await fixture.categories.listActive();
    expect(active).toHaveLength(REFERENCE_CATEGORIES.length);
    const snapshot = await fixture.locations.resolveSnapshot(createInput.location);
    expect(snapshot).toMatchObject({
      campusName: 'IFES — Campus Barra de São Francisco',
      buildingName: 'Bloco 01',
      floor: '',
      room: 'SALA DE AULA 1',
    });
    expect(await fixture.configs.get()).toMatchObject({ protocolPrefix: 'INF' });

    const categoriesAgain = new FirestoreCategoryRepository(firestore);
    const locationsAgain = new FirestoreLocationRepository(firestore);
    const configsAgain = new FirestoreSystemConfigRepository(firestore);
    expect((await categoriesAgain.getById('cat-iluminacao'))?.name).toBe('Iluminação');
    expect((await locationsAgain.list())[0]?.provisional).toBe(false);
    expect((await configsAgain.get())?.institutionDisplayName).toContain('Campus Barra de São Francisco');
  });
});
