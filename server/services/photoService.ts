import { randomUUID } from 'node:crypto';
import type { AuthorizedAdminProfile } from '../../src/models/admin';
import type { IncomingPhoto, PhotoKind, ProcessedPhoto, StoredPhotoMetadata } from '../models/photoDomain';
import type { PhotoMetadataRepository } from '../repositories/photoMetadataRepository';
import { PhotoDeletionError, type PhotoRepository, type PhotoStorageProvider } from '../repositories/photoRepository';
import type { StorageCleanupTaskRepository } from '../repositories/storageCleanupTaskRepository';
import { HttpError } from '../types/errors';
import type { ImageProcessingService } from './imageProcessingService';
import { ImageProcessingError } from './imageProcessingService';

export const MAX_INITIAL_PHOTOS = 3;
export const MAX_RESOLUTION_PHOTOS = 3;

export interface PreparedStoredPhotos {
  metadata: StoredPhotoMetadata[];
  uploadedPaths: string[];
}

export interface PhotoBinary {
  buffer: Buffer;
  contentType: 'image/webp';
}

function storageFolders(kind: PhotoKind): { full: string; thumbnail: string } {
  return kind === 'INITIAL'
    ? { full: 'initial', thumbnail: 'initial-thumbnails' }
    : { full: 'resolution', thumbnail: 'resolution-thumbnails' };
}

function safeStorageError(error: unknown): string {
  if (error instanceof Error) return error.name === '' ? 'StorageError' : error.name;
  return 'StorageError';
}

export class PhotoService {
  public constructor(
    private readonly objects: PhotoRepository,
    private readonly metadata: PhotoMetadataRepository,
    private readonly cleanupTasks: StorageCleanupTaskRepository,
    private readonly processor: ImageProcessingService,
  ) {}

  public async prepareAndUpload(
    occurrenceId: string,
    kind: PhotoKind,
    photos: IncomingPhoto[],
    createdBy: { type: 'PUBLIC' } | { type: 'ADMIN'; user: AuthorizedAdminProfile },
    correlationId: string,
  ): Promise<PreparedStoredPhotos> {
    const limit = kind === 'INITIAL' ? MAX_INITIAL_PHOTOS : MAX_RESOLUTION_PHOTOS;
    if (photos.length > limit) {
      throw new HttpError(400, 'PHOTO_COUNT_EXCEEDED', `É permitido anexar no máximo ${limit} fotografias nesta etapa.`);
    }
    if (photos.length === 0) return { metadata: [], uploadedPaths: [] };

    let processed: ProcessedPhoto[];
    try {
      processed = await Promise.all(photos.map((photo) => this.processor.process(photo)));
    } catch (error: unknown) {
      if (error instanceof ImageProcessingError) {
        const status = error.code === 'PHOTO_TOO_LARGE' ? 413 : 400;
        throw new HttpError(status, error.code, error.message);
      }
      throw new HttpError(422, 'PHOTO_PROCESSING_FAILED', 'Uma das fotografias não pôde ser processada com segurança.');
    }

    const now = new Date();
    const prepared: StoredPhotoMetadata[] = [];
    const attemptedPaths: string[] = [];
    try {
      for (const result of processed) {
        const photoId = randomUUID();
        const folders = storageFolders(kind);
        const storagePath = `occurrences/${occurrenceId}/${folders.full}/${photoId}.webp`;
        const thumbnailStoragePath = `occurrences/${occurrenceId}/${folders.thumbnail}/${photoId}.webp`;
        const objectMetadata = { occurrenceId, photoId, kind } as const;

        attemptedPaths.push(storagePath);
        await this.objects.save(storagePath, result.main.buffer, objectMetadata);
        attemptedPaths.push(thumbnailStoragePath);
        await this.objects.save(thumbnailStoragePath, result.thumbnail.buffer, objectMetadata);

        prepared.push({
          id: photoId,
          schemaVersion: 1,
          kind,
          visibility: 'INTERNAL',
          status: 'READY',
          storagePath,
          thumbnailStoragePath,
          contentType: 'image/webp',
          width: result.main.width,
          height: result.main.height,
          byteSize: result.main.byteSize,
          thumbnailByteSize: result.thumbnail.byteSize,
          sha256: result.sha256,
          createdAt: now,
          createdByType: createdBy.type,
          ...(createdBy.type === 'ADMIN' ? {
            createdByAdminUserId: createdBy.user.id,
            createdByRoleSnapshot: createdBy.user.role,
          } : {}),
        });
      }
      return { metadata: prepared, uploadedPaths: [...attemptedPaths] };
    } catch {
      await this.compensate(attemptedPaths, 'Falha durante upload de fotografia', correlationId);
      throw new HttpError(503, 'PHOTO_STORAGE_FAILED', 'Não foi possível armazenar as fotografias. Nenhuma fotografia foi vinculada à ocorrência.');
    }
  }

  public async compensate(paths: string[], reason: string, correlationId: string): Promise<void> {
    const unique = [...new Set(paths)];
    if (unique.length === 0) return;
    const failedByProvider = new Map<PhotoStorageProvider, string[]>();
    const recordFailure = (provider: PhotoStorageProvider, path: string): void => {
      failedByProvider.set(provider, [...(failedByProvider.get(provider) ?? []), path]);
    };
    for (const path of unique) {
      try {
        await this.objects.delete(path);
      } catch (error: unknown) {
        if (error instanceof PhotoDeletionError) {
          for (const provider of error.failedProviders) recordFailure(provider, path);
        } else {
          recordFailure(this.objects.provider, path);
        }
      }
    }
    for (const [provider, failedPaths] of failedByProvider) {
      try {
        await this.cleanupTasks.create(failedPaths, reason, provider);
      } catch (error: unknown) {
        console.error(`Falha operacional ao registrar tarefa de limpeza [${correlationId}]: ${safeStorageError(error)}`);
      }
    }
  }

  public async deleteObjectsOrQueue(photo: StoredPhotoMetadata, reason: string, correlationId: string): Promise<void> {
    await this.compensate([photo.storagePath, photo.thumbnailStoragePath], reason, correlationId);
  }

  public async getMetadata(occurrenceId: string, photoId: string): Promise<StoredPhotoMetadata | undefined> {
    return this.metadata.getById(occurrenceId, photoId);
  }

  public async listMetadata(occurrenceId: string): Promise<StoredPhotoMetadata[]> {
    return this.metadata.listByOccurrenceId(occurrenceId);
  }

  public async countReady(occurrenceId: string, kind: PhotoKind): Promise<number> {
    return this.metadata.countReadyByKind(occurrenceId, kind);
  }

  public async readVariant(photo: StoredPhotoMetadata, variant: 'thumbnail' | 'full'): Promise<PhotoBinary> {
    if (photo.status !== 'READY') throw new HttpError(404, 'PHOTO_NOT_FOUND', 'Fotografia não encontrada.');
    const path = variant === 'thumbnail' ? photo.thumbnailStoragePath : photo.storagePath;
    let buffer: Buffer | undefined;
    try {
      buffer = await this.objects.read(path);
    } catch {
      throw new HttpError(503, 'PHOTO_STORAGE_FAILED', 'A fotografia está temporariamente indisponível.');
    }
    if (buffer === undefined) throw new HttpError(404, 'PHOTO_NOT_FOUND', 'Fotografia não encontrada.');
    return { buffer, contentType: 'image/webp' };
  }
}
