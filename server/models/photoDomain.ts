import type { AdminRole } from '../../src/models/admin';

export const PHOTO_KINDS = ['INITIAL', 'RESOLUTION'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const PHOTO_VISIBILITIES = ['INTERNAL', 'PUBLIC'] as const;
export type PhotoVisibility = (typeof PHOTO_VISIBILITIES)[number];

export const PHOTO_STATUSES = ['READY', 'DELETED'] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

export interface StoredPhotoMetadata {
  id: string;
  schemaVersion: 1;
  kind: PhotoKind;
  visibility: PhotoVisibility;
  status: PhotoStatus;
  storagePath: string;
  thumbnailStoragePath: string;
  contentType: 'image/webp';
  width: number;
  height: number;
  byteSize: number;
  thumbnailByteSize: number;
  sha256: string;
  createdAt: Date;
  createdByType: 'PUBLIC' | 'ADMIN';
  createdByAdminUserId?: string;
  createdByRoleSnapshot?: AdminRole;
  deletedAt?: Date;
  deletedByAdminUserId?: string;
}

export interface ProcessedImageVariant {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
}

export interface ProcessedPhoto {
  contentType: 'image/webp';
  main: ProcessedImageVariant;
  thumbnail: ProcessedImageVariant;
  sha256: string;
}

export interface IncomingPhoto {
  buffer: Buffer;
  declaredMimeType?: string;
}

export interface StorageCleanupTask {
  id: string;
  storagePaths: string[];
  reason: string;
  status: 'PENDING' | 'COMPLETED';
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
}
