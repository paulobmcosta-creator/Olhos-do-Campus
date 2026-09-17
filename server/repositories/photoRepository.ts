import type { PhotoKind } from '../models/photoDomain';

export type PhotoStorageProvider = 'r2' | 'firebase-storage';

export interface PhotoObjectMetadata {
  occurrenceId: string;
  photoId: string;
  kind: PhotoKind;
}

export interface PhotoObjectInfo {
  path: string;
  contentType?: string;
  size?: number;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface PhotoObjectPage {
  items: PhotoObjectInfo[];
  nextCursor?: string;
}

export interface PhotoRepository {
  readonly provider: PhotoStorageProvider;
  save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void>;
  read(path: string): Promise<Buffer | undefined>;
  delete(path: string): Promise<void>;
  getMetadata(path: string): Promise<PhotoObjectInfo | undefined>;
  listPage(prefix: string, cursor?: string, limit?: number): Promise<PhotoObjectPage>;
}

export class PhotoDeletionError extends Error {
  public constructor(public readonly failedProviders: readonly PhotoStorageProvider[]) {
    super(`PHOTO_DELETE_PARTIAL_FAILURE:${[...new Set(failedProviders)].join(',')}`);
    this.name = 'PhotoDeletionError';
  }
}
