import type { Storage } from 'firebase-admin/storage';
import type { PhotoObjectInfo, PhotoObjectMetadata, PhotoRepository } from './photoRepository';

type Bucket = ReturnType<Storage['bucket']>;

const SAFE_STORAGE_PATH = /^occurrences\/[A-Za-z0-9_-]+\/(?:initial|initial-thumbnails|resolution|resolution-thumbnails)\/[A-Za-z0-9_-]+\.webp$/u;

function assertServerStoragePath(path: string): void {
  if (!SAFE_STORAGE_PATH.test(path) || path.includes('..') || path.startsWith('/')) {
    throw new Error('PHOTO_STORAGE_PATH_INVALID');
  }
}

function numericSize(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class CloudStoragePhotoRepository implements PhotoRepository {
  public constructor(private readonly bucket: Bucket) {}

  public async save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void> {
    assertServerStoragePath(path);
    const file = this.bucket.file(path);
    await file.save(buffer, {
      resumable: false,
      validation: 'crc32c',
      metadata: {
        contentType: 'image/webp',
        contentDisposition: 'inline',
        cacheControl: 'private, no-store, max-age=0',
        metadata: {
          occurrenceId: metadata.occurrenceId,
          photoId: metadata.photoId,
          kind: metadata.kind,
          schemaVersion: '1',
        },
      },
    });
  }

  public async read(path: string): Promise<Buffer | undefined> {
    assertServerStoragePath(path);
    const file = this.bucket.file(path);
    try {
      const [buffer] = await file.download();
      return buffer;
    } catch (error: unknown) {
      if (this.isNotFound(error)) return undefined;
      throw error;
    }
  }

  public async delete(path: string): Promise<void> {
    assertServerStoragePath(path);
    await this.bucket.file(path).delete({ ignoreNotFound: true });
  }

  public async getMetadata(path: string): Promise<PhotoObjectInfo | undefined> {
    assertServerStoragePath(path);
    try {
      const [metadata] = await this.bucket.file(path).getMetadata();
      const custom = metadata.metadata;
      return {
        path,
        ...(metadata.contentType === undefined ? {} : { contentType: metadata.contentType }),
        ...(numericSize(metadata.size) === undefined ? {} : { size: numericSize(metadata.size) }),
        ...(custom === undefined ? {} : { metadata: Object.fromEntries(Object.entries(custom).map(([key, value]) => [key, String(value)])) }),
      };
    } catch (error: unknown) {
      if (this.isNotFound(error)) return undefined;
      throw error;
    }
  }

  private isNotFound(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const record = error as { code?: unknown };
    return record.code === 404 || record.code === '404';
  }
}
