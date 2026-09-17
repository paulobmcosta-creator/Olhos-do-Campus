import { createHash } from 'node:crypto';
import type { StoredOccurrence } from '../models/occurrenceDomain';
import type { NotificationOutboxItem } from '../models/notificationDomain';
import { validateEmail } from '../utils/email';

export function recipientHash(recipient: string): string {
  return createHash('sha256').update(validateEmail(recipient), 'utf8').digest('hex');
}

export function deliveryAttemptId(notificationId: string, attemptNumber: number): string {
  if (!/^[a-f0-9]{64}$/u.test(notificationId) || !Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error('INVALID_NOTIFICATION_DELIVERY_ATTEMPT_ID_INPUT');
  }
  return createHash('sha256').update(`${notificationId}\n${attemptNumber}`, 'utf8').digest('hex');
}

export function deliveryAttemptIdempotencyKey(notificationId: string, attemptId: string): string {
  if (!/^[a-f0-9]{64}$/u.test(notificationId) || !/^[a-f0-9]{64}$/u.test(attemptId)) {
    throw new Error('INVALID_NOTIFICATION_DELIVERY_ATTEMPT_IDEMPOTENCY_INPUT');
  }
  return `notification-delivery/${notificationId}/${attemptId}`;
}

function identity(eventType: NotificationOutboxItem['eventType'], entityId: string, hash: string, templateVersion: string): string {
  return createHash('sha256').update(`${eventType}\n${entityId}\n${hash}\n${templateVersion}`, 'utf8').digest('hex');
}

export function createOccurrenceNotificationItems(
  occurrence: StoredOccurrence,
  recipients: readonly string[],
  now = occurrence.createdAt,
  provider: 'resend' | 'ews' = 'resend',
): NotificationOutboxItem[] {
  if (occurrence.dataClassification !== 'REAL') return [];
  const normalizedRecipients = [...new Set(recipients.map(validateEmail))];
  return normalizedRecipients.map((recipient) => {
    const hash = recipientHash(recipient);
    const id = identity('OCCURRENCE_CREATED', occurrence.id, hash, 'occurrence-created-v1');
    return {
      schemaVersion: 2,
      id,
      eventType: 'OCCURRENCE_CREATED',
      entityType: 'occurrence',
      entityId: occurrence.id,
      occurrenceId: occurrence.id,
      protocol: occurrence.protocol,
      recipient,
      recipientHash: hash,
      status: 'PENDING',
      attemptCount: 0,
      provider,
      idempotencyKey: `occurrence-created/${id}`,
      templateVersion: 'occurrence-created-v1',
      templateData: {
        occurredAt: occurrence.createdAt,
        category: occurrence.categoryNameSnapshot,
        location: [occurrence.location.buildingName, occurrence.location.room].filter(Boolean).join(' — '),
        priority: occurrence.priority,
        immediateRisk: occurrence.immediateRisk,
      },
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
    };
  });
}

export function createTestNotificationItem(
  recipient: string,
  requestKey: string,
  now = new Date(),
  provider: 'resend' | 'ews' = 'resend',
): NotificationOutboxItem {
  const normalized = validateEmail(recipient);
  const hash = recipientHash(normalized);
  const entityId = createHash('sha256').update(requestKey, 'utf8').digest('hex');
  const id = identity('ADMIN_TEST', entityId, hash, 'notification-test-v1');
  return {
    schemaVersion: 2,
    id,
    eventType: 'ADMIN_TEST',
    entityType: 'notificationTest',
    entityId,
    protocol: 'TESTE-ADMINISTRATIVO',
    recipient: normalized,
    recipientHash: hash,
    status: 'PENDING',
    attemptCount: 0,
    provider,
    idempotencyKey: `notification-test/${id}`,
    templateVersion: 'notification-test-v1',
    templateData: {
      occurredAt: now,
      category: 'Teste controlado de notificação',
      location: 'Área administrativa',
      priority: 'Normal',
      immediateRisk: false,
    },
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
  };
}

export function createTeamRoutedNotificationItem(
  occurrence: StoredOccurrence,
  teamEmail: string,
  teamName: string,
  now = new Date(),
  provider: 'resend' | 'ews' = 'ews',
): NotificationOutboxItem | null {
  if (occurrence.dataClassification !== 'REAL') return null;
  const normalized = validateEmail(teamEmail);
  const hash = recipientHash(normalized);
  const entityId = `${occurrence.id}:v${occurrence.version}:team:${occurrence.assignedTeamId ?? 'none'}`;
  const id = identity('OCCURRENCE_TEAM_ROUTED', entityId, hash, 'occurrence-team-routed-v1');
  return {
    schemaVersion: 2,
    id,
    eventType: 'OCCURRENCE_TEAM_ROUTED',
    entityType: 'occurrence',
    entityId,
    occurrenceId: occurrence.id,
    protocol: occurrence.protocol,
    recipient: normalized,
    recipientHash: hash,
    status: 'PENDING',
    attemptCount: 0,
    provider,
    idempotencyKey: `occurrence-routed/${occurrence.id}/v${occurrence.version}/${occurrence.assignedTeamId ?? 'none'}`,
    templateVersion: 'occurrence-team-routed-v1',
    templateData: {
      occurredAt: occurrence.createdAt,
      category: occurrence.categoryNameSnapshot,
      location: [occurrence.location.buildingName, occurrence.location.room].filter(Boolean).join(' — '),
      priority: occurrence.priority,
      immediateRisk: occurrence.immediateRisk,
      teamName,
    },
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
  };
}

export function createResponsibleAssignedNotificationItem(
  occurrence: StoredOccurrence,
  responsibleEmail: string,
  responsibleName: string,
  now = new Date(),
  provider: 'resend' | 'ews' = 'ews',
): NotificationOutboxItem | null {
  if (occurrence.dataClassification !== 'REAL') return null;
  const normalized = validateEmail(responsibleEmail);
  const hash = recipientHash(normalized);
  const entityId = `${occurrence.id}:v${occurrence.version}:user:${occurrence.assignedToAdminUserId ?? 'none'}`;
  const id = identity('OCCURRENCE_RESPONSIBLE_ASSIGNED', entityId, hash, 'occurrence-responsible-assigned-v1');
  return {
    schemaVersion: 2,
    id,
    eventType: 'OCCURRENCE_RESPONSIBLE_ASSIGNED',
    entityType: 'occurrence',
    entityId,
    occurrenceId: occurrence.id,
    protocol: occurrence.protocol,
    recipient: normalized,
    recipientHash: hash,
    status: 'PENDING',
    attemptCount: 0,
    provider,
    idempotencyKey: `occurrence-assigned/${occurrence.id}/v${occurrence.version}/${occurrence.assignedToAdminUserId ?? 'none'}`,
    templateVersion: 'occurrence-responsible-assigned-v1',
    templateData: {
      occurredAt: occurrence.createdAt,
      category: occurrence.categoryNameSnapshot,
      location: [occurrence.location.buildingName, occurrence.location.room].filter(Boolean).join(' — '),
      priority: occurrence.priority,
      immediateRisk: occurrence.immediateRisk,
      responsibleName,
      ...(occurrence.assignedTeamNameSnapshot !== undefined ? { teamName: occurrence.assignedTeamNameSnapshot } : {}),
    },
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
  };
}

export function retryDelayMilliseconds(attempt: number): number {
  const boundedAttempt = Math.min(Math.max(attempt, 1), 8);
  return Math.min(15 * 60_000 * (2 ** (boundedAttempt - 1)), 24 * 60 * 60_000);
}

