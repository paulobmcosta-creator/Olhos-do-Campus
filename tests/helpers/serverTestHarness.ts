import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AdminUser } from '../../src/models/admin';
import { createApp } from '../../server/app';
import type { ServerEnvironment } from '../../server/config/env';
import { InMemoryAdminUserRepository } from '../../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../../server/repositories/auditLogRepository';
import { DEFAULT_OPERATIONAL_CONFIG, REFERENCE_LOCATIONS, REFERENCE_CATEGORIES } from '../../server/repositories/referenceSeedData';
import type { AppCheckVerifier, FirebaseTokenVerifier, VerifiedFirebaseUser } from '../../server/types/firebase';
import { hashNormalizedEmail } from '../../server/utils/email';
import { FakeCategoryRepository, FakeLocationRepository, FakeOccurrenceEventRepository, FakeOccurrenceRepository, FakeOperationalTeamRepository, FakeSlaConfigRepository, FakeSystemConfigRepository } from './fakeRepositories';
import { makeTestPhotoService } from './fakePhotoInfrastructure';

function adminUser(email: string, role: AdminUser['role'], active = true, uid?: string): AdminUser {
  const normalizedEmail = email.toLowerCase();
  const now = '2026-08-10T12:00:00.000Z';
  return { id: hashNormalizedEmail(normalizedEmail), email: normalizedEmail, normalizedEmail, ...(uid === undefined ? {} : { uid }), displayName: email.split('@')[0] ?? email, role, teamIds: [], active, legacyRole: role === 'Atendente', createdAt: now, createdBy: 'test', updatedAt: now, updatedBy: 'test' };
}

const tokenUsers: Record<string, VerifiedFirebaseUser> = {
  'anonymous-token': { uid: 'anon-uid', emailVerified: false, provider: 'anonymous' },
  'admin-token': { uid: 'admin-uid', email: 'ADMIN@ifes.edu.br', emailVerified: true, displayName: 'Admin', provider: 'google.com' },
  'manager-token': { uid: 'manager-uid', email: 'gestor@ifes.edu.br', emailVerified: true, displayName: 'Gestor', provider: 'google.com' },
  'legacy-token': { uid: 'legacy-uid', email: 'atendente@ifes.edu.br', emailVerified: true, displayName: 'Papel legado', provider: 'google.com' },
  'unverified-token': { uid: 'unverified-uid', email: 'unverified@ifes.edu.br', emailVerified: false, provider: 'google.com' },
  'password-token': { uid: 'password-uid', email: 'password@ifes.edu.br', emailVerified: true, provider: 'password' },
  'other-domain-token': { uid: 'other-uid', email: 'person@example.org', emailVerified: true, provider: 'google.com' },
  'unknown-token': { uid: 'unknown-uid', email: 'unknown@ifes.edu.br', emailVerified: true, provider: 'google.com' },
  'inactive-token': { uid: 'inactive-uid', email: 'inactive@ifes.edu.br', emailVerified: true, provider: 'google.com' },
  'mismatch-token': { uid: 'wrong-uid', email: 'mismatch@ifes.edu.br', emailVerified: true, provider: 'google.com' },
};

class TestTokenVerifier implements FirebaseTokenVerifier {
  public async verifyIdToken(token: string): Promise<VerifiedFirebaseUser> {
    await Promise.resolve();
    const user = tokenUsers[token];
    if (user === undefined) throw new Error('invalid token');
    return structuredClone(user);
  }
}
class TestAppCheckVerifier implements AppCheckVerifier {
  public async verifyToken(token: string): Promise<void> { await Promise.resolve(); if (token !== 'valid-app-check') throw new Error('invalid app check'); }
}

export interface TestHarness {
  baseUrl: string;
  server: Server;
  occurrences: FakeOccurrenceRepository;
  events: FakeOccurrenceEventRepository;
  adminUsers: InMemoryAdminUserRepository;
  auditLogs: InMemoryAuditLogRepository;
  close: () => Promise<void>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const environment: ServerEnvironment = {
    port: 0, nodeEnv: 'test', isProduction: false, firebaseProjectId: 'olhos-do-campus-test', firestoreDatabaseId: '(default)',
    firebaseConfigurationSource: 'environment', firebaseStorageBucket: 'olhos-do-campus-test.appspot.com', storageBucketConfigurationSource: 'environment', allowedAdminDomains: ['ifes.edu.br'],
    appCheckEnforcement: true, emulatorMode: false, authEmulatorHost: '', firestoreEmulatorHost: '', storageEmulatorHost: '',
  };
  const events = new FakeOccurrenceEventRepository();
  const photo = makeTestPhotoService();
  const occurrences = new FakeOccurrenceRepository(events, photo.metadata);
  const adminUsers = new InMemoryAdminUserRepository([
    adminUser('admin@ifes.edu.br', 'Administrador', true, 'admin-uid'),
    adminUser('gestor@ifes.edu.br', 'Gestor', true, 'manager-uid'),
    adminUser('atendente@ifes.edu.br', 'Atendente', true, 'legacy-uid'),
    adminUser('inactive@ifes.edu.br', 'Gestor', false, 'inactive-uid'),
    adminUser('mismatch@ifes.edu.br', 'Gestor', true, 'expected-uid'),
  ]);
  const auditLogs = new InMemoryAuditLogRepository();
  const app = createApp({
    environment,
    tokenVerifier: new TestTokenVerifier(), appCheckVerifier: new TestAppCheckVerifier(), adminUserRepository: adminUsers, auditLogRepository: auditLogs,
    occurrenceRepository: occurrences, occurrenceEventRepository: events,
    categoryRepository: new FakeCategoryRepository(REFERENCE_CATEGORIES), locationRepository: new FakeLocationRepository(REFERENCE_LOCATIONS),
    systemConfigRepository: new FakeSystemConfigRepository(DEFAULT_OPERATIONAL_CONFIG), operationalTeamRepository: new FakeOperationalTeamRepository(), slaConfigRepository: new FakeSlaConfigRepository(), photoService: photo.service,
  });
  const server = await new Promise<Server>((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, occurrences, events, adminUsers, auditLogs, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

export function headers(token?: string, appCheck = 'valid-app-check'): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }), ...(appCheck === '' ? {} : { 'X-Firebase-AppCheck': appCheck }) };
}

export const validOccurrenceBody = {
  location: { campusId: 'ifes-bsf', buildingId: 'bloco-01', floorId: 'sem-pavimento', roomId: 'sala-de-aula-1' },
  categoryId: 'cat-iluminacao',
  description: 'A luminária do ambiente não está funcionando durante o período de uso.',
  immediateRisk: false,
} as const;

export function multipartHeaders(token?: string, appCheck = 'valid-app-check'): Record<string, string> {
  return {
    ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    ...(appCheck === '' ? {} : { 'X-Firebase-AppCheck': appCheck }),
  };
}

export function occurrenceFormData(
  payload: unknown = validOccurrenceBody,
  photos: Array<{ bytes: Uint8Array; type: string; name?: string }> = [],
): FormData {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  for (const [index, photo] of photos.entries()) {
    form.append('photos', new Blob([photo.bytes], { type: photo.type }), photo.name ?? `photo-${index + 1}`);
  }
  return form;
}
