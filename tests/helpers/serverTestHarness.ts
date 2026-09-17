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
import { DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS } from '../../server/repositories/infrastructureRepository';
import type { NotificationService } from '../../server/services/notificationService';
import type { InfrastructureService } from '../../server/services/infrastructureService';
import { trackRateLimiter, createOccurrenceRateLimiter, publicPhotoRateLimiter } from '../../server/middleware/rateLimit';

function adminUser(email: string, role: AdminUser['role'], active = true, uid?: string, legacyRole?: boolean): AdminUser {
  const normalizedEmail = email.toLowerCase();
  const now = '2026-08-10T12:00:00.000Z';
  return { id: hashNormalizedEmail(normalizedEmail), email: normalizedEmail, normalizedEmail, ...(uid === undefined ? {} : { uid }), displayName: email.split('@')[0] ?? email, role, teamIds: [], active, legacyRole: legacyRole ?? (role === 'Atendente'), createdAt: now, createdBy: 'test', updatedAt: now, updatedBy: 'test' };
}

const tokenUsers: Record<string, VerifiedFirebaseUser> = {
  'anonymous-token': { uid: 'anon-uid', emailVerified: false, provider: 'anonymous' },
  'admin-token': { uid: 'admin-uid', email: 'ADMIN@ifes.edu.br', emailVerified: true, displayName: 'Admin', provider: 'google.com' },
  'manager-token': { uid: 'manager-uid', email: 'gestor@ifes.edu.br', emailVerified: true, displayName: 'Gestor', provider: 'google.com' },
  'attendant-token': { uid: 'attendant-uid', email: 'atendente-ativo@ifes.edu.br', emailVerified: true, displayName: 'Atendente', provider: 'google.com' },
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
  trackRateLimiter.reset();
  createOccurrenceRateLimiter.reset();
  publicPhotoRateLimiter.reset();
  const environment: ServerEnvironment = {
    port: 0, nodeEnv: 'test', isProduction: false, firebaseProjectId: 'olhos-do-campus-test', firestoreDatabaseId: '(default)',
    firebaseConfigurationSource: 'environment', firebaseStorageBucket: 'olhos-do-campus-test.appspot.com', storageBucketConfigurationSource: 'environment', allowedAdminDomains: ['ifes.edu.br'],
    appCheckEnforcement: true, emulatorMode: false, authEmulatorHost: '', firestoreEmulatorHost: '', storageEmulatorHost: '',
    photoStorageProvider: 'firebase-storage', legacyPhotoFallbackEnabled: false,
    r2AccountId: undefined, r2AccessKeyId: undefined, r2SecretAccessKey: undefined, r2BucketName: undefined, r2Endpoint: undefined,
    emailProvider: 'resend',
    ewsEnabled: false, ewsUrl: undefined, ewsDomain: 'UPD1', ewsUsername: undefined, ewsPassword: undefined, ewsFrom: undefined,
    resendEnabled: false, resendApiKey: undefined, resendFrom: undefined, resendWebhookSecret: undefined,
    allowedWebOrigins: ['http://localhost:5173'], maintenanceHmacSecret: undefined, maintenanceReplayWindowSeconds: 300,
  };
  const events = new FakeOccurrenceEventRepository();
  const photo = makeTestPhotoService();
  const occurrences = new FakeOccurrenceRepository(events, photo.metadata);
  const adminUsers = new InMemoryAdminUserRepository([
    adminUser('admin@ifes.edu.br', 'Administrador', true, 'admin-uid'),
    adminUser('gestor@ifes.edu.br', 'Gestor', true, 'manager-uid'),
    adminUser('atendente-ativo@ifes.edu.br', 'Atendente', true, 'attendant-uid', false),
    adminUser('atendente@ifes.edu.br', 'Atendente', true, 'legacy-uid'),
    adminUser('inactive@ifes.edu.br', 'Gestor', false, 'inactive-uid'),
    adminUser('mismatch@ifes.edu.br', 'Gestor', true, 'expected-uid'),
  ]);
  const auditLogs = new InMemoryAuditLogRepository();
  const notificationService = {
    runtimeStatus: async () => ({ provider: 'Resend', environmentEnabled: false, applicationEnabled: false, effectiveEnabled: false, from: null, recipientCount: 0, configurationIssues: ['Desabilitado no ambiente.'], metrics: { sentToday: 0, sentThisMonth: 0, acceptedToday: 0, acceptedThisMonth: 0, acceptedTotal: 0, attemptsStarted: 0, attemptsAccepted: 0, attemptsDelivered: 0, attemptsFailed: 0, attemptsBounced: 0, attemptsComplained: 0, attemptsUncertain: 0, retries: 0, pending: 0, retryPending: 0, deliveryUncertain: 0, failed: 0, failedConfiguration: 0, delivered: 0, bounced: 0, complained: 0, unmatchedWebhookPending: 0, oldestPendingAt: null, oldestUnmatchedWebhookAt: null, lastAttemptAt: null, lastSuccessfulSendAt: null, lastError: null, lastFailureCategory: null } }),
    queueTest: async () => ({ queued: 0 }), requeue: async () => ({ queued: 0 }),
    processPending: async () => ({ claimed: 0, sent: 0, deferred: 0, failed: 0, uncertain: 0 }),
    processMaintenance: async () => ({ deliveries: { claimed: 0, sent: 0, deferred: 0, failed: 0, uncertain: 0 }, webhookReconciliation: { examined: 0, processed: 0, pending: 0, expired: 0, inconsistent: 0, deletedExpiredRetention: 0 } }),
    handleWebhook: async () => 'unmatched' as const,
  } as unknown as NotificationService;
  const infrastructureService = {
    overview: async () => ({settings:DEFAULT_INFRASTRUCTURE_CAPACITY_SETTINGS,latest:null,history:[],projections:[],notificationRuntime:{provider:'Resend',environmentEnabled:false,applicationEnabled:false,effectiveEnabled:false,from:null,recipientCount:0,configurationIssues:[]},levels:{r2:{percent:null,level:'Não medido'},firestore:{percent:null,level:'Não medido'},artifactRegistry:{percent:null,level:'Não medido'},resendDaily:{percent:0,level:'Normal'},resendMonthly:{percent:0,level:'Normal'}}}),
    history: async () => [], updateSettings: async () => { throw new Error('not implemented by the generic test harness'); },
    captureSnapshot: async () => { throw new Error('not implemented by the generic test harness'); },
    reconcile: async () => { throw new Error('not implemented by the generic test harness'); },
    processCleanup: async () => ({ inspectedTasks: 0, completedTasks: 0, failedTasks: 0, deletedObjects: 0 }),
  } as unknown as InfrastructureService;
  const app = createApp({
    environment,
    tokenVerifier: new TestTokenVerifier(), appCheckVerifier: new TestAppCheckVerifier(), adminUserRepository: adminUsers, auditLogRepository: auditLogs,
    occurrenceRepository: occurrences, occurrenceEventRepository: events,
    categoryRepository: new FakeCategoryRepository(REFERENCE_CATEGORIES), locationRepository: new FakeLocationRepository(REFERENCE_LOCATIONS),
    systemConfigRepository: new FakeSystemConfigRepository(DEFAULT_OPERATIONAL_CONFIG), operationalTeamRepository: new FakeOperationalTeamRepository(), slaConfigRepository: new FakeSlaConfigRepository(), photoService: photo.service,
    notificationService, infrastructureService,
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
