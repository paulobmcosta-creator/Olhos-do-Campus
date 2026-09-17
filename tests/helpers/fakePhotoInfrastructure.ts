import type { StoredPhotoMetadata, StorageCleanupTask } from '../../server/models/photoDomain';
import type { PhotoMetadataRepository } from '../../server/repositories/photoMetadataRepository';
import type { PhotoObjectInfo, PhotoObjectMetadata, PhotoObjectPage, PhotoRepository } from '../../server/repositories/photoRepository';
import type { StorageCleanupTaskRepository } from '../../server/repositories/storageCleanupTaskRepository';
import { ImageProcessingService } from '../../server/services/imageProcessingService';
import { PhotoService } from '../../server/services/photoService';
import type { FakePhotoMutationSink } from './fakeRepositories';

export class InMemoryPhotoObjectRepository implements PhotoRepository {
  public readonly provider = 'r2' as const;
  private readonly objects = new Map<string, { buffer: Buffer; metadata: PhotoObjectMetadata }>();
  public readonly deletedPaths: string[] = [];
  public failSaveAtCall?: number;
  public failDeletePaths = new Set<string>();
  private saveCalls = 0;

  public async save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void> {
    await Promise.resolve();
    this.saveCalls += 1;
    if (this.failSaveAtCall === this.saveCalls) throw new Error('simulated-storage-save-failure');
    this.objects.set(path, { buffer: Buffer.from(buffer), metadata: structuredClone(metadata) });
  }

  public async read(path: string): Promise<Buffer | undefined> {
    await Promise.resolve();
    const found = this.objects.get(path);
    return found === undefined ? undefined : Buffer.from(found.buffer);
  }

  public async delete(path: string): Promise<void> {
    await Promise.resolve();
    if (this.failDeletePaths.has(path)) throw new Error('simulated-storage-delete-failure');
    this.deletedPaths.push(path);
    this.objects.delete(path);
  }

  public async getMetadata(path: string): Promise<PhotoObjectInfo | undefined> {
    await Promise.resolve();
    const found = this.objects.get(path);
    return found === undefined ? undefined : {
      path,
      contentType: 'image/webp',
      size: found.buffer.length,
      metadata: {
        occurrenceId: found.metadata.occurrenceId,
        photoId: found.metadata.photoId,
        kind: found.metadata.kind,
        schemaVersion: '1',
      },
    };
  }

  public listPage(prefix: string, cursor?: string, limit = 500): Promise<PhotoObjectPage> {
    const paths = [...this.objects.keys()].filter((path) => path.startsWith(prefix)).sort();
    const start = cursor === undefined ? 0 : Math.max(0, paths.findIndex((path) => path === cursor) + 1);
    const selected = paths.slice(start, start + limit);
    return Promise.resolve({
      items: selected.map((path) => ({ path, size: this.objects.get(path)?.buffer.length })),
      ...(start + selected.length < paths.length && selected.at(-1) !== undefined ? { nextCursor: selected.at(-1) } : {}),
    });
  }

  public paths(): string[] { return [...this.objects.keys()].sort(); }
}

export class InMemoryPhotoMetadataRepository implements PhotoMetadataRepository, FakePhotoMutationSink {
  private readonly byOccurrence = new Map<string, Map<string, StoredPhotoMetadata>>();

  public create(occurrenceId: string, photos: StoredPhotoMetadata[]): void {
    const current = this.byOccurrence.get(occurrenceId) ?? new Map<string, StoredPhotoMetadata>();
    for (const photo of photos) current.set(photo.id, structuredClone(photo));
    this.byOccurrence.set(occurrenceId, current);
  }

  public update(occurrenceId: string, photos: StoredPhotoMetadata[]): void {
    const current = this.byOccurrence.get(occurrenceId) ?? new Map<string, StoredPhotoMetadata>();
    for (const photo of photos) {
      if (!current.has(photo.id)) throw new Error('PHOTO_METADATA_NOT_FOUND');
      current.set(photo.id, structuredClone(photo));
    }
    this.byOccurrence.set(occurrenceId, current);
  }

  public listByOccurrenceId(occurrenceId: string): Promise<StoredPhotoMetadata[]> {
    return Promise.resolve([...this.byOccurrence.get(occurrenceId)?.values() ?? []].map((item) => structuredClone(item)));
  }

  public getById(occurrenceId: string, photoId: string): Promise<StoredPhotoMetadata | undefined> {
    const found = this.byOccurrence.get(occurrenceId)?.get(photoId);
    return Promise.resolve(found === undefined ? undefined : structuredClone(found));
  }

  public async countReadyByKind(occurrenceId: string, kind: StoredPhotoMetadata['kind']): Promise<number> {
    const items = await this.listByOccurrenceId(occurrenceId);
    return items.filter((item) => item.kind === kind && item.status === 'READY').length;
  }

  public listInventoryPage(cursor?: string, limit = 500): Promise<{ items: Array<{ occurrenceId: string; photo: StoredPhotoMetadata }>; nextCursor?: string }> {
    const items = [...this.byOccurrence.entries()].flatMap(([occurrenceId, photos]) => [...photos.values()].map((photo) => ({ occurrenceId, photo: structuredClone(photo) })))
      .sort((left, right) => `${left.occurrenceId}/${left.photo.id}`.localeCompare(`${right.occurrenceId}/${right.photo.id}`));
    const start = cursor === undefined ? 0 : Math.max(0, items.findIndex((item) => `${item.occurrenceId}/${item.photo.id}` === cursor) + 1);
    const selected = items.slice(start, start + limit);
    const last = selected.at(-1);
    return Promise.resolve({ items: selected, ...(start + selected.length < items.length && last !== undefined ? { nextCursor: `${last.occurrenceId}/${last.photo.id}` } : {}) });
  }

  public deleteOccurrence(occurrenceId: string): void { this.byOccurrence.delete(occurrenceId); }
}

export class InMemoryStorageCleanupTaskRepository implements StorageCleanupTaskRepository {
  private readonly tasks = new Map<string, StorageCleanupTask>();
  private sequence = 0;

  public create(storagePaths: string[], reason: string, storageProvider: 'r2' | 'firebase-storage' = 'r2'): Promise<string> {
    const id = `cleanup-${++this.sequence}`;
    const now = new Date();
    this.tasks.set(id, { id, storagePaths: [...new Set(storagePaths)], reason, storageProvider, status: 'PENDING', attempts: 0, createdAt: now, updatedAt: now });
    return Promise.resolve(id);
  }

  public listPending(limit = 100): Promise<StorageCleanupTask[]> {
    return Promise.resolve([...this.tasks.values()].filter((task) => task.status === 'PENDING').slice(0, limit).map((task) => structuredClone(task)));
  }

  public markCompleted(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task !== undefined) this.tasks.set(taskId, { ...task, status: 'COMPLETED', attempts: task.attempts + 1, updatedAt: new Date() });
    return Promise.resolve();
  }

  public markFailed(taskId: string, lastError: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task !== undefined) this.tasks.set(taskId, { ...task, attempts: task.attempts + 1, lastError, updatedAt: new Date() });
    return Promise.resolve();
  }

  public listRecent(limit = 200): Promise<StorageCleanupTask[]> {
    return Promise.resolve([...this.tasks.values()].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, limit).map((task) => structuredClone(task)));
  }
}

export function makeTestPhotoService(): {
  service: PhotoService;
  objects: InMemoryPhotoObjectRepository;
  metadata: InMemoryPhotoMetadataRepository;
  cleanup: InMemoryStorageCleanupTaskRepository;
} {
  const objects = new InMemoryPhotoObjectRepository();
  const metadata = new InMemoryPhotoMetadataRepository();
  const cleanup = new InMemoryStorageCleanupTaskRepository();
  return { service: new PhotoService(objects, metadata, cleanup, new ImageProcessingService()), objects, metadata, cleanup };
}
