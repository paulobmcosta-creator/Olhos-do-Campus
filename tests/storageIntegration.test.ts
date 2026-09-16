// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { CloudStoragePhotoRepository } from '../server/repositories/cloudStoragePhotoRepository';
import type { PhotoObjectInfo, PhotoObjectMetadata, PhotoRepository } from '../server/repositories/photoRepository';
import { FirestoreStorageCleanupTaskRepository } from '../server/repositories/storageCleanupTaskRepository';
import { ImageProcessingService } from '../server/services/imageProcessingService';
import { PhotoService } from '../server/services/photoService';
import { InMemoryPhotoMetadataRepository, InMemoryStorageCleanupTaskRepository } from './helpers/fakePhotoInfrastructure';

const projectId = 'olhos-do-campus-local';
const bucketName = `${projectId}.appspot.com`;
let app: App;
let storage: Storage;
let firestore: Firestore;
let repository: CloudStoragePhotoRepository;

beforeAll(() => {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  app = initializeApp({ projectId, storageBucket: bucketName }, `storage-integration-${randomUUID()}`);
  storage = getStorage(app);
  firestore = getFirestore(app);
  repository = new CloudStoragePhotoRepository(storage.bucket(bucketName));
});

afterAll(async () => { await deleteApp(app); });

async function webp(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: '#ffffff' } }).webp({ quality: 82 }).toBuffer();
}

function path(kind: 'initial' | 'initial-thumbnails' | 'resolution' | 'resolution-thumbnails' = 'initial'): string {
  return `occurrences/${randomUUID()}/${kind}/${randomUUID()}.webp`;
}

class FaultInjectingPhotoRepository implements PhotoRepository {
  public readonly attemptedSaves: string[] = [];
  public readonly attemptedDeletes: string[] = [];
  public failSaveAtCall?: number;
  public failDeletePaths = new Set<string>();

  public constructor(private readonly delegate: PhotoRepository) {}

  public async save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void> {
    this.attemptedSaves.push(path);
    if (this.failSaveAtCall === this.attemptedSaves.length) throw new Error('simulated-storage-save-failure');
    await this.delegate.save(path, buffer, metadata);
  }

  public read(path: string): Promise<Buffer | undefined> { return this.delegate.read(path); }

  public async delete(path: string): Promise<void> {
    this.attemptedDeletes.push(path);
    if (this.failDeletePaths.has(path)) throw new Error('simulated-storage-delete-failure');
    await this.delegate.delete(path);
  }

  public getMetadata(path: string): Promise<PhotoObjectInfo | undefined> { return this.delegate.getMetadata(path); }
}

describe('CloudStoragePhotoRepository no Storage Emulator', { timeout: 30000 }, () => {
  it('faz upload, leitura, metadata e exclusão de WebP sem token público', async () => {
    const objectPath = path();
    const bytes = await webp();
    const photoId = randomUUID();
    await repository.save(objectPath, bytes, { occurrenceId: 'occ-test', photoId, kind: 'INITIAL' });

    const read = await repository.read(objectPath);
    expect(read).toEqual(bytes);
    const metadata = await repository.getMetadata(objectPath);
    expect(metadata).toMatchObject({ path: objectPath, contentType: 'image/webp', size: bytes.length });
    expect(metadata?.metadata).toMatchObject({ occurrenceId: 'occ-test', photoId, kind: 'INITIAL', schemaVersion: '1' });
    expect(metadata?.metadata).not.toHaveProperty('firebaseStorageDownloadTokens');
    expect(metadata?.metadata).not.toHaveProperty('originalFilename');

    await repository.delete(objectPath);
    expect(await repository.read(objectPath)).toBeUndefined();
    expect(await repository.getMetadata(objectPath)).toBeUndefined();
    await expect(repository.delete(objectPath)).resolves.toBeUndefined();
  });

  it('persiste miniatura no caminho segregado', async () => {
    const objectPath = path('initial-thumbnails');
    const bytes = await webp();
    await repository.save(objectPath, bytes, { occurrenceId: 'occ-thumb', photoId: 'photo-thumb', kind: 'INITIAL' });
    expect(await repository.read(objectPath)).toEqual(bytes);
    await repository.delete(objectPath);
  });

  it('rejeita caminho arbitrário, traversal e nome que não siga a estrutura server-side', async () => {
    const bytes = await webp();
    for (const invalid of ['../secret.webp', '/occurrences/a/initial/a.webp', 'occurrences/a/../../secret.webp', 'occurrences/a/initial/nome original.jpg']) {
      await expect(repository.save(invalid, bytes, { occurrenceId: 'a', photoId: 'a', kind: 'INITIAL' })).rejects.toThrow('PHOTO_STORAGE_PATH_INVALID');
    }
  });

  it('cleanup permanece idempotente quando o objeto já não existe e registra resultado no Firestore', async () => {
    const objectPath = path('resolution');
    const tasks = new FirestoreStorageCleanupTaskRepository(firestore);
    const id = await tasks.create([objectPath], 'Teste idempotente do Storage Emulator');
    await repository.delete(objectPath);
    await repository.delete(objectPath);
    await tasks.markCompleted(id);
    const pending = await tasks.listPending(500);
    expect(pending.find((task) => task.id === id)).toBeUndefined();
  });

  it('remove no Emulator o objeto já gravado quando o segundo upload falha', async () => {
    const injected = new FaultInjectingPhotoRepository(repository);
    injected.failSaveAtCall = 2;
    const cleanup = new InMemoryStorageCleanupTaskRepository();
    const service = new PhotoService(injected, new InMemoryPhotoMetadataRepository(), cleanup, new ImageProcessingService());
    const source = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();

    await expect(service.prepareAndUpload('occ-partial', 'INITIAL', [{ buffer: source, declaredMimeType: 'image/jpeg' }], { type: 'PUBLIC' }, 'corr-partial'))
      .rejects.toMatchObject({ code: 'PHOTO_STORAGE_FAILED' });
    expect(injected.attemptedSaves).toHaveLength(2);
    expect(injected.attemptedDeletes.length).toBeGreaterThanOrEqual(1);
    expect(await repository.read(injected.attemptedSaves[0]!)).toBeUndefined();
    expect(await cleanup.listPending()).toHaveLength(0);
  });

  it('registra cleanup quando a compensação real não consegue excluir um objeto', async () => {
    const injected = new FaultInjectingPhotoRepository(repository);
    const cleanup = new InMemoryStorageCleanupTaskRepository();
    const service = new PhotoService(injected, new InMemoryPhotoMetadataRepository(), cleanup, new ImageProcessingService());
    const source = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
    const prepared = await service.prepareAndUpload('occ-cleanup', 'RESOLUTION', [{ buffer: source, declaredMimeType: 'image/jpeg' }], { type: 'PUBLIC' }, 'corr-cleanup');
    injected.failDeletePaths.add(prepared.uploadedPaths[0]!);

    await service.compensate(prepared.uploadedPaths, 'Falha simulada de compensação no Emulator', 'corr-cleanup');
    const pending = await cleanup.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.storagePaths).toEqual([prepared.uploadedPaths[0]!]);

    injected.failDeletePaths.clear();
    for (const objectPath of pending[0]!.storagePaths) await repository.delete(objectPath);
  });
});
