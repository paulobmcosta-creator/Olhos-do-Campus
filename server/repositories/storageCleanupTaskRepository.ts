import type { DocumentData, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { StorageCleanupTask } from '../models/photoDomain';

function taskFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): StorageCleanupTask {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    storagePaths: Array.isArray(data.storagePaths) ? data.storagePaths.map(String) : [],
    reason: String(data.reason ?? ''),
    status: data.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    attempts: Number(data.attempts ?? 0),
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(0),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(0),
    ...(typeof data.lastError === 'string' && data.lastError !== '' ? { lastError: data.lastError } : {}),
    storageProvider: data.storageProvider === 'r2' ? 'r2' : 'firebase-storage',
  };
}

export interface StorageCleanupTaskRepository {
  create(storagePaths: string[], reason: string, storageProvider?: 'r2' | 'firebase-storage'): Promise<string>;
  listPending(limit?: number): Promise<StorageCleanupTask[]>;
  markCompleted(taskId: string): Promise<void>;
  markFailed(taskId: string, lastError: string): Promise<void>;
  listRecent(limit?: number): Promise<StorageCleanupTask[]>;
}

export class FirestoreStorageCleanupTaskRepository implements StorageCleanupTaskRepository {
  private readonly collection;

  public constructor(firestore: Firestore) {
    this.collection = firestore.collection('storageCleanupTasks');
  }

  public async create(storagePaths: string[], reason: string, storageProvider: 'r2' | 'firebase-storage' = 'firebase-storage'): Promise<string> {
    const now = new Date();
    const reference = this.collection.doc();
    await reference.create({
      schemaVersion: 1,
      storagePaths: [...new Set(storagePaths)],
      reason: reason.slice(0, 300),
      status: 'PENDING',
      attempts: 0,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      storageProvider,
    });
    return reference.id;
  }

  public async listPending(limit = 100): Promise<StorageCleanupTask[]> {
    const snapshot = await this.collection.where('status', '==', 'PENDING').limit(Math.min(Math.max(limit, 1), 500)).get();
    return snapshot.docs.map(taskFromSnapshot);
  }

  public async markCompleted(taskId: string): Promise<void> {
    await this.collection.doc(taskId).update({
      status: 'COMPLETED',
      attempts: FieldValue.increment(1),
      updatedAt: Timestamp.fromDate(new Date()),
      lastError: null,
    });
  }

  public async markFailed(taskId: string, lastError: string): Promise<void> {
    await this.collection.doc(taskId).update({
      attempts: FieldValue.increment(1),
      updatedAt: Timestamp.fromDate(new Date()),
      lastError: lastError.slice(0, 500),
    });
  }

  public async listRecent(limit = 200): Promise<StorageCleanupTask[]> {
    const snapshot = await this.collection.orderBy('updatedAt', 'desc').limit(Math.min(Math.max(limit, 1), 500)).get();
    return snapshot.docs.map(taskFromSnapshot);
  }

}
