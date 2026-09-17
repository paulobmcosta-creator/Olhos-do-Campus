import type { DocumentData, DocumentReference, DocumentSnapshot, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import {
  applyDeliveryAttemptWebhookState,
  applyNotificationWebhookState,
  PROVIDER_IDEMPOTENCY_WINDOW_MS,
} from '../domain/notificationDeliveryState';
import { deliveryAttemptId, deliveryAttemptIdempotencyKey } from '../domain/notificationOutbox';
import type {
  NotificationDeliveryAttempt,
  NotificationDeliveryMetrics,
  NotificationFailureCategory,
  NotificationOutboxItem,
  NotificationRetryMode,
  NotificationRetrySafety,
  NotificationStatus,
  NotificationWebhookEvent,
  NotificationWebhookRecord,
  NotificationWebhookReconciliationResult,
  NotificationWebhookStatus,
} from '../models/notificationDomain';

const TECHNICAL_ID_PATTERN = /^[a-f0-9]{64}$/u;
const WEBHOOK_UNMATCHED_WINDOW_MS = 72 * 60 * 60_000;
const WEBHOOK_RETENTION_MS = 90 * 24 * 60 * 60_000;
const WEBHOOK_MAX_ATTEMPTS = 12;
const WEBHOOK_MAX_BACKOFF_MS = 6 * 60 * 60_000;
export const MAX_TECHNICAL_RETRIES = 4;
const TECHNICAL_RETRY_BASE_DELAY_MS = 30_000;
const TECHNICAL_RETRY_MAX_DELAY_MS = 15 * 60_000;

function date(value: unknown): Date | undefined {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value);
  return undefined;
}

function requiredDate(value: unknown): Date { return date(value) ?? new Date(0); }
function stringOrEmpty(value: unknown): string { return typeof value === 'string' ? value : ''; }

function failureCategory(value: unknown): NotificationFailureCategory | undefined {
  return ['TRANSIENT','QUOTA','CONFIGURATION','INVALID_RECIPIENT','SUPPRESSION','BOUNCE','COMPLAINT','UNKNOWN'].includes(String(value))
    ? value as NotificationFailureCategory
    : undefined;
}

function retryMode(value: unknown): NotificationRetryMode | undefined {
  return ['SAME_ATTEMPT','NEW_ATTEMPT'].includes(String(value)) ? value as NotificationRetryMode : undefined;
}

function retrySafety(value: unknown): NotificationRetrySafety | undefined {
  return ['IDEMPOTENCY_WINDOW','PROVIDER_REJECTED'].includes(String(value)) ? value as NotificationRetrySafety : undefined;
}

export function technicalRetryDelayMilliseconds(retryCount: number): number {
  const bounded = Math.min(Math.max(retryCount, 1), MAX_TECHNICAL_RETRIES);
  return Math.min(TECHNICAL_RETRY_BASE_DELAY_MS * (2 ** (bounded - 1)), TECHNICAL_RETRY_MAX_DELAY_MS);
}

function webhookStatus(value: unknown): NotificationWebhookStatus {
  return ['UNMATCHED_PENDING','PROCESSED','UNMATCHED_EXPIRED','INCONSISTENT'].includes(String(value))
    ? value as NotificationWebhookStatus
    : 'PROCESSED';
}

function sanitizeFailureReason(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (/quota|rate|reached_(?:daily|monthly)|limit/u.test(normalized)) return 'quota_limit';
  if (/temporary|transient|timeout|unavailable|internal|connection/u.test(normalized)) return 'temporary_unavailable';
  if (/api.?key|domain|auth|sender|from_address|configuration|verif/u.test(normalized)) return 'domain_not_verified';
  if (/invalid.?recipient|recipient.*invalid|invalid.?email|invalid.?address/u.test(normalized)) return 'invalid_recipient';
  if (/suppress/u.test(normalized)) return 'recipient_suppressed';
  return 'unexpected_failure';
}

function webhookBackoffMilliseconds(attemptCount: number): number {
  const bounded = Math.min(Math.max(attemptCount, 1), WEBHOOK_MAX_ATTEMPTS);
  return Math.min(60_000 * (2 ** (bounded - 1)), WEBHOOK_MAX_BACKOFF_MS);
}

function webhookRecordFromSnapshot(snapshot: DocumentSnapshot | QueryDocumentSnapshot): NotificationWebhookRecord {
  const data = snapshot.data() ?? {};
  return {
    schemaVersion: data.schemaVersion === 3 ? 3 : 2,
    eventId: snapshot.id,
    eventType: data.eventType as NotificationWebhookEvent['eventType'],
    providerMessageId: stringOrEmpty(data.providerMessageId),
    ...(typeof data.notificationId === 'string' ? { notificationId: data.notificationId } : {}),
    ...(typeof data.attemptId === 'string' ? { attemptId: data.attemptId } : {}),
    occurredAt: requiredDate(data.occurredAt),
    ...(typeof data.failureReason === 'string' ? { failureReason: data.failureReason } : {}),
    status: webhookStatus(data.status),
    firstSeenAt: requiredDate(data.firstSeenAt),
    lastAttemptAt: requiredDate(data.lastAttemptAt),
    attemptCount: Number(data.attemptCount ?? 0),
    ...(date(data.nextAttemptAt) === undefined ? {} : { nextAttemptAt: date(data.nextAttemptAt) }),
    ...(date(data.processedAt) === undefined ? {} : { processedAt: date(data.processedAt) }),
    ...(typeof data.targetNotificationId === 'string' ? { targetNotificationId: data.targetNotificationId } : {}),
    ...(typeof data.targetAttemptId === 'string' ? { targetAttemptId: data.targetAttemptId } : {}),
    ...(typeof data.lastErrorCode === 'string' ? { lastErrorCode: data.lastErrorCode } : {}),
    retentionUntil: requiredDate(data.retentionUntil),
  };
}

function webhookToFirestore(record: NotificationWebhookRecord): DocumentData {
  const sanitizedFailureReason = sanitizeFailureReason(record.failureReason);
  return {
    schemaVersion: 3,
    eventType: record.eventType,
    providerMessageId: record.providerMessageId,
    ...(record.notificationId === undefined ? {} : { notificationId: record.notificationId }),
    ...(record.attemptId === undefined ? {} : { attemptId: record.attemptId }),
    occurredAt: Timestamp.fromDate(record.occurredAt),
    ...(sanitizedFailureReason === undefined ? {} : { failureReason: sanitizedFailureReason }),
    status: record.status,
    firstSeenAt: Timestamp.fromDate(record.firstSeenAt),
    lastAttemptAt: Timestamp.fromDate(record.lastAttemptAt),
    attemptCount: record.attemptCount,
    ...(record.nextAttemptAt === undefined ? {} : { nextAttemptAt: Timestamp.fromDate(record.nextAttemptAt) }),
    ...(record.processedAt === undefined ? {} : { processedAt: Timestamp.fromDate(record.processedAt) }),
    ...(record.targetNotificationId === undefined ? {} : { targetNotificationId: record.targetNotificationId }),
    ...(record.targetAttemptId === undefined ? {} : { targetAttemptId: record.targetAttemptId }),
    ...(record.lastErrorCode === undefined ? {} : { lastErrorCode: record.lastErrorCode.slice(0, 120) }),
    retentionUntil: Timestamp.fromDate(record.retentionUntil),
  };
}

export function notificationToFirestore(item: NotificationOutboxItem): DocumentData {
  return {
    schemaVersion: item.schemaVersion,
    eventType: item.eventType,
    entityType: item.entityType,
    entityId: item.entityId,
    ...(item.occurrenceId === undefined ? {} : { occurrenceId: item.occurrenceId }),
    protocol: item.protocol,
    recipient: item.recipient,
    recipientHash: item.recipientHash,
    status: item.status,
    attemptCount: item.attemptCount,
    provider: item.provider,
    ...(item.providerMessageId === undefined ? {} : { providerMessageId: item.providerMessageId }),
    idempotencyKey: item.idempotencyKey,
    ...(item.currentAttemptId === undefined ? {} : { currentAttemptId: item.currentAttemptId }),
    ...(item.retryMode === undefined ? {} : { retryMode: item.retryMode }),
    ...(item.retrySafety === undefined ? {} : { retrySafety: item.retrySafety }),
    ...(item.idempotencySafeUntil === undefined ? {} : { idempotencySafeUntil: Timestamp.fromDate(item.idempotencySafeUntil) }),
    ...(item.providerAcceptedAt === undefined ? {} : { providerAcceptedAt: Timestamp.fromDate(item.providerAcceptedAt) }),
    ...(item.lastProviderEventAt === undefined ? {} : { lastProviderEventAt: Timestamp.fromDate(item.lastProviderEventAt) }),
    ...(item.lastProviderEventType === undefined ? {} : { lastProviderEventType: item.lastProviderEventType }),
    templateVersion: item.templateVersion,
    templateData: {
      occurredAt: Timestamp.fromDate(item.templateData.occurredAt),
      category: item.templateData.category,
      location: item.templateData.location,
      priority: item.templateData.priority,
      immediateRisk: item.templateData.immediateRisk,
      ...(item.templateData.teamName !== undefined ? { teamName: item.templateData.teamName } : {}),
      ...(item.templateData.responsibleName !== undefined ? { responsibleName: item.templateData.responsibleName } : {}),
    },
    createdAt: Timestamp.fromDate(item.createdAt),
    updatedAt: Timestamp.fromDate(item.updatedAt),
    nextAttemptAt: Timestamp.fromDate(item.nextAttemptAt),
    ...(item.lastAttemptAt === undefined ? {} : { lastAttemptAt: Timestamp.fromDate(item.lastAttemptAt) }),
    ...(item.sentAt === undefined ? {} : { sentAt: Timestamp.fromDate(item.sentAt) }),
    ...(item.deliveredAt === undefined ? {} : { deliveredAt: Timestamp.fromDate(item.deliveredAt) }),
    ...(item.failedAt === undefined ? {} : { failedAt: Timestamp.fromDate(item.failedAt) }),
    ...(item.lastFailureCategory === undefined ? {} : { lastFailureCategory: item.lastFailureCategory }),
    ...(item.lastErrorCode === undefined ? {} : { lastErrorCode: item.lastErrorCode }),
    ...(item.lastErrorSummary === undefined ? {} : { lastErrorSummary: item.lastErrorSummary.slice(0, 500) }),
    ...(item.leaseUntil === undefined ? {} : { leaseUntil: Timestamp.fromDate(item.leaseUntil) }),
    ...(item.leaseOwner === undefined ? {} : { leaseOwner: item.leaseOwner }),
  };
}

function fromSnapshot(snapshot: DocumentSnapshot | QueryDocumentSnapshot): NotificationOutboxItem {
  const data = snapshot.data() ?? {};
  const templateData = data.templateData as Record<string, unknown> | undefined;
  return {
    schemaVersion: data.schemaVersion === 2 ? 2 : 1,
    id: snapshot.id,
    eventType: data.eventType === 'ADMIN_TEST' ? 'ADMIN_TEST' : 'OCCURRENCE_CREATED',
    entityType: data.entityType === 'notificationTest' ? 'notificationTest' : 'occurrence',
    entityId: String(data.entityId ?? ''),
    ...(typeof data.occurrenceId === 'string' ? { occurrenceId: data.occurrenceId } : {}),
    protocol: String(data.protocol ?? ''),
    recipient: String(data.recipient ?? ''),
    recipientHash: String(data.recipientHash ?? ''),
    status: data.status as NotificationStatus,
    attemptCount: Number(data.attemptCount ?? 0),
    provider: data.provider === 'ews' ? 'ews' : 'resend',
    ...(typeof data.providerMessageId === 'string' ? { providerMessageId: data.providerMessageId } : {}),
    idempotencyKey: String(data.idempotencyKey ?? ''),
    ...(typeof data.currentAttemptId === 'string' ? { currentAttemptId: data.currentAttemptId } : {}),
    ...(retryMode(data.retryMode) === undefined ? {} : { retryMode: retryMode(data.retryMode) }),
    ...(retrySafety(data.retrySafety) === undefined ? {} : { retrySafety: retrySafety(data.retrySafety) }),
    ...(date(data.idempotencySafeUntil) === undefined ? {} : { idempotencySafeUntil: date(data.idempotencySafeUntil) }),
    ...(date(data.providerAcceptedAt) === undefined ? {} : { providerAcceptedAt: date(data.providerAcceptedAt) }),
    ...(date(data.lastProviderEventAt) === undefined ? {} : { lastProviderEventAt: date(data.lastProviderEventAt) }),
    ...(typeof data.lastProviderEventType === 'string' ? { lastProviderEventType: data.lastProviderEventType as NotificationWebhookEvent['eventType'] } : {}),
    templateVersion: data.templateVersion === 'notification-test-v1' ? 'notification-test-v1' : 'occurrence-created-v1',
    templateData: {
      occurredAt: requiredDate(templateData?.occurredAt),
      category: stringOrEmpty(templateData?.category),
      location: stringOrEmpty(templateData?.location),
      priority: stringOrEmpty(templateData?.priority),
      immediateRisk: templateData?.immediateRisk === true,
      ...(typeof templateData?.teamName === 'string' && templateData.teamName.trim() !== '' ? { teamName: templateData.teamName } : {}),
      ...(typeof templateData?.responsibleName === 'string' && templateData.responsibleName.trim() !== '' ? { responsibleName: templateData.responsibleName } : {}),
    },
    createdAt: requiredDate(data.createdAt),
    updatedAt: requiredDate(data.updatedAt),
    nextAttemptAt: requiredDate(data.nextAttemptAt),
    ...(date(data.lastAttemptAt) === undefined ? {} : { lastAttemptAt: date(data.lastAttemptAt) }),
    ...(date(data.sentAt) === undefined ? {} : { sentAt: date(data.sentAt) }),
    ...(date(data.deliveredAt) === undefined ? {} : { deliveredAt: date(data.deliveredAt) }),
    ...(date(data.failedAt) === undefined ? {} : { failedAt: date(data.failedAt) }),
    ...(failureCategory(data.lastFailureCategory) === undefined ? {} : { lastFailureCategory: failureCategory(data.lastFailureCategory) }),
    ...(typeof data.lastErrorCode === 'string' ? { lastErrorCode: data.lastErrorCode } : {}),
    ...(typeof data.lastErrorSummary === 'string' ? { lastErrorSummary: data.lastErrorSummary } : {}),
    ...(date(data.leaseUntil) === undefined ? {} : { leaseUntil: date(data.leaseUntil) }),
    ...(typeof data.leaseOwner === 'string' ? { leaseOwner: data.leaseOwner } : {}),
  };
}

function deliveryAttemptToFirestore(attempt: NotificationDeliveryAttempt): DocumentData {
  return {
    schemaVersion: 1,
    notificationId: attempt.notificationId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    idempotencyKey: attempt.idempotencyKey,
    technicalRetryCount: attempt.technicalRetryCount,
    ...(attempt.retryMode === undefined ? {} : { retryMode: attempt.retryMode }),
    ...(attempt.retrySafety === undefined ? {} : { retrySafety: attempt.retrySafety }),
    ...(attempt.nextAttemptAt === undefined ? {} : { nextAttemptAt: Timestamp.fromDate(attempt.nextAttemptAt) }),
    createdAt: Timestamp.fromDate(attempt.createdAt),
    startedAt: Timestamp.fromDate(attempt.startedAt),
    updatedAt: Timestamp.fromDate(attempt.updatedAt),
    ...(attempt.providerAcceptedAt === undefined ? {} : { providerAcceptedAt: Timestamp.fromDate(attempt.providerAcceptedAt) }),
    ...(attempt.providerMessageId === undefined ? {} : { providerMessageId: attempt.providerMessageId }),
    ...(attempt.completedAt === undefined ? {} : { completedAt: Timestamp.fromDate(attempt.completedAt) }),
    ...(attempt.failureCategory === undefined ? {} : { failureCategory: attempt.failureCategory }),
    ...(attempt.lastErrorCode === undefined ? {} : { lastErrorCode: attempt.lastErrorCode.slice(0, 120) }),
    ...(attempt.lastErrorSummary === undefined ? {} : { lastErrorSummary: attempt.lastErrorSummary.slice(0, 500) }),
    ...(attempt.lastProviderEventAt === undefined ? {} : { lastProviderEventAt: Timestamp.fromDate(attempt.lastProviderEventAt) }),
    ...(attempt.lastProviderEventType === undefined ? {} : { lastProviderEventType: attempt.lastProviderEventType }),
  };
}

function deliveryAttemptFromSnapshot(snapshot: DocumentSnapshot | QueryDocumentSnapshot): NotificationDeliveryAttempt {
  const data = snapshot.data() ?? {};
  const rawStatus = String(data.status ?? 'PROCESSING');
  const status: NotificationDeliveryAttempt['status'] = ['PROCESSING','RETRY_PENDING','ACCEPTED','UNCERTAIN','DELIVERED','BOUNCED','COMPLAINED','FAILED','SUPPRESSED'].includes(rawStatus)
    ? rawStatus as NotificationDeliveryAttempt['status']
    : 'PROCESSING';
  return {
    schemaVersion: 1,
    id: snapshot.id,
    notificationId: String(data.notificationId ?? snapshot.ref.parent.parent?.id ?? ''),
    attemptNumber: Number(data.attemptNumber ?? 1),
    status,
    idempotencyKey: String(data.idempotencyKey ?? ''),
    technicalRetryCount: Number(data.technicalRetryCount ?? 0),
    ...(retryMode(data.retryMode) === undefined ? {} : { retryMode: retryMode(data.retryMode) }),
    ...(retrySafety(data.retrySafety) === undefined ? {} : { retrySafety: retrySafety(data.retrySafety) }),
    ...(date(data.nextAttemptAt) === undefined ? {} : { nextAttemptAt: date(data.nextAttemptAt) }),
    createdAt: requiredDate(data.createdAt),
    startedAt: requiredDate(data.startedAt),
    updatedAt: requiredDate(data.updatedAt),
    ...(date(data.providerAcceptedAt) === undefined ? {} : { providerAcceptedAt: date(data.providerAcceptedAt) }),
    ...(typeof data.providerMessageId === 'string' ? { providerMessageId: data.providerMessageId } : {}),
    ...(date(data.completedAt) === undefined ? {} : { completedAt: date(data.completedAt) }),
    ...(failureCategory(data.failureCategory) === undefined ? {} : { failureCategory: failureCategory(data.failureCategory) }),
    ...(typeof data.lastErrorCode === 'string' ? { lastErrorCode: data.lastErrorCode } : {}),
    ...(typeof data.lastErrorSummary === 'string' ? { lastErrorSummary: data.lastErrorSummary } : {}),
    ...(date(data.lastProviderEventAt) === undefined ? {} : { lastProviderEventAt: date(data.lastProviderEventAt) }),
    ...(typeof data.lastProviderEventType === 'string' ? { lastProviderEventType: data.lastProviderEventType as NotificationWebhookEvent['eventType'] } : {}),
  };
}

function newAttempt(notificationId: string, attemptNumber: number, now: Date, idempotencyKey?: string): NotificationDeliveryAttempt {
  const id = deliveryAttemptId(notificationId, attemptNumber);
  return {
    schemaVersion: 1,
    id,
    notificationId,
    attemptNumber,
    status: 'PROCESSING',
    idempotencyKey: idempotencyKey ?? deliveryAttemptIdempotencyKey(notificationId, id),
    technicalRetryCount: 0,
    createdAt: now,
    startedAt: now,
    updatedAt: now,
  };
}

function attemptReference(outboxReference: DocumentReference, attemptId: string): DocumentReference {
  return outboxReference.collection('attempts').doc(attemptId);
}

function notificationIdFromAttemptReference(reference: DocumentReference): string | undefined {
  return reference.parent.parent?.id;
}

export interface NotificationFailureUpdate {
  status: 'RETRY_PENDING' | 'DEFERRED' | 'FAILED' | 'FAILED_CONFIGURATION' | 'SUPPRESSED';
  nextAttemptAt: Date;
  code: string;
  summary: string;
  category: NotificationFailureCategory;
  failedAt?: Date;
  retryMode?: NotificationRetryMode;
  retrySafety?: NotificationRetrySafety;
}

export type NotificationWebhookApplyResult = 'applied' | 'duplicate' | 'unmatched' | 'expired' | 'inconsistent';

export interface NotificationOutboxRepository {
  enqueue(item: NotificationOutboxItem): Promise<NotificationOutboxItem>;
  claimEligible(limit: number, leaseOwner: string, now: Date, leaseMilliseconds: number): Promise<NotificationOutboxItem[]>;
  markSent(id: string, leaseOwner: string, providerMessageId: string | undefined, now: Date, attemptId?: string): Promise<void>;
  markDeliveryUncertain(id: string, leaseOwner: string, providerMessageId: string | undefined, observedAt: Date, attemptId?: string, providerAcceptanceConfirmed?: boolean): Promise<void>;
  markFailure(id: string, leaseOwner: string, update: NotificationFailureUpdate, now: Date, attemptId?: string): Promise<NotificationStatus | undefined>;
  requeue(limit: number, now: Date): Promise<number>;
  applyWebhook(event: NotificationWebhookEvent, now?: Date): Promise<NotificationWebhookApplyResult>;
  reconcilePendingWebhooks(limit: number, now?: Date): Promise<NotificationWebhookReconciliationResult>;
  metrics(now: Date): Promise<NotificationDeliveryMetrics>;
}

export class FirestoreNotificationOutboxRepository implements NotificationOutboxRepository {
  private readonly collection;
  private readonly webhookEvents;
  public constructor(private readonly firestore: Firestore) {
    this.collection = firestore.collection('notificationOutbox');
    this.webhookEvents = firestore.collection('notificationWebhookEvents');
  }

  public async enqueue(item: NotificationOutboxItem): Promise<NotificationOutboxItem> {
    const reference = this.collection.doc(item.id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) return fromSnapshot(snapshot);
      transaction.create(reference, notificationToFirestore(item));
      return structuredClone(item);
    });
  }

  public async claimEligible(limit: number, leaseOwner: string, now: Date, leaseMilliseconds: number): Promise<NotificationOutboxItem[]> {
    const bounded = Math.min(Math.max(limit, 1), 50);
    const nowTimestamp = Timestamp.fromDate(now);
    const [pending, expired] = await Promise.all([
      this.collection.where('status', 'in', ['PENDING', 'RETRY_PENDING', 'DEFERRED']).where('nextAttemptAt', '<=', nowTimestamp).orderBy('nextAttemptAt').limit(bounded).get(),
      this.collection.where('status', '==', 'PROCESSING').where('leaseUntil', '<=', nowTimestamp).orderBy('leaseUntil').limit(bounded).get(),
    ]);
    const candidates = [...new Map([...pending.docs, ...expired.docs].map((snapshot) => [snapshot.id, snapshot])).values()].slice(0, bounded);
    const claimed: NotificationOutboxItem[] = [];
    for (const candidate of candidates) {
      const item = await this.firestore.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(candidate.ref);
        if (!currentSnapshot.exists) return undefined;
        const current = fromSnapshot(currentSnapshot);
        const retryable = ['PENDING', 'RETRY_PENDING', 'DEFERRED'].includes(current.status) && current.nextAttemptAt <= now;
        const recoverableLease = current.status === 'PROCESSING' && current.leaseUntil !== undefined && current.leaseUntil <= now;
        if (!retryable && !recoverableLease) return undefined;

        if (recoverableLease) {
          const safeUntil = current.idempotencySafeUntil ?? new Date((current.lastAttemptAt ?? current.updatedAt).getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
          const attemptNumber = Math.max(current.attemptCount, 1);
          const currentId = current.currentAttemptId ?? deliveryAttemptId(current.id, attemptNumber);
          const reference = attemptReference(candidate.ref, currentId);
          const attemptSnapshot = await transaction.get(reference);
          if (safeUntil <= now) {
            if (attemptSnapshot.exists) {
              const attempt = deliveryAttemptFromSnapshot(attemptSnapshot);
              if (attempt.status === 'PROCESSING') {
                transaction.set(reference, deliveryAttemptToFirestore({
                  ...attempt,
                  status: 'UNCERTAIN',
                  updatedAt: now,
                  completedAt: now,
                  failureCategory: 'UNKNOWN',
                  lastErrorCode: 'expired_lease_outside_idempotency_window',
                  lastErrorSummary: 'A tentativa terminou sem confirmação persistida e a janela segura de idempotência expirou.',
                }));
              }
            }
            transaction.update(candidate.ref, {
              status: 'DELIVERY_UNCERTAIN', updatedAt: Timestamp.fromDate(now), leaseOwner: null, leaseUntil: null,
              currentAttemptId: currentId,
              lastFailureCategory: 'UNKNOWN', lastErrorCode: 'expired_lease_outside_idempotency_window',
              lastErrorSummary: 'A tentativa anterior terminou sem confirmação persistida e a janela segura de idempotência do provedor expirou. Reenvio automático bloqueado.',
            });
            return undefined;
          }

          if (!attemptSnapshot.exists) {
            const legacyAttempt = newAttempt(current.id, attemptNumber, current.lastAttemptAt ?? now, current.idempotencyKey || undefined);
            transaction.create(reference, deliveryAttemptToFirestore({
              ...legacyAttempt,
              id: currentId,
              ...(current.providerMessageId === undefined ? {} : { providerMessageId: current.providerMessageId }),
              ...(current.providerAcceptedAt === undefined ? {} : { providerAcceptedAt: current.providerAcceptedAt }),
            }));
          }
          const updated: NotificationOutboxItem = {
            ...current,
            schemaVersion: 2,
            status: 'PROCESSING',
            currentAttemptId: currentId,
            updatedAt: now,
            leaseOwner,
            leaseUntil: new Date(now.getTime() + leaseMilliseconds),
            idempotencySafeUntil: safeUntil,
          };
          transaction.set(candidate.ref, notificationToFirestore(updated));
          return updated;
        }

        if (current.retryMode === 'SAME_ATTEMPT' && current.currentAttemptId !== undefined) {
          const retryAttemptRef = attemptReference(candidate.ref, current.currentAttemptId);
          const retryAttemptSnapshot = await transaction.get(retryAttemptRef);
          if (!retryAttemptSnapshot.exists) {
            transaction.update(candidate.ref, {
              status: 'DELIVERY_UNCERTAIN', updatedAt: Timestamp.fromDate(now), leaseOwner: null, leaseUntil: null,
              retryMode: null, retrySafety: null, lastFailureCategory: 'UNKNOWN', lastErrorCode: 'technical_retry_attempt_missing',
              lastErrorSummary: 'A tentativa indicada para retry técnico não foi encontrada. Reenvio automático bloqueado.',
            });
            return undefined;
          }
          const retryAttempt = deliveryAttemptFromSnapshot(retryAttemptSnapshot);
          if (retryAttempt.status !== 'RETRY_PENDING') return undefined;
          const retrySafety = current.retrySafety ?? retryAttempt.retrySafety ?? 'IDEMPOTENCY_WINDOW';
          const previousSafeUntil = current.idempotencySafeUntil ?? new Date((current.lastAttemptAt ?? retryAttempt.startedAt).getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
          const safeUntil = retrySafety === 'PROVIDER_REJECTED' && previousSafeUntil <= now
            ? new Date(now.getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS)
            : previousSafeUntil;
          if (retryAttempt.technicalRetryCount > MAX_TECHNICAL_RETRIES || (retrySafety === 'IDEMPOTENCY_WINDOW' && safeUntil <= now)) {
            const code = retryAttempt.technicalRetryCount > MAX_TECHNICAL_RETRIES ? 'technical_retry_limit_reached' : 'technical_retry_outside_idempotency_window';
            const summary = retryAttempt.technicalRetryCount > MAX_TECHNICAL_RETRIES
              ? 'A mesma tentativa excedeu o limite de retries técnicos sem resultado conclusivo.'
              : 'A janela segura de idempotência expirou antes do retry técnico.';
            transaction.set(retryAttemptRef, deliveryAttemptToFirestore({
              ...retryAttempt, status: 'UNCERTAIN', retryMode: undefined, retrySafety: undefined, nextAttemptAt: undefined,
              updatedAt: now, completedAt: now, failureCategory: 'UNKNOWN', lastErrorCode: code, lastErrorSummary: summary,
            }));
            transaction.update(candidate.ref, {
              status: 'DELIVERY_UNCERTAIN', updatedAt: Timestamp.fromDate(now), leaseOwner: null, leaseUntil: null,
              retryMode: null, retrySafety: null, lastFailureCategory: 'UNKNOWN', lastErrorCode: code, lastErrorSummary: summary,
            });
            return undefined;
          }
          const resumedAttempt: NotificationDeliveryAttempt = {
            ...retryAttempt,
            status: 'PROCESSING',
            retryMode: undefined,
            retrySafety: undefined,
            nextAttemptAt: undefined,
            updatedAt: now,
          };
          const updated: NotificationOutboxItem = {
            ...current,
            schemaVersion: 2,
            status: 'PROCESSING',
            idempotencyKey: retryAttempt.idempotencyKey,
            retryMode: undefined,
            retrySafety: undefined,
            updatedAt: now,
            lastAttemptAt: now,
            leaseOwner,
            leaseUntil: new Date(now.getTime() + leaseMilliseconds),
            idempotencySafeUntil: safeUntil,
          };
          transaction.set(retryAttemptRef, deliveryAttemptToFirestore(resumedAttempt));
          transaction.set(candidate.ref, notificationToFirestore(updated));
          return updated;
        }

        const legacyAcceptedAttemptNumber = current.schemaVersion === 1 && current.attemptCount > 0 && current.providerAcceptedAt !== undefined
          ? current.attemptCount
          : undefined;
        const legacyAcceptedAttemptId = legacyAcceptedAttemptNumber === undefined ? undefined : deliveryAttemptId(current.id, legacyAcceptedAttemptNumber);
        const legacyAcceptedAttemptReference = legacyAcceptedAttemptId === undefined ? undefined : attemptReference(candidate.ref, legacyAcceptedAttemptId);
        const legacyAcceptedAttemptSnapshot = legacyAcceptedAttemptReference === undefined ? undefined : await transaction.get(legacyAcceptedAttemptReference);

        const attemptNumber = current.attemptCount + 1;
        const attempt = newAttempt(current.id, attemptNumber, now);
        const reference = attemptReference(candidate.ref, attempt.id);
        const attemptSnapshot = await transaction.get(reference);
        if (attemptSnapshot.exists) return undefined;
        if (legacyAcceptedAttemptReference !== undefined && legacyAcceptedAttemptSnapshot !== undefined && !legacyAcceptedAttemptSnapshot.exists) {
          const historical = newAttempt(current.id, legacyAcceptedAttemptNumber!, current.lastAttemptAt ?? current.providerAcceptedAt!, current.idempotencyKey || undefined);
          transaction.create(legacyAcceptedAttemptReference, deliveryAttemptToFirestore({
            ...historical,
            id: legacyAcceptedAttemptId!,
            status: 'FAILED',
            providerAcceptedAt: current.providerAcceptedAt!,
            ...(current.providerMessageId === undefined ? {} : { providerMessageId: current.providerMessageId }),
            completedAt: current.updatedAt,
            ...(current.lastFailureCategory === undefined ? {} : { failureCategory: current.lastFailureCategory }),
            ...(current.lastErrorCode === undefined ? {} : { lastErrorCode: current.lastErrorCode }),
            ...(current.lastErrorSummary === undefined ? {} : { lastErrorSummary: current.lastErrorSummary }),
          }));
        }
        const updated: NotificationOutboxItem = {
          ...current,
          schemaVersion: 2,
          status: 'PROCESSING',
          attemptCount: attemptNumber,
          currentAttemptId: attempt.id,
          idempotencyKey: attempt.idempotencyKey,
          retryMode: undefined,
          retrySafety: undefined,
          updatedAt: now,
          lastAttemptAt: now,
          leaseOwner,
          leaseUntil: new Date(now.getTime() + leaseMilliseconds),
          idempotencySafeUntil: new Date(now.getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS),
        };
        transaction.create(reference, deliveryAttemptToFirestore(attempt));
        transaction.set(candidate.ref, notificationToFirestore(updated));
        return updated;
      });
      if (item !== undefined) claimed.push(item);
    }
    return claimed;
  }

  public async markSent(id: string, leaseOwner: string, providerMessageId: string | undefined, now: Date, suppliedAttemptId?: string): Promise<void> {
    const reference = this.collection.doc(id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const current = fromSnapshot(snapshot);
      if (current.status !== 'PROCESSING' || current.leaseOwner !== leaseOwner) return;
      const currentAttemptId = suppliedAttemptId ?? current.currentAttemptId;
      if (currentAttemptId === undefined || currentAttemptId !== current.currentAttemptId) return;
      const attemptRef = attemptReference(reference, currentAttemptId);
      const attemptSnapshot = await transaction.get(attemptRef);
      if (!attemptSnapshot.exists) return;
      const attempt = deliveryAttemptFromSnapshot(attemptSnapshot);
      if (providerMessageId !== undefined && attempt.providerMessageId !== undefined && attempt.providerMessageId !== providerMessageId) throw new Error('NOTIFICATION_ATTEMPT_PROVIDER_MESSAGE_CONFLICT');
      transaction.set(attemptRef, deliveryAttemptToFirestore({
        ...attempt,
        status: attempt.status === 'DELIVERED' ? 'DELIVERED' : 'ACCEPTED',
        ...(providerMessageId === undefined ? {} : { providerMessageId }),
        providerAcceptedAt: attempt.providerAcceptedAt ?? now,
        retryMode: undefined,
        retrySafety: undefined,
        nextAttemptAt: undefined,
        updatedAt: now,
        failureCategory: undefined,
        lastErrorCode: undefined,
        lastErrorSummary: undefined,
      }));
      transaction.update(reference, {
        status: 'SENT',
        ...(providerMessageId === undefined ? {} : { providerMessageId }),
        providerAcceptedAt: Timestamp.fromDate(now),
        sentAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        leaseOwner: null, leaseUntil: null, retryMode: null, retrySafety: null, idempotencySafeUntil: null, lastFailureCategory: null, lastErrorCode: null, lastErrorSummary: null,
      });
    });
  }

  public async markDeliveryUncertain(id: string, leaseOwner: string, providerMessageId: string | undefined, observedAt: Date, suppliedAttemptId?: string, providerAcceptanceConfirmed = providerMessageId !== undefined): Promise<void> {
    const reference = this.collection.doc(id);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const current = fromSnapshot(snapshot);
      if (current.status !== 'PROCESSING' || current.leaseOwner !== leaseOwner) return;
      const currentAttemptId = suppliedAttemptId ?? current.currentAttemptId;
      if (currentAttemptId === undefined || currentAttemptId !== current.currentAttemptId) return;
      const attemptRef = attemptReference(reference, currentAttemptId);
      const attemptSnapshot = await transaction.get(attemptRef);
      if (!attemptSnapshot.exists) return;
      const attempt = deliveryAttemptFromSnapshot(attemptSnapshot);
      if (providerMessageId !== undefined && attempt.providerMessageId !== undefined && attempt.providerMessageId !== providerMessageId) throw new Error('NOTIFICATION_ATTEMPT_PROVIDER_MESSAGE_CONFLICT');
      const errorCode = providerAcceptanceConfirmed ? 'provider_accepted_persistence_uncertain' : 'provider_outcome_uncertain';
      const attemptSummary = providerAcceptanceConfirmed
        ? 'O provedor aceitou a tentativa, mas a confirmação agregada local não foi persistida de forma conclusiva.'
        : 'O resultado externo da tentativa ficou indeterminado; o aceite pelo provedor ainda não foi confirmado.';
      const outboxSummary = providerAcceptanceConfirmed
        ? 'O provedor aceitou a solicitação, mas a confirmação local não foi persistida de forma conclusiva. Reenvio automático bloqueado.'
        : 'O resultado externo da tentativa ficou indeterminado. Reenvio automático bloqueado até reconciliação por webhook ou decisão administrativa.';
      transaction.set(attemptRef, deliveryAttemptToFirestore({
        ...attempt,
        status: 'UNCERTAIN',
        retryMode: undefined, retrySafety: undefined, nextAttemptAt: undefined,
        ...(providerMessageId === undefined ? {} : { providerMessageId }),
        ...(providerAcceptanceConfirmed && attempt.providerAcceptedAt === undefined ? { providerAcceptedAt: observedAt } : {}),
        updatedAt: observedAt,
        failureCategory: 'UNKNOWN',
        lastErrorCode: errorCode,
        lastErrorSummary: attemptSummary,
      }));
      transaction.update(reference, {
        status: 'DELIVERY_UNCERTAIN',
        ...(providerMessageId === undefined ? {} : { providerMessageId }),
        ...(providerAcceptanceConfirmed ? { providerAcceptedAt: Timestamp.fromDate(observedAt) } : {}),
        updatedAt: Timestamp.fromDate(observedAt),
        leaseOwner: null, leaseUntil: null, retryMode: null, retrySafety: null, lastFailureCategory: 'UNKNOWN', lastErrorCode: errorCode,
        lastErrorSummary: outboxSummary,
      });
    });
  }

  public async markFailure(id: string, leaseOwner: string, update: NotificationFailureUpdate, now: Date, suppliedAttemptId?: string): Promise<NotificationStatus | undefined> {
    const reference = this.collection.doc(id);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return undefined;
      const current = fromSnapshot(snapshot);
      if (current.status !== 'PROCESSING' || current.leaseOwner !== leaseOwner) return current.status;
      const currentAttemptId = suppliedAttemptId ?? current.currentAttemptId;
      if (currentAttemptId === undefined || currentAttemptId !== current.currentAttemptId) return current.status;
      const attemptRef = attemptReference(reference, currentAttemptId);
      const attemptSnapshot = await transaction.get(attemptRef);
      if (!attemptSnapshot.exists) return current.status;
      const attempt = deliveryAttemptFromSnapshot(attemptSnapshot);
      const retryable = update.status === 'RETRY_PENDING' || update.status === 'DEFERRED';
      const mode: NotificationRetryMode | undefined = retryable ? (update.retryMode ?? 'NEW_ATTEMPT') : undefined;

      if (retryable && mode === 'SAME_ATTEMPT') {
        const nextTechnicalRetryCount = attempt.technicalRetryCount + 1;
        const retrySafety = update.retrySafety ?? 'IDEMPOTENCY_WINDOW';
        const backoffAt = new Date(now.getTime() + technicalRetryDelayMilliseconds(nextTechnicalRetryCount));
        const nextAttemptAt = new Date(Math.max(update.nextAttemptAt.getTime(), backoffAt.getTime()));
        const safeUntil = current.idempotencySafeUntil ?? new Date((current.lastAttemptAt ?? attempt.startedAt).getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
        const unsafeWindow = retrySafety === 'IDEMPOTENCY_WINDOW' && safeUntil <= nextAttemptAt;
        if (nextTechnicalRetryCount > MAX_TECHNICAL_RETRIES || unsafeWindow) {
          const code = nextTechnicalRetryCount > MAX_TECHNICAL_RETRIES ? 'technical_retry_limit_reached' : 'technical_retry_outside_idempotency_window';
          const summary = nextTechnicalRetryCount > MAX_TECHNICAL_RETRIES
            ? 'A mesma tentativa excedeu o limite de retries técnicos sem resultado conclusivo.'
            : 'O próximo retry técnico ocorreria fora da janela segura de idempotência do provedor.';
          transaction.set(attemptRef, deliveryAttemptToFirestore({
            ...attempt,
            status: 'UNCERTAIN',
            technicalRetryCount: Math.min(nextTechnicalRetryCount, MAX_TECHNICAL_RETRIES),
            retryMode: undefined,
            retrySafety: undefined,
            nextAttemptAt: undefined,
            updatedAt: now,
            completedAt: now,
            failureCategory: 'UNKNOWN',
            lastErrorCode: code,
            lastErrorSummary: summary,
          }));
          transaction.update(reference, {
            status: 'DELIVERY_UNCERTAIN', updatedAt: Timestamp.fromDate(now), leaseOwner: null, leaseUntil: null,
            retryMode: null, retrySafety: null, lastFailureCategory: 'UNKNOWN', lastErrorCode: code, lastErrorSummary: summary,
          });
          return 'DELIVERY_UNCERTAIN';
        }
        transaction.set(attemptRef, deliveryAttemptToFirestore({
          ...attempt,
          status: 'RETRY_PENDING',
          technicalRetryCount: nextTechnicalRetryCount,
          retryMode: 'SAME_ATTEMPT',
          retrySafety,
          nextAttemptAt,
          updatedAt: now,
          completedAt: undefined,
          failureCategory: update.category,
          lastErrorCode: update.code,
          lastErrorSummary: update.summary,
        }));
        transaction.update(reference, {
          status: update.status, nextAttemptAt: Timestamp.fromDate(nextAttemptAt), updatedAt: Timestamp.fromDate(now),
          retryMode: 'SAME_ATTEMPT', retrySafety, lastFailureCategory: update.category,
          lastErrorCode: update.code.slice(0, 120), lastErrorSummary: update.summary.slice(0, 500),
          leaseOwner: null, leaseUntil: null,
        });
        return update.status;
      }

      transaction.set(attemptRef, deliveryAttemptToFirestore({
        ...attempt,
        status: update.status === 'SUPPRESSED' ? 'SUPPRESSED' : 'FAILED',
        retryMode: undefined,
        retrySafety: undefined,
        nextAttemptAt: undefined,
        updatedAt: now,
        completedAt: now,
        failureCategory: update.category,
        lastErrorCode: update.code,
        lastErrorSummary: update.summary,
      }));
      transaction.update(reference, {
        status: update.status, nextAttemptAt: Timestamp.fromDate(update.nextAttemptAt), updatedAt: Timestamp.fromDate(now),
        retryMode: retryable ? 'NEW_ATTEMPT' : null, retrySafety: retryable ? (update.retrySafety ?? null) : null,
        lastFailureCategory: update.category, lastErrorCode: update.code.slice(0, 120), lastErrorSummary: update.summary.slice(0, 500),
        ...(update.failedAt === undefined ? {} : { failedAt: Timestamp.fromDate(update.failedAt) }),
        leaseOwner: null, leaseUntil: null, idempotencySafeUntil: null,
      });
      return update.status;
    });
  }

  public async requeue(limit: number, now: Date): Promise<number> {
    const snapshot = await this.collection.where('status', 'in', ['PENDING', 'RETRY_PENDING', 'DEFERRED', 'FAILED', 'FAILED_CONFIGURATION']).limit(Math.min(Math.max(limit, 1), 100)).get();
    let count = 0;
    for (const document of snapshot.docs) {
      const requeued = await this.firestore.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(document.ref);
        if (!currentSnapshot.exists) return false;
        const current = fromSnapshot(currentSnapshot);
        if (!['PENDING', 'RETRY_PENDING', 'DEFERRED', 'FAILED', 'FAILED_CONFIGURATION'].includes(current.status)) return false;
        transaction.update(document.ref, current.retryMode === 'SAME_ATTEMPT'
          ? { status: current.status, nextAttemptAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now), failedAt: null }
          : { status: 'PENDING', nextAttemptAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now), failedAt: null, retryMode: 'NEW_ATTEMPT', retrySafety: null, idempotencySafeUntil: null });
        return true;
      });
      if (requeued) count += 1;
    }
    return count;
  }

  public async applyWebhook(event: NotificationWebhookEvent, now = new Date()): Promise<NotificationWebhookApplyResult> {
    const eventReference = this.webhookEvents.doc(event.eventId);
    const providerAttemptMatches = await this.firestore.collectionGroup('attempts').where('providerMessageId', '==', event.providerMessageId).limit(2).get();
    const legacyProviderMatches = await this.collection.where('providerMessageId', '==', event.providerMessageId).limit(2).get();
    const directOutboxReference = event.notificationId !== undefined && TECHNICAL_ID_PATTERN.test(event.notificationId)
      ? this.collection.doc(event.notificationId)
      : undefined;
    const directAttemptReference = directOutboxReference !== undefined && event.attemptId !== undefined && TECHNICAL_ID_PATTERN.test(event.attemptId)
      ? attemptReference(directOutboxReference, event.attemptId)
      : undefined;

    return this.firestore.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventReference);
      const existingRecord = eventSnapshot.exists ? webhookRecordFromSnapshot(eventSnapshot) : undefined;
      if (existingRecord !== undefined && existingRecord.status !== 'UNMATCHED_PENDING') return 'duplicate';

      const directOutboxSnapshot = directOutboxReference === undefined ? undefined : await transaction.get(directOutboxReference);
      const directOutbox = directOutboxSnapshot?.exists ? fromSnapshot(directOutboxSnapshot) : undefined;
      const directAttemptSnapshot = directAttemptReference === undefined ? undefined : await transaction.get(directAttemptReference);
      const directAttempt = directAttemptSnapshot?.exists ? deliveryAttemptFromSnapshot(directAttemptSnapshot) : undefined;

      const firstProviderAttemptMatch = providerAttemptMatches.docs[0];
      const providerAttemptSnapshot = firstProviderAttemptMatch === undefined
        ? undefined
        : directAttemptReference !== undefined && firstProviderAttemptMatch.ref.path === directAttemptReference.path
          ? directAttemptSnapshot
          : await transaction.get(firstProviderAttemptMatch.ref);
      const providerAttempt = providerAttemptSnapshot?.exists ? deliveryAttemptFromSnapshot(providerAttemptSnapshot) : undefined;
      const providerAttemptNotificationId = firstProviderAttemptMatch === undefined ? undefined : notificationIdFromAttemptReference(firstProviderAttemptMatch.ref);
      const providerOutboxReference = providerAttemptNotificationId === undefined ? undefined : this.collection.doc(providerAttemptNotificationId);
      const providerOutboxSnapshot = providerOutboxReference === undefined
        ? undefined
        : directOutboxReference !== undefined && providerOutboxReference.path === directOutboxReference.path
          ? directOutboxSnapshot
          : await transaction.get(providerOutboxReference);
      const providerOutbox = providerOutboxSnapshot?.exists ? fromSnapshot(providerOutboxSnapshot) : undefined;

      const currentAttemptReference = event.attemptId === undefined && directOutbox?.currentAttemptId !== undefined
        ? attemptReference(directOutboxReference!, directOutbox.currentAttemptId)
        : undefined;
      const currentAttemptSnapshot = currentAttemptReference === undefined
        ? undefined
        : directAttemptReference !== undefined && currentAttemptReference.path === directAttemptReference.path
          ? directAttemptSnapshot
          : providerAttemptSnapshot !== undefined && firstProviderAttemptMatch?.ref.path === currentAttemptReference.path
            ? providerAttemptSnapshot
            : await transaction.get(currentAttemptReference);
      const currentAttempt = currentAttemptSnapshot?.exists ? deliveryAttemptFromSnapshot(currentAttemptSnapshot) : undefined;

      const firstLegacyMatch = legacyProviderMatches.docs[0];
      const legacySnapshot = firstLegacyMatch === undefined
        ? undefined
        : directOutboxReference !== undefined && firstLegacyMatch.ref.path === directOutboxReference.path
          ? directOutboxSnapshot
          : providerOutboxReference !== undefined && firstLegacyMatch.ref.path === providerOutboxReference.path
            ? providerOutboxSnapshot
            : await transaction.get(firstLegacyMatch.ref);
      const legacyOutbox = legacySnapshot?.exists ? fromSnapshot(legacySnapshot) : undefined;

      const firstSeenAt = existingRecord?.firstSeenAt ?? now;
      const webhookAttemptCount = (existingRecord?.attemptCount ?? 0) + 1;
      const common = {
        schemaVersion: 3 as const,
        eventId: event.eventId,
        eventType: event.eventType,
        providerMessageId: event.providerMessageId,
        ...(event.notificationId === undefined ? {} : { notificationId: event.notificationId }),
        ...(event.attemptId === undefined ? {} : { attemptId: event.attemptId }),
        occurredAt: event.occurredAt,
        ...(sanitizeFailureReason(event.failureReason) === undefined ? {} : { failureReason: sanitizeFailureReason(event.failureReason) }),
        firstSeenAt,
        lastAttemptAt: now,
        attemptCount: webhookAttemptCount,
        retentionUntil: new Date(firstSeenAt.getTime() + WEBHOOK_RETENTION_MS),
      };

      let targetOutbox: NotificationOutboxItem | undefined;
      let targetOutboxReference: DocumentReference | undefined;
      let targetAttempt: NotificationDeliveryAttempt | undefined;
      let targetAttemptReference: DocumentReference | undefined;
      let conflict = providerAttemptMatches.size > 1 || legacyProviderMatches.size > 1;

      if (directAttempt !== undefined && directOutbox !== undefined) {
        const directProviderConflict = directAttempt.providerMessageId !== undefined && directAttempt.providerMessageId !== event.providerMessageId;
        const providerPointsElsewhere = providerAttempt !== undefined && firstProviderAttemptMatch?.ref.path !== directAttemptReference?.path;
        conflict = conflict || directProviderConflict || providerPointsElsewhere;
        if (!conflict) {
          targetOutbox = directOutbox;
          targetOutboxReference = directOutboxReference;
          targetAttempt = directAttempt;
          targetAttemptReference = directAttemptReference;
        }
      } else if (providerAttempt !== undefined && providerOutbox !== undefined && firstProviderAttemptMatch !== undefined) {
        const directNotificationConflict = directOutbox !== undefined && directOutbox.id !== providerOutbox.id;
        conflict = conflict || directNotificationConflict;
        if (!conflict) {
          targetOutbox = providerOutbox;
          targetOutboxReference = providerOutboxReference;
          targetAttempt = providerAttempt;
          targetAttemptReference = firstProviderAttemptMatch.ref;
        }
      } else if (event.attemptId === undefined && currentAttempt !== undefined && directOutbox !== undefined && currentAttemptReference !== undefined) {
        const currentProviderCompatible = currentAttempt.providerMessageId === undefined || currentAttempt.providerMessageId === event.providerMessageId;
        if (currentProviderCompatible) {
          targetOutbox = directOutbox;
          targetOutboxReference = directOutboxReference;
          targetAttempt = currentAttempt;
          targetAttemptReference = currentAttemptReference;
        }
      }

      if (targetOutbox === undefined && targetAttempt === undefined) {
        const legacyDirectConflict = directOutbox !== undefined
          && legacyOutbox !== undefined
          && directOutbox.id !== legacyOutbox.id;
        conflict = conflict || legacyDirectConflict;

        const directLegacyCompatible = !conflict
          && directOutbox !== undefined
          && directOutbox.currentAttemptId === undefined
          && (directOutbox.providerMessageId === undefined || directOutbox.providerMessageId === event.providerMessageId);
        if (directLegacyCompatible) {
          targetOutbox = directOutbox;
          targetOutboxReference = directOutboxReference;
        } else if (legacyOutbox !== undefined && firstLegacyMatch !== undefined) {
          const directNotificationConflict = directOutbox !== undefined && directOutbox.id !== legacyOutbox.id;
          conflict = conflict || directNotificationConflict;
          if (!conflict) {
            targetOutbox = legacyOutbox;
            targetOutboxReference = firstLegacyMatch.ref;
          }
        } else if (directOutbox !== undefined && directOutbox.currentAttemptId === undefined && directOutbox.providerMessageId !== undefined && directOutbox.providerMessageId !== event.providerMessageId) {
          conflict = true;
        }
      }

      if (conflict) {
        const inconsistent: NotificationWebhookRecord = {
          ...common,
          status: 'INCONSISTENT',
          processedAt: now,
          lastErrorCode: 'WEBHOOK_CORRELATION_CONFLICT',
          ...(directOutbox === undefined ? {} : { targetNotificationId: directOutbox.id }),
          ...(directAttempt === undefined ? {} : { targetAttemptId: directAttempt.id }),
        };
        transaction.set(eventReference, webhookToFirestore(inconsistent));
        return 'inconsistent';
      }

      if (targetOutbox !== undefined && targetOutbox.provider !== 'resend') {
        const inconsistent: NotificationWebhookRecord = {
          ...common,
          status: 'INCONSISTENT',
          processedAt: now,
          lastErrorCode: 'WEBHOOK_PROVIDER_MISMATCH',
          targetNotificationId: targetOutbox.id,
          ...(targetAttempt === undefined ? {} : { targetAttemptId: targetAttempt.id }),
        };
        transaction.set(eventReference, webhookToFirestore(inconsistent));
        return 'inconsistent';
      }

      if (targetOutbox !== undefined && targetOutboxReference !== undefined) {
        if (targetAttempt !== undefined && targetAttemptReference !== undefined) {
          const updatedAttempt = applyDeliveryAttemptWebhookState(targetAttempt, event);
          if (updatedAttempt !== targetAttempt) transaction.set(targetAttemptReference, deliveryAttemptToFirestore(updatedAttempt));

          // A outbox agrega somente a tentativa corrente. Eventos tardios de tentativas anteriores atualizam o histórico sem regredir o estado global.
          if (targetOutbox.currentAttemptId === undefined || targetOutbox.currentAttemptId === targetAttempt.id) {
            const updatedOutbox = applyNotificationWebhookState(targetOutbox, event);
            if (updatedOutbox !== targetOutbox) transaction.set(targetOutboxReference, notificationToFirestore({ ...updatedOutbox, schemaVersion: 2, currentAttemptId: targetAttempt.id }));
          }
        } else {
          const updatedOutbox = applyNotificationWebhookState(targetOutbox, event);
          if (updatedOutbox !== targetOutbox) transaction.set(targetOutboxReference, notificationToFirestore(updatedOutbox));
        }
        const processed: NotificationWebhookRecord = {
          ...common,
          status: 'PROCESSED',
          processedAt: now,
          targetNotificationId: targetOutbox.id,
          ...(targetAttempt === undefined ? {} : { targetAttemptId: targetAttempt.id }),
        };
        transaction.set(eventReference, webhookToFirestore(processed));
        return 'applied';
      }

      const expired = now.getTime() - firstSeenAt.getTime() >= WEBHOOK_UNMATCHED_WINDOW_MS || webhookAttemptCount >= WEBHOOK_MAX_ATTEMPTS;
      const unmatched: NotificationWebhookRecord = {
        ...common,
        status: expired ? 'UNMATCHED_EXPIRED' : 'UNMATCHED_PENDING',
        ...(expired ? { processedAt: now, lastErrorCode: 'WEBHOOK_CORRELATION_EXPIRED' } : { nextAttemptAt: new Date(now.getTime() + webhookBackoffMilliseconds(webhookAttemptCount)) }),
      };
      transaction.set(eventReference, webhookToFirestore(unmatched));
      return expired ? 'expired' : 'unmatched';
    });
  }

  public async reconcilePendingWebhooks(limit: number, now = new Date()): Promise<NotificationWebhookReconciliationResult> {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const due = await this.webhookEvents
      .where('status', '==', 'UNMATCHED_PENDING')
      .where('nextAttemptAt', '<=', Timestamp.fromDate(now))
      .orderBy('nextAttemptAt')
      .limit(bounded)
      .get();
    let processed = 0; let pending = 0; let expired = 0; let inconsistent = 0;
    for (const snapshot of due.docs) {
      const record = webhookRecordFromSnapshot(snapshot);
      const result = await this.applyWebhook({
        eventId: record.eventId,
        eventType: record.eventType,
        providerMessageId: record.providerMessageId,
        ...(record.notificationId === undefined ? {} : { notificationId: record.notificationId }),
        ...(record.attemptId === undefined ? {} : { attemptId: record.attemptId }),
        occurredAt: record.occurredAt,
        ...(record.failureReason === undefined ? {} : { failureReason: record.failureReason }),
      }, now);
      if (result === 'applied' || result === 'duplicate') processed += 1;
      else if (result === 'unmatched') pending += 1;
      else if (result === 'expired') expired += 1;
      else inconsistent += 1;
    }

    const retention = await this.webhookEvents
      .where('status', 'in', ['PROCESSED', 'UNMATCHED_EXPIRED', 'INCONSISTENT'])
      .where('retentionUntil', '<=', Timestamp.fromDate(now))
      .orderBy('retentionUntil')
      .limit(50)
      .get();
    const deletable = retention.docs;
    if (deletable.length > 0) {
      const batch = this.firestore.batch();
      for (const snapshot of deletable) batch.delete(snapshot.ref);
      await batch.commit();
    }
    return { examined: due.size, processed, pending, expired, inconsistent, deletedExpiredRetention: deletable.length };
  }

  public async metrics(now: Date): Promise<NotificationDeliveryMetrics> {
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const counts = async (statuses: NotificationStatus[]): Promise<number> => (await this.collection.where('status', 'in', statuses).count().get()).data().count;
    const attempts = this.firestore.collectionGroup('attempts');
    const [
      sentToday, sentThisMonth, acceptedToday, acceptedThisMonth, acceptedTotal, legacyAcceptedToday, legacyAcceptedThisMonth, legacyAcceptedTotal, attemptsStarted, attemptsDelivered,
      attemptsFailed, attemptsBounced, attemptsComplained, attemptsUncertain, retries,
      pending, retryPending, deliveryUncertain, failed, failedConfiguration, delivered, bounced, complained,
      unmatchedWebhookPending, oldest, oldestUnmatched, latestAttempt, latestAccepted, latestLegacyAccepted, latestError,
    ] = await Promise.all([
      this.collection.where('sentAt', '>=', Timestamp.fromDate(dayStart)).count().get(),
      this.collection.where('sentAt', '>=', Timestamp.fromDate(monthStart)).count().get(),
      attempts.where('providerAcceptedAt', '>=', Timestamp.fromDate(dayStart)).count().get(),
      attempts.where('providerAcceptedAt', '>=', Timestamp.fromDate(monthStart)).count().get(),
      attempts.where('providerAcceptedAt', '>', Timestamp.fromDate(new Date(0))).count().get(),
      this.collection.where('schemaVersion', '==', 1).where('providerAcceptedAt', '>=', Timestamp.fromDate(dayStart)).count().get(),
      this.collection.where('schemaVersion', '==', 1).where('providerAcceptedAt', '>=', Timestamp.fromDate(monthStart)).count().get(),
      this.collection.where('schemaVersion', '==', 1).where('providerAcceptedAt', '>', Timestamp.fromDate(new Date(0))).count().get(),
      attempts.where('createdAt', '>', Timestamp.fromDate(new Date(0))).count().get(),
      attempts.where('status', '==', 'DELIVERED').count().get(),
      attempts.where('status', 'in', ['FAILED', 'SUPPRESSED']).count().get(),
      attempts.where('status', '==', 'BOUNCED').count().get(),
      attempts.where('status', '==', 'COMPLAINED').count().get(),
      attempts.where('status', '==', 'UNCERTAIN').count().get(),
      attempts.where('attemptNumber', '>', 1).count().get(),
      counts(['PENDING','PROCESSING','DEFERRED']), counts(['RETRY_PENDING']), counts(['DELIVERY_UNCERTAIN']), counts(['FAILED','SUPPRESSED']), counts(['FAILED_CONFIGURATION']),
      counts(['DELIVERED']), counts(['BOUNCED']), counts(['COMPLAINED']),
      this.webhookEvents.where('status', '==', 'UNMATCHED_PENDING').count().get(),
      this.collection.where('status', 'in', ['PENDING','PROCESSING','RETRY_PENDING','DEFERRED','DELIVERY_UNCERTAIN']).orderBy('createdAt', 'asc').limit(1).get(),
      this.webhookEvents.where('status', '==', 'UNMATCHED_PENDING').orderBy('firstSeenAt', 'asc').limit(1).get(),
      this.collection.orderBy('lastAttemptAt', 'desc').limit(1).get(),
      attempts.orderBy('providerAcceptedAt', 'desc').limit(1).get(),
      this.collection.where('schemaVersion', '==', 1).orderBy('providerAcceptedAt', 'desc').limit(1).get(),
      this.collection.where('status', 'in', ['FAILED','FAILED_CONFIGURATION','SUPPRESSED','BOUNCED','COMPLAINED','DELIVERY_UNCERTAIN']).orderBy('updatedAt', 'desc').limit(1).get(),
    ]);
    const errorItem = latestError.docs[0] === undefined ? undefined : fromSnapshot(latestError.docs[0]);
    const latestAcceptedAttempt = latestAccepted.docs[0] === undefined ? undefined : deliveryAttemptFromSnapshot(latestAccepted.docs[0]);
    const latestLegacyAcceptedItem = latestLegacyAccepted.docs[0] === undefined ? undefined : fromSnapshot(latestLegacyAccepted.docs[0]);
    const latestAcceptedAt = [latestAcceptedAttempt?.providerAcceptedAt, latestLegacyAcceptedItem?.providerAcceptedAt]
      .filter((value): value is Date => value !== undefined)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      sentToday: sentToday.data().count,
      sentThisMonth: sentThisMonth.data().count,
      acceptedToday: acceptedToday.data().count + legacyAcceptedToday.data().count,
      acceptedThisMonth: acceptedThisMonth.data().count + legacyAcceptedThisMonth.data().count,
      acceptedTotal: acceptedTotal.data().count + legacyAcceptedTotal.data().count,
      attemptsStarted: attemptsStarted.data().count,
      attemptsAccepted: acceptedTotal.data().count + legacyAcceptedTotal.data().count,
      attemptsDelivered: attemptsDelivered.data().count,
      attemptsFailed: attemptsFailed.data().count,
      attemptsBounced: attemptsBounced.data().count,
      attemptsComplained: attemptsComplained.data().count,
      attemptsUncertain: attemptsUncertain.data().count,
      retries: retries.data().count,
      pending, retryPending, deliveryUncertain, failed, failedConfiguration, delivered, bounced, complained,
      unmatchedWebhookPending: unmatchedWebhookPending.data().count,
      ...(oldest.docs[0] === undefined ? {} : { oldestPendingAt: fromSnapshot(oldest.docs[0]).createdAt }),
      ...(oldestUnmatched.docs[0] === undefined ? {} : { oldestUnmatchedWebhookAt: webhookRecordFromSnapshot(oldestUnmatched.docs[0]).firstSeenAt }),
      ...(latestAttempt.docs[0] === undefined ? {} : { lastAttemptAt: fromSnapshot(latestAttempt.docs[0]).lastAttemptAt }),
      ...(latestAcceptedAt === undefined ? {} : { lastSuccessfulSendAt: latestAcceptedAt }),
      ...(errorItem?.lastErrorSummary === undefined ? {} : { lastError: errorItem.lastErrorSummary }),
      ...(errorItem?.lastFailureCategory === undefined ? {} : { lastFailureCategory: errorItem.lastFailureCategory }),
    };
  }
}

export class InMemoryNotificationOutboxRepository implements NotificationOutboxRepository {
  private readonly items = new Map<string, NotificationOutboxItem>();
  private readonly deliveryAttempts = new Map<string, NotificationDeliveryAttempt>();
  private readonly webhookEvents = new Map<string, NotificationWebhookRecord>();

  private attemptKey(notificationId: string, attemptId: string): string { return `${notificationId}/${attemptId}`; }
  private getAttempt(notificationId: string, attemptId: string): NotificationDeliveryAttempt | undefined { return this.deliveryAttempts.get(this.attemptKey(notificationId, attemptId)); }
  private setAttempt(attempt: NotificationDeliveryAttempt): void { this.deliveryAttempts.set(this.attemptKey(attempt.notificationId, attempt.id), structuredClone(attempt)); }

  public enqueue(item: NotificationOutboxItem): Promise<NotificationOutboxItem> {
    const current = this.items.get(item.id);
    if (current !== undefined) return Promise.resolve(structuredClone(current));
    this.items.set(item.id, structuredClone(item));
    return Promise.resolve(structuredClone(item));
  }

  public claimEligible(limit: number, owner: string, now: Date, leaseMs: number): Promise<NotificationOutboxItem[]> {
    const selected: NotificationOutboxItem[] = [];
    for (const x of [...this.items.values()]) {
      if (selected.length >= limit) break;
      const retryable = ['PENDING','RETRY_PENDING','DEFERRED'].includes(x.status) && x.nextAttemptAt <= now;
      const recoverable = x.status === 'PROCESSING' && x.leaseUntil !== undefined && x.leaseUntil <= now;
      if (!retryable && !recoverable) continue;
      if (recoverable) {
        const safe = x.idempotencySafeUntil ?? new Date((x.lastAttemptAt ?? x.updatedAt).getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
        const attemptNumber = Math.max(x.attemptCount, 1);
        const currentId = x.currentAttemptId ?? deliveryAttemptId(x.id, attemptNumber);
        let attempt = this.getAttempt(x.id, currentId);
        if (attempt === undefined) {
          attempt = { ...newAttempt(x.id, attemptNumber, x.lastAttemptAt ?? now, x.idempotencyKey || undefined), id: currentId, ...(x.providerMessageId === undefined ? {} : { providerMessageId: x.providerMessageId }), ...(x.providerAcceptedAt === undefined ? {} : { providerAcceptedAt: x.providerAcceptedAt }) };
          this.setAttempt(attempt);
        }
        if (safe <= now) {
          if (attempt.status === 'PROCESSING') this.setAttempt({ ...attempt, status:'UNCERTAIN', updatedAt:now, completedAt:now, failureCategory:'UNKNOWN', lastErrorCode:'expired_lease_outside_idempotency_window', lastErrorSummary:'A tentativa terminou sem confirmação persistida e a janela segura de idempotência expirou.' });
          this.items.set(x.id, { ...x, schemaVersion:2, status:'DELIVERY_UNCERTAIN', currentAttemptId:currentId, updatedAt:now, leaseOwner:undefined, leaseUntil:undefined, lastFailureCategory:'UNKNOWN', lastErrorCode:'expired_lease_outside_idempotency_window', lastErrorSummary:'A tentativa anterior terminou sem confirmação persistida e a janela segura de idempotência do provedor expirou. Reenvio automático bloqueado.' });
          continue;
        }
        const updated: NotificationOutboxItem = { ...x, schemaVersion:2, status:'PROCESSING', currentAttemptId:currentId, updatedAt:now, leaseOwner:owner, leaseUntil:new Date(now.getTime()+leaseMs), idempotencySafeUntil:safe };
        this.items.set(x.id, structuredClone(updated));
        selected.push(updated);
        continue;
      }
      if (x.retryMode === 'SAME_ATTEMPT' && x.currentAttemptId !== undefined) {
        const retryAttempt = this.getAttempt(x.id, x.currentAttemptId);
        if (retryAttempt === undefined) {
          this.items.set(x.id, { ...x, status:'DELIVERY_UNCERTAIN', updatedAt:now, leaseOwner:undefined, leaseUntil:undefined, retryMode:undefined, retrySafety:undefined, lastFailureCategory:'UNKNOWN', lastErrorCode:'technical_retry_attempt_missing', lastErrorSummary:'A tentativa indicada para retry técnico não foi encontrada. Reenvio automático bloqueado.' });
          continue;
        }
        if (retryAttempt.status !== 'RETRY_PENDING') continue;
        const retrySafety = x.retrySafety ?? retryAttempt.retrySafety ?? 'IDEMPOTENCY_WINDOW';
        const previousSafe = x.idempotencySafeUntil ?? new Date((x.lastAttemptAt ?? retryAttempt.startedAt).getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
        const safe = retrySafety === 'PROVIDER_REJECTED' && previousSafe <= now ? new Date(now.getTime()+PROVIDER_IDEMPOTENCY_WINDOW_MS) : previousSafe;
        if (retryAttempt.technicalRetryCount > MAX_TECHNICAL_RETRIES || (retrySafety === 'IDEMPOTENCY_WINDOW' && safe <= now)) {
          const code = retryAttempt.technicalRetryCount > MAX_TECHNICAL_RETRIES ? 'technical_retry_limit_reached' : 'technical_retry_outside_idempotency_window';
          const summary = retryAttempt.technicalRetryCount > MAX_TECHNICAL_RETRIES ? 'A mesma tentativa excedeu o limite de retries técnicos sem resultado conclusivo.' : 'A janela segura de idempotência expirou antes do retry técnico.';
          this.setAttempt({ ...retryAttempt, status:'UNCERTAIN', retryMode:undefined, retrySafety:undefined, nextAttemptAt:undefined, updatedAt:now, completedAt:now, failureCategory:'UNKNOWN', lastErrorCode:code, lastErrorSummary:summary });
          this.items.set(x.id, { ...x, status:'DELIVERY_UNCERTAIN', updatedAt:now, leaseOwner:undefined, leaseUntil:undefined, retryMode:undefined, retrySafety:undefined, lastFailureCategory:'UNKNOWN', lastErrorCode:code, lastErrorSummary:summary });
          continue;
        }
        this.setAttempt({ ...retryAttempt, status:'PROCESSING', retryMode:undefined, retrySafety:undefined, nextAttemptAt:undefined, updatedAt:now });
        const updated: NotificationOutboxItem = { ...x, schemaVersion:2, status:'PROCESSING', idempotencyKey:retryAttempt.idempotencyKey, retryMode:undefined, retrySafety:undefined, lastAttemptAt:now, updatedAt:now, leaseOwner:owner, leaseUntil:new Date(now.getTime()+leaseMs), idempotencySafeUntil:safe };
        this.items.set(x.id, structuredClone(updated));
        selected.push(updated);
        continue;
      }
      if (x.schemaVersion === 1 && x.attemptCount > 0 && x.providerAcceptedAt !== undefined) {
        const legacyId = deliveryAttemptId(x.id, x.attemptCount);
        if (this.getAttempt(x.id, legacyId) === undefined) {
          const historical = newAttempt(x.id, x.attemptCount, x.lastAttemptAt ?? x.providerAcceptedAt, x.idempotencyKey || undefined);
          this.setAttempt({ ...historical, id:legacyId, status:'FAILED', providerAcceptedAt:x.providerAcceptedAt, ...(x.providerMessageId===undefined?{}:{providerMessageId:x.providerMessageId}), completedAt:x.updatedAt, ...(x.lastFailureCategory===undefined?{}:{failureCategory:x.lastFailureCategory}), ...(x.lastErrorCode===undefined?{}:{lastErrorCode:x.lastErrorCode}), ...(x.lastErrorSummary===undefined?{}:{lastErrorSummary:x.lastErrorSummary}) });
        }
      }
      const attemptNumber = x.attemptCount + 1;
      const attempt = newAttempt(x.id, attemptNumber, now);
      if (this.getAttempt(x.id, attempt.id) !== undefined) continue;
      this.setAttempt(attempt);
      const updated: NotificationOutboxItem = { ...x, schemaVersion:2, status:'PROCESSING', attemptCount:attemptNumber, currentAttemptId:attempt.id, idempotencyKey:attempt.idempotencyKey, retryMode:undefined, retrySafety:undefined, lastAttemptAt:now, updatedAt:now, leaseOwner:owner, leaseUntil:new Date(now.getTime()+leaseMs), idempotencySafeUntil:new Date(now.getTime()+PROVIDER_IDEMPOTENCY_WINDOW_MS) };
      this.items.set(x.id, structuredClone(updated));
      selected.push(updated);
    }
    return Promise.resolve(structuredClone(selected));
  }

  public markSent(id: string, owner: string, messageId: string | undefined, now: Date, suppliedAttemptId?: string): Promise<void> {
    const x = this.items.get(id);
    if (x?.status !== 'PROCESSING' || x.leaseOwner !== owner) return Promise.resolve();
    const attemptId = suppliedAttemptId ?? x.currentAttemptId;
    if (attemptId === undefined || attemptId !== x.currentAttemptId) return Promise.resolve();
    const attempt = this.getAttempt(id, attemptId);
    if (attempt === undefined) return Promise.resolve();
    if (messageId !== undefined && attempt.providerMessageId !== undefined && attempt.providerMessageId !== messageId) return Promise.reject(new Error('NOTIFICATION_ATTEMPT_PROVIDER_MESSAGE_CONFLICT'));
    this.setAttempt({ ...attempt, status:attempt.status==='DELIVERED'?'DELIVERED':'ACCEPTED', ...(messageId===undefined?{}:{providerMessageId:messageId}), providerAcceptedAt:attempt.providerAcceptedAt??now, retryMode:undefined, retrySafety:undefined, nextAttemptAt:undefined, updatedAt:now, failureCategory:undefined, lastErrorCode:undefined, lastErrorSummary:undefined });
    this.items.set(id, { ...x, status:'SENT', ...(messageId===undefined?{}:{providerMessageId:messageId}), providerAcceptedAt:now, sentAt:now, updatedAt:now, leaseOwner:undefined, leaseUntil:undefined, retryMode:undefined, retrySafety:undefined, idempotencySafeUntil:undefined, lastFailureCategory:undefined, lastErrorCode:undefined, lastErrorSummary:undefined });
    return Promise.resolve();
  }

  public markDeliveryUncertain(id: string, owner: string, messageId: string | undefined, observedAt: Date, suppliedAttemptId?: string, providerAcceptanceConfirmed = messageId !== undefined): Promise<void> {
    const x = this.items.get(id);
    if (x?.status !== 'PROCESSING' || x.leaseOwner !== owner) return Promise.resolve();
    const attemptId = suppliedAttemptId ?? x.currentAttemptId;
    if (attemptId === undefined || attemptId !== x.currentAttemptId) return Promise.resolve();
    const attempt = this.getAttempt(id, attemptId);
    if (attempt === undefined) return Promise.resolve();
    if (messageId !== undefined && attempt.providerMessageId !== undefined && attempt.providerMessageId !== messageId) return Promise.reject(new Error('NOTIFICATION_ATTEMPT_PROVIDER_MESSAGE_CONFLICT'));
    const errorCode = providerAcceptanceConfirmed ? 'provider_accepted_persistence_uncertain' : 'provider_outcome_uncertain';
    const attemptSummary = providerAcceptanceConfirmed ? 'O provedor aceitou a tentativa, mas a confirmação agregada local não foi persistida de forma conclusiva.' : 'O resultado externo da tentativa ficou indeterminado; o aceite pelo provedor ainda não foi confirmado.';
    const outboxSummary = providerAcceptanceConfirmed ? 'O provedor aceitou a solicitação, mas a confirmação local não foi persistida de forma conclusiva. Reenvio automático bloqueado.' : 'O resultado externo da tentativa ficou indeterminado. Reenvio automático bloqueado até reconciliação por webhook ou decisão administrativa.';
    this.setAttempt({ ...attempt, status:'UNCERTAIN', retryMode:undefined, retrySafety:undefined, nextAttemptAt:undefined, ...(messageId===undefined?{}:{providerMessageId:messageId}), ...(providerAcceptanceConfirmed&&attempt.providerAcceptedAt===undefined?{providerAcceptedAt:observedAt}:{}), updatedAt:observedAt, failureCategory:'UNKNOWN', lastErrorCode:errorCode, lastErrorSummary:attemptSummary });
    this.items.set(id, { ...x, status:'DELIVERY_UNCERTAIN', ...(messageId===undefined?{}:{providerMessageId:messageId}), ...(providerAcceptanceConfirmed?{providerAcceptedAt:observedAt}:{}), updatedAt:observedAt, leaseOwner:undefined, leaseUntil:undefined, retryMode:undefined, retrySafety:undefined, lastFailureCategory:'UNKNOWN', lastErrorCode:errorCode, lastErrorSummary:outboxSummary });
    return Promise.resolve();
  }

  public markFailure(id: string, owner: string, update: NotificationFailureUpdate, now: Date, suppliedAttemptId?: string): Promise<NotificationStatus | undefined> {
    const x = this.items.get(id);
    if (x?.status !== 'PROCESSING' || x.leaseOwner !== owner) return Promise.resolve(x?.status);
    const attemptId = suppliedAttemptId ?? x.currentAttemptId;
    if (attemptId === undefined || attemptId !== x.currentAttemptId) return Promise.resolve(x.status);
    const attempt = this.getAttempt(id, attemptId);
    if (attempt === undefined) return Promise.resolve(x.status);
    const retryable = update.status === 'RETRY_PENDING' || update.status === 'DEFERRED';
    const mode: NotificationRetryMode | undefined = retryable ? (update.retryMode ?? 'NEW_ATTEMPT') : undefined;
    if (retryable && mode === 'SAME_ATTEMPT') {
      const nextTechnicalRetryCount = attempt.technicalRetryCount + 1;
      const retrySafety = update.retrySafety ?? 'IDEMPOTENCY_WINDOW';
      const backoffAt = new Date(now.getTime() + technicalRetryDelayMilliseconds(nextTechnicalRetryCount));
      const nextAttemptAt = new Date(Math.max(update.nextAttemptAt.getTime(), backoffAt.getTime()));
      const safe = x.idempotencySafeUntil ?? new Date((x.lastAttemptAt ?? attempt.startedAt).getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
      const unsafeWindow = retrySafety === 'IDEMPOTENCY_WINDOW' && safe <= nextAttemptAt;
      if (nextTechnicalRetryCount > MAX_TECHNICAL_RETRIES || unsafeWindow) {
        const code = nextTechnicalRetryCount > MAX_TECHNICAL_RETRIES ? 'technical_retry_limit_reached' : 'technical_retry_outside_idempotency_window';
        const summary = nextTechnicalRetryCount > MAX_TECHNICAL_RETRIES ? 'A mesma tentativa excedeu o limite de retries técnicos sem resultado conclusivo.' : 'O próximo retry técnico ocorreria fora da janela segura de idempotência do provedor.';
        this.setAttempt({ ...attempt, status:'UNCERTAIN', technicalRetryCount:Math.min(nextTechnicalRetryCount,MAX_TECHNICAL_RETRIES), retryMode:undefined, retrySafety:undefined, nextAttemptAt:undefined, updatedAt:now, completedAt:now, failureCategory:'UNKNOWN', lastErrorCode:code, lastErrorSummary:summary });
        this.items.set(id, { ...x, status:'DELIVERY_UNCERTAIN', updatedAt:now, leaseOwner:undefined, leaseUntil:undefined, retryMode:undefined, retrySafety:undefined, lastFailureCategory:'UNKNOWN', lastErrorCode:code, lastErrorSummary:summary });
        return Promise.resolve('DELIVERY_UNCERTAIN');
      }
      this.setAttempt({ ...attempt, status:'RETRY_PENDING', technicalRetryCount:nextTechnicalRetryCount, retryMode:'SAME_ATTEMPT', retrySafety, nextAttemptAt, updatedAt:now, completedAt:undefined, failureCategory:update.category, lastErrorCode:update.code, lastErrorSummary:update.summary });
      this.items.set(id, { ...x, status:update.status, nextAttemptAt, retryMode:'SAME_ATTEMPT', retrySafety, lastFailureCategory:update.category, lastErrorCode:update.code, lastErrorSummary:update.summary, updatedAt:now, leaseOwner:undefined, leaseUntil:undefined });
      return Promise.resolve(update.status);
    }
    this.setAttempt({ ...attempt, status:update.status==='SUPPRESSED'?'SUPPRESSED':'FAILED', retryMode:undefined, retrySafety:undefined, nextAttemptAt:undefined, updatedAt:now, completedAt:now, failureCategory:update.category, lastErrorCode:update.code, lastErrorSummary:update.summary });
    this.items.set(id, { ...x, status:update.status, nextAttemptAt:update.nextAttemptAt, retryMode:retryable?'NEW_ATTEMPT':undefined, retrySafety:retryable?update.retrySafety:undefined, lastFailureCategory:update.category, lastErrorCode:update.code, lastErrorSummary:update.summary, ...(update.failedAt?{failedAt:update.failedAt}:{}), updatedAt:now, leaseOwner:undefined, leaseUntil:undefined, idempotencySafeUntil:undefined });
    return Promise.resolve(update.status);
  }

  public requeue(limit: number, now: Date): Promise<number> {
    const items = [...this.items.values()].filter((x) => ['PENDING','RETRY_PENDING','DEFERRED','FAILED','FAILED_CONFIGURATION'].includes(x.status)).slice(0, limit);
    for (const x of items) this.items.set(x.id, x.retryMode === 'SAME_ATTEMPT'
      ? { ...x, nextAttemptAt:now, updatedAt:now, failedAt:undefined }
      : { ...x, status:'PENDING', nextAttemptAt:now, retryMode:'NEW_ATTEMPT', retrySafety:undefined, updatedAt:now, failedAt:undefined, idempotencySafeUntil:undefined });
    return Promise.resolve(items.length);
  }

  public applyWebhook(event: NotificationWebhookEvent, now = new Date()): Promise<NotificationWebhookApplyResult> {
    const existing = this.webhookEvents.get(event.eventId);
    if (existing !== undefined && existing.status !== 'UNMATCHED_PENDING') return Promise.resolve('duplicate');
    const directOutbox = event.notificationId === undefined ? undefined : this.items.get(event.notificationId);
    const directAttempt = directOutbox !== undefined && event.attemptId !== undefined ? this.getAttempt(directOutbox.id, event.attemptId) : undefined;
    const providerAttempts = [...this.deliveryAttempts.values()].filter((attempt) => attempt.providerMessageId === event.providerMessageId && (this.items.get(attempt.notificationId)?.provider === 'resend'));
    const providerAttempt = providerAttempts[0];
    const providerOutbox = providerAttempt === undefined ? undefined : this.items.get(providerAttempt.notificationId);
    const currentAttempt = event.attemptId === undefined && directOutbox?.currentAttemptId !== undefined ? this.getAttempt(directOutbox.id, directOutbox.currentAttemptId) : undefined;
    const legacyProviderMatches = [...this.items.values()].filter((item) => item.providerMessageId === event.providerMessageId && item.provider === 'resend');
    const legacyProvider = legacyProviderMatches[0];

    let conflict = providerAttempts.length > 1 || legacyProviderMatches.length > 1;
    let targetOutbox: NotificationOutboxItem | undefined;
    let targetAttempt: NotificationDeliveryAttempt | undefined;

    if (directAttempt !== undefined && directOutbox !== undefined) {
      conflict = conflict
        || (directAttempt.providerMessageId !== undefined && directAttempt.providerMessageId !== event.providerMessageId)
        || (providerAttempt !== undefined && (providerAttempt.id !== directAttempt.id || providerAttempt.notificationId !== directOutbox.id));
      if (!conflict) { targetOutbox = directOutbox; targetAttempt = directAttempt; }
    } else if (providerAttempt !== undefined && providerOutbox !== undefined) {
      conflict = conflict || (directOutbox !== undefined && directOutbox.id !== providerOutbox.id);
      if (!conflict) { targetOutbox = providerOutbox; targetAttempt = providerAttempt; }
    } else if (event.attemptId === undefined && currentAttempt !== undefined && directOutbox !== undefined && (currentAttempt.providerMessageId === undefined || currentAttempt.providerMessageId === event.providerMessageId)) {
      targetOutbox = directOutbox; targetAttempt = currentAttempt;
    }

    if (targetOutbox === undefined && targetAttempt === undefined) {
      const legacyDirectConflict = directOutbox !== undefined
        && legacyProvider !== undefined
        && directOutbox.id !== legacyProvider.id;
      conflict = conflict || legacyDirectConflict;

      if (!conflict && directOutbox !== undefined && directOutbox.currentAttemptId === undefined && (directOutbox.providerMessageId === undefined || directOutbox.providerMessageId === event.providerMessageId)) {
        targetOutbox = directOutbox;
      } else if (legacyProvider !== undefined) {
        conflict = conflict || (directOutbox !== undefined && directOutbox.id !== legacyProvider.id);
        if (!conflict) targetOutbox = legacyProvider;
      } else if (directOutbox !== undefined && directOutbox.currentAttemptId === undefined && directOutbox.providerMessageId !== undefined && directOutbox.providerMessageId !== event.providerMessageId) {
        conflict = true;
      }
    }

    const firstSeenAt = existing?.firstSeenAt ?? now;
    const webhookAttemptCount = (existing?.attemptCount ?? 0) + 1;
    const common = {
      schemaVersion: 3 as const,
      eventId:event.eventId,
      eventType:event.eventType,
      providerMessageId:event.providerMessageId,
      ...(event.notificationId===undefined?{}:{notificationId:event.notificationId}),
      ...(event.attemptId===undefined?{}:{attemptId:event.attemptId}),
      occurredAt:event.occurredAt,
      ...(sanitizeFailureReason(event.failureReason)===undefined?{}:{failureReason:sanitizeFailureReason(event.failureReason)}),
      firstSeenAt,
      lastAttemptAt:now,
      attemptCount:webhookAttemptCount,
      retentionUntil:new Date(firstSeenAt.getTime()+WEBHOOK_RETENTION_MS),
    };

    if (conflict) {
      this.webhookEvents.set(event.eventId, { ...common, status:'INCONSISTENT', processedAt:now, lastErrorCode:'WEBHOOK_CORRELATION_CONFLICT', ...(directOutbox===undefined?{}:{targetNotificationId:directOutbox.id}), ...(directAttempt===undefined?{}:{targetAttemptId:directAttempt.id}) });
      return Promise.resolve('inconsistent');
    }
    if (targetOutbox !== undefined && targetOutbox.provider !== 'resend') {
      this.webhookEvents.set(event.eventId, { ...common, status:'INCONSISTENT', processedAt:now, lastErrorCode:'WEBHOOK_PROVIDER_MISMATCH', targetNotificationId:targetOutbox.id, ...(targetAttempt===undefined?{}:{targetAttemptId:targetAttempt.id}) });
      return Promise.resolve('inconsistent');
    }
    if (targetOutbox !== undefined) {
      if (targetAttempt !== undefined) {
        this.setAttempt(applyDeliveryAttemptWebhookState(targetAttempt, event));
        if (targetOutbox.currentAttemptId === undefined || targetOutbox.currentAttemptId === targetAttempt.id) {
          this.items.set(targetOutbox.id, { ...applyNotificationWebhookState(targetOutbox, event), schemaVersion:2, currentAttemptId:targetAttempt.id });
        }
      } else {
        this.items.set(targetOutbox.id, applyNotificationWebhookState(targetOutbox, event));
      }
      this.webhookEvents.set(event.eventId, { ...common, status:'PROCESSED', processedAt:now, targetNotificationId:targetOutbox.id, ...(targetAttempt===undefined?{}:{targetAttemptId:targetAttempt.id}) });
      return Promise.resolve('applied');
    }
    const expired = now.getTime()-firstSeenAt.getTime()>=WEBHOOK_UNMATCHED_WINDOW_MS || webhookAttemptCount>=WEBHOOK_MAX_ATTEMPTS;
    this.webhookEvents.set(event.eventId, { ...common, status:expired?'UNMATCHED_EXPIRED':'UNMATCHED_PENDING', ...(expired?{processedAt:now,lastErrorCode:'WEBHOOK_CORRELATION_EXPIRED'}:{nextAttemptAt:new Date(now.getTime()+webhookBackoffMilliseconds(webhookAttemptCount))}) });
    return Promise.resolve(expired?'expired':'unmatched');
  }

  public async reconcilePendingWebhooks(limit: number, now = new Date()): Promise<NotificationWebhookReconciliationResult> {
    const due = [...this.webhookEvents.values()].filter((record) => record.status==='UNMATCHED_PENDING' && record.nextAttemptAt!==undefined && record.nextAttemptAt<=now).sort((a,b)=>(a.nextAttemptAt?.getTime()??0)-(b.nextAttemptAt?.getTime()??0)).slice(0,Math.min(Math.max(limit,1),50));
    let processed=0; let pending=0; let expired=0; let inconsistent=0;
    for (const record of due) {
      const result = await this.applyWebhook({eventId:record.eventId,eventType:record.eventType,providerMessageId:record.providerMessageId,...(record.notificationId===undefined?{}:{notificationId:record.notificationId}),...(record.attemptId===undefined?{}:{attemptId:record.attemptId}),occurredAt:record.occurredAt,...(record.failureReason===undefined?{}:{failureReason:record.failureReason})},now);
      if(result==='applied'||result==='duplicate')processed+=1;else if(result==='unmatched')pending+=1;else if(result==='expired')expired+=1;else inconsistent+=1;
    }
    const deletable=[...this.webhookEvents.values()].filter((record)=>record.status!=='UNMATCHED_PENDING'&&record.retentionUntil<=now).slice(0,50);
    for(const record of deletable)this.webhookEvents.delete(record.eventId);
    return{examined:due.length,processed,pending,expired,inconsistent,deletedExpiredRetention:deletable.length};
  }

  public metrics(now: Date): Promise<NotificationDeliveryMetrics> {
    const items=[...this.items.values()];
    const attempts=[...this.deliveryAttempts.values()];
    const events=[...this.webhookEvents.values()];
    const day=now.toISOString().slice(0,10), month=day.slice(0,7);
    const sent=items.filter((x)=>x.sentAt!==undefined);
    const accepted=attempts.filter((x)=>x.providerAcceptedAt!==undefined);
    const legacyAccepted=items.filter((x)=>x.schemaVersion===1&&x.providerAcceptedAt!==undefined);
    const latestError=[...items].filter((x)=>x.lastErrorSummary!==undefined).sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime())[0];
    const unmatched=events.filter((event)=>event.status==='UNMATCHED_PENDING').sort((a,b)=>a.firstSeenAt.getTime()-b.firstSeenAt.getTime());
    const latestAccepted=[...accepted].sort((a,b)=>(b.providerAcceptedAt?.getTime()??0)-(a.providerAcceptedAt?.getTime()??0))[0];
    const latestLegacyAccepted=[...legacyAccepted].sort((a,b)=>(b.providerAcceptedAt?.getTime()??0)-(a.providerAcceptedAt?.getTime()??0))[0];
    const latestAcceptedAt=[latestAccepted?.providerAcceptedAt,latestLegacyAccepted?.providerAcceptedAt].filter((value):value is Date=>value!==undefined).sort((a,b)=>b.getTime()-a.getTime())[0];
    return Promise.resolve({
      sentToday:sent.filter((x)=>x.sentAt?.toISOString().startsWith(day)).length,
      sentThisMonth:sent.filter((x)=>x.sentAt?.toISOString().startsWith(month)).length,
      acceptedToday:accepted.filter((x)=>x.providerAcceptedAt?.toISOString().startsWith(day)).length+legacyAccepted.filter((x)=>x.providerAcceptedAt?.toISOString().startsWith(day)).length,
      acceptedThisMonth:accepted.filter((x)=>x.providerAcceptedAt?.toISOString().startsWith(month)).length+legacyAccepted.filter((x)=>x.providerAcceptedAt?.toISOString().startsWith(month)).length,
      acceptedTotal:accepted.length+legacyAccepted.length,
      attemptsStarted:attempts.length,
      attemptsAccepted:accepted.length+legacyAccepted.length,
      attemptsDelivered:attempts.filter((x)=>x.status==='DELIVERED').length,
      attemptsFailed:attempts.filter((x)=>['FAILED','SUPPRESSED'].includes(x.status)).length,
      attemptsBounced:attempts.filter((x)=>x.status==='BOUNCED').length,
      attemptsComplained:attempts.filter((x)=>x.status==='COMPLAINED').length,
      attemptsUncertain:attempts.filter((x)=>x.status==='UNCERTAIN').length,
      retries:attempts.filter((x)=>x.attemptNumber>1).length,
      pending:items.filter((x)=>['PENDING','PROCESSING','DEFERRED'].includes(x.status)).length,
      retryPending:items.filter((x)=>x.status==='RETRY_PENDING').length,
      deliveryUncertain:items.filter((x)=>x.status==='DELIVERY_UNCERTAIN').length,
      failed:items.filter((x)=>['FAILED','SUPPRESSED'].includes(x.status)).length,
      failedConfiguration:items.filter((x)=>x.status==='FAILED_CONFIGURATION').length,
      delivered:items.filter((x)=>x.status==='DELIVERED').length,
      bounced:items.filter((x)=>x.status==='BOUNCED').length,
      complained:items.filter((x)=>x.status==='COMPLAINED').length,
      unmatchedWebhookPending:unmatched.length,
      ...(unmatched[0]===undefined?{}:{oldestUnmatchedWebhookAt:unmatched[0].firstSeenAt}),
      ...(latestAcceptedAt===undefined?{}:{lastSuccessfulSendAt:latestAcceptedAt}),
      ...(latestError?.lastErrorSummary===undefined?{}:{lastError:latestError.lastErrorSummary}),
      ...(latestError?.lastFailureCategory===undefined?{}:{lastFailureCategory:latestError.lastFailureCategory}),
      ...([...items].filter((x)=>x.lastAttemptAt!==undefined).sort((a,b)=>(b.lastAttemptAt?.getTime()??0)-(a.lastAttemptAt?.getTime()??0))[0]?.lastAttemptAt===undefined?{}:{lastAttemptAt:[...items].filter((x)=>x.lastAttemptAt!==undefined).sort((a,b)=>(b.lastAttemptAt?.getTime()??0)-(a.lastAttemptAt?.getTime()??0))[0]?.lastAttemptAt}),
      ...([...items].filter((x)=>['PENDING','PROCESSING','RETRY_PENDING','DEFERRED','DELIVERY_UNCERTAIN'].includes(x.status)).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime())[0]===undefined?{}:{oldestPendingAt:[...items].filter((x)=>['PENDING','PROCESSING','RETRY_PENDING','DEFERRED','DELIVERY_UNCERTAIN'].includes(x.status)).sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime())[0]?.createdAt}),
    });
  }

  public all(): NotificationOutboxItem[] { return structuredClone([...this.items.values()]); }
  public attempts(): NotificationDeliveryAttempt[] { return structuredClone([...this.deliveryAttempts.values()]); }
  public webhookRecords(): NotificationWebhookRecord[] { return structuredClone([...this.webhookEvents.values()]); }
}
