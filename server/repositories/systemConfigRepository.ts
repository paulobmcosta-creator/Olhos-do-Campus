import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { SystemConfig } from '../../src/models/config';

const DOCUMENT_PATH = 'systemSettings/operational';

function parseConfig(data: DocumentData): SystemConfig {
  return {
    institutionDisplayName: String(data.institutionDisplayName ?? ''),
    protocolPrefix: String(data.protocolPrefix ?? ''),
    notificationEmails: Array.isArray(data.notificationEmails)
      ? data.notificationEmails.filter((item): item is string => typeof item === 'string')
      : [],
    emailNotificationsEnabled: data.emailNotificationsEnabled === true,
    autoAssignRisk: data.autoAssignRisk === true,
    serviceNotice: String(data.serviceNotice ?? ''),
  };
}

export interface SystemConfigRepository {
  get(): Promise<SystemConfig | undefined>;
  update(config: SystemConfig, updatedBy: string): Promise<SystemConfig>;
  seed(config: SystemConfig, updatedBy: string): Promise<void>;
}

export class FirestoreSystemConfigRepository implements SystemConfigRepository {
  private readonly document;
  public constructor(firestore: Firestore) {
    this.document = firestore.doc(DOCUMENT_PATH);
  }

  public async get(): Promise<SystemConfig | undefined> {
    const snapshot = await this.document.get();
    return snapshot.exists ? parseConfig(snapshot.data() ?? {}) : undefined;
  }

  public async update(config: SystemConfig, updatedBy: string): Promise<SystemConfig> {
    await this.document.set({
      ...config,
      updatedAt: Timestamp.now(),
      updatedBy,
      schemaVersion: 1,
    }, { merge: true });
    return config;
  }

  public async seed(config: SystemConfig, updatedBy: string): Promise<void> {
    const snapshot = await this.document.get();
    if (snapshot.exists) return;
    await this.document.create({
      ...config,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy,
      schemaVersion: 1,
    });
  }
}
