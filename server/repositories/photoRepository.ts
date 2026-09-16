import type { PhotoKind } from '../models/photoDomain';

export interface PhotoObjectMetadata {
  occurrenceId: string;
  photoId: string;
  kind: PhotoKind;
}

export interface PhotoObjectInfo {
  path: string;
  contentType?: string;
  size?: number;
  metadata?: Record<string, string>;
}

export interface PhotoRepository {
  save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void>;
  read(path: string): Promise<Buffer | undefined>;
  delete(path: string): Promise<void>;
  getMetadata(path: string): Promise<PhotoObjectInfo | undefined>;
}
