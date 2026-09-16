import type { DocumentData, DocumentSnapshot, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { StoredPhotoMetadata } from '../models/photoDomain';

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  throw new Error('Timestamp inválido no documento de fotografia.');
}

export function photoMetadataToFirestore(photo: StoredPhotoMetadata): DocumentData {
  return {
    schemaVersion: 1,
    kind: photo.kind,
    visibility: photo.visibility,
    status: photo.status,
    storagePath: photo.storagePath,
    thumbnailStoragePath: photo.thumbnailStoragePath,
    contentType: photo.contentType,
    width: photo.width,
    height: photo.height,
    byteSize: photo.byteSize,
    thumbnailByteSize: photo.thumbnailByteSize,
    sha256: photo.sha256,
    createdAt: Timestamp.fromDate(photo.createdAt),
    createdByType: photo.createdByType,
    ...(photo.createdByAdminUserId === undefined ? {} : { createdByAdminUserId: photo.createdByAdminUserId }),
    ...(photo.createdByRoleSnapshot === undefined ? {} : { createdByRoleSnapshot: photo.createdByRoleSnapshot }),
    ...(photo.deletedAt === undefined ? {} : { deletedAt: Timestamp.fromDate(photo.deletedAt) }),
    ...(photo.deletedByAdminUserId === undefined ? {} : { deletedByAdminUserId: photo.deletedByAdminUserId }),
  };
}

export function snapshotToPhotoMetadata(snapshot: DocumentSnapshot | QueryDocumentSnapshot): StoredPhotoMetadata {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    schemaVersion: 1,
    kind: data.kind as StoredPhotoMetadata['kind'],
    visibility: data.visibility as StoredPhotoMetadata['visibility'],
    status: data.status as StoredPhotoMetadata['status'],
    storagePath: String(data.storagePath ?? ''),
    thumbnailStoragePath: String(data.thumbnailStoragePath ?? ''),
    contentType: 'image/webp',
    width: Number(data.width ?? 0),
    height: Number(data.height ?? 0),
    byteSize: Number(data.byteSize ?? 0),
    thumbnailByteSize: Number(data.thumbnailByteSize ?? 0),
    sha256: String(data.sha256 ?? ''),
    createdAt: asDate(data.createdAt),
    createdByType: data.createdByType as StoredPhotoMetadata['createdByType'],
    createdByAdminUserId: optionalString(data.createdByAdminUserId),
    createdByRoleSnapshot: optionalString(data.createdByRoleSnapshot) as StoredPhotoMetadata['createdByRoleSnapshot'],
    deletedAt: data.deletedAt === undefined ? undefined : asDate(data.deletedAt),
    deletedByAdminUserId: optionalString(data.deletedByAdminUserId),
  };
}

export interface PhotoMetadataRepository {
  listByOccurrenceId(occurrenceId: string): Promise<StoredPhotoMetadata[]>;
  getById(occurrenceId: string, photoId: string): Promise<StoredPhotoMetadata | undefined>;
  countReadyByKind(occurrenceId: string, kind: StoredPhotoMetadata['kind']): Promise<number>;
}

export class FirestorePhotoMetadataRepository implements PhotoMetadataRepository {
  public constructor(private readonly firestore: Firestore) {}

  public async listByOccurrenceId(occurrenceId: string): Promise<StoredPhotoMetadata[]> {
    const snapshot = await this.firestore.collection('occurrences').doc(occurrenceId).collection('photos').orderBy('createdAt', 'asc').get();
    return snapshot.docs.map(snapshotToPhotoMetadata);
  }

  public async getById(occurrenceId: string, photoId: string): Promise<StoredPhotoMetadata | undefined> {
    const snapshot = await this.firestore.collection('occurrences').doc(occurrenceId).collection('photos').doc(photoId).get();
    return snapshot.exists ? snapshotToPhotoMetadata(snapshot) : undefined;
  }

  public async countReadyByKind(occurrenceId: string, kind: StoredPhotoMetadata['kind']): Promise<number> {
    const snapshot = await this.firestore.collection('occurrences').doc(occurrenceId).collection('photos')
      .where('kind', '==', kind).where('status', '==', 'READY').count().get();
    return snapshot.data().count;
  }
}
