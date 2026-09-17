import { retryDelayMilliseconds } from './notificationOutbox';
import type {
  NotificationDeliveryAttempt,
  NotificationFailureCategory,
  NotificationOutboxItem,
  NotificationStatus,
  NotificationWebhookEvent,
} from '../models/notificationDomain';

export const PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60_000;

const ADVERSE_PRECEDENCE: Partial<Record<NotificationStatus, number>> = {
  FAILED: 10, FAILED_CONFIGURATION: 20, SUPPRESSED: 30, BOUNCED: 40, COMPLAINED: 50,
};

interface FailedClassification {
  status: 'RETRY_PENDING' | 'DEFERRED' | 'FAILED' | 'FAILED_CONFIGURATION' | 'SUPPRESSED';
  category: NotificationFailureCategory;
  code: string;
  summary: string;
}

export function classifyResendFailedReason(reason: string | undefined): FailedClassification {
  const normalized = (reason ?? '').trim().toLowerCase();
  if (/quota|rate|reached_(?:daily|monthly)|limit/u.test(normalized)) {
    return { status: 'DEFERRED', category: 'QUOTA', code: normalized || 'provider_quota', summary: 'O provedor informou limitação de cota ou taxa; a nova tentativa ficará adiada.' };
  }
  if (/temporary|transient|timeout|unavailable|internal|provider|connection/u.test(normalized)) {
    return { status: 'RETRY_PENDING', category: 'TRANSIENT', code: normalized || 'provider_transient_failure', summary: 'O provedor informou falha transitória; a entrega poderá ser tentada novamente de forma controlada.' };
  }
  if (/api.?key|domain|auth|sender|from_address|configuration|verif/u.test(normalized)) {
    return { status: 'FAILED_CONFIGURATION', category: 'CONFIGURATION', code: normalized || 'provider_configuration_failure', summary: 'O provedor informou falha de configuração, autenticação, remetente ou domínio.' };
  }
  if (/invalid.?recipient|recipient.*invalid|invalid.?email|invalid.?address/u.test(normalized)) {
    return { status: 'FAILED', category: 'INVALID_RECIPIENT', code: normalized || 'invalid_recipient', summary: 'O provedor informou destinatário inválido.' };
  }
  if (/suppress/u.test(normalized)) {
    return { status: 'SUPPRESSED', category: 'SUPPRESSION', code: normalized || 'provider_suppression', summary: 'O provedor informou supressão efetiva do destinatário.' };
  }
  return { status: 'FAILED', category: 'UNKNOWN', code: normalized || 'provider_unknown_failure', summary: 'O provedor informou falha permanente sem categoria suficientemente específica.' };
}

export function providerEventConfirmsAcceptance(eventType: NotificationWebhookEvent['eventType']): boolean {
  return ['email.sent', 'email.delivery_delayed', 'email.delivered', 'email.bounced', 'email.complained'].includes(eventType);
}

function eventBase(item: NotificationOutboxItem, event: NotificationWebhookEvent): NotificationOutboxItem {
  return {
    ...item,
    providerMessageId: event.providerMessageId,
    ...(providerEventConfirmsAcceptance(event.eventType) && item.providerAcceptedAt === undefined ? { providerAcceptedAt: event.occurredAt } : {}),
    updatedAt: event.occurredAt,
    lastProviderEventAt: event.occurredAt,
    lastProviderEventType: event.eventType,
    leaseOwner: undefined,
    leaseUntil: undefined,
    retryMode: undefined,
    retrySafety: undefined,
  };
}

function safeRetryAt(item: NotificationOutboxItem, event: NotificationWebhookEvent, quota: boolean): Date {
  const providerSafeUntil = item.idempotencySafeUntil ?? new Date(event.occurredAt.getTime() + PROVIDER_IDEMPOTENCY_WINDOW_MS);
  const normalRetry = new Date(event.occurredAt.getTime() + (quota ? PROVIDER_IDEMPOTENCY_WINDOW_MS : retryDelayMilliseconds(Math.max(item.attemptCount, 1))));
  return new Date(Math.max(normalRetry.getTime(), providerSafeUntil.getTime() + 60_000));
}

export function applyNotificationWebhookState(item: NotificationOutboxItem, event: NotificationWebhookEvent): NotificationOutboxItem {
  if (item.lastProviderEventAt !== undefined && event.occurredAt.getTime() < item.lastProviderEventAt.getTime()) return item;
  const currentAdverseRank = ADVERSE_PRECEDENCE[item.status] ?? 0;
  if (currentAdverseRank > 0) {
    const incomingStatus: NotificationStatus | undefined = event.eventType === 'email.complained' ? 'COMPLAINED'
      : event.eventType === 'email.bounced' ? 'BOUNCED'
      : event.eventType === 'email.suppressed' ? 'SUPPRESSED'
      : event.eventType === 'email.failed' ? classifyResendFailedReason(event.failureReason).status
      : undefined;
    const incomingRank = incomingStatus === undefined ? 0 : ADVERSE_PRECEDENCE[incomingStatus] ?? 0;
    if (incomingRank <= currentAdverseRank) return item;
  }

  if (item.status === 'DELIVERED' && !['email.bounced', 'email.complained'].includes(event.eventType)) return item;

  const base = eventBase(item, event);
  if (event.eventType === 'email.sent') {
    return { ...base, status: item.status === 'DELIVERED' ? 'DELIVERED' : 'SENT', sentAt: item.sentAt ?? event.occurredAt, lastFailureCategory: undefined, lastErrorCode: undefined, lastErrorSummary: undefined };
  }
  if (event.eventType === 'email.delivery_delayed') {
    return { ...base, status: item.status === 'DELIVERED' ? 'DELIVERED' : 'SENT', lastFailureCategory: 'TRANSIENT', lastErrorCode: 'delivery_delayed', lastErrorSummary: 'O provedor aceitou a mensagem e informou atraso temporário na entrega; não haverá reenvio automático enquanto o provedor ainda processa a mensagem.' };
  }
  if (event.eventType === 'email.delivered') {
    return { ...base, status: 'DELIVERED', deliveredAt: event.occurredAt, lastFailureCategory: undefined, lastErrorCode: undefined, lastErrorSummary: undefined };
  }
  if (event.eventType === 'email.bounced') {
    return { ...base, status: 'BOUNCED', failedAt: event.occurredAt, lastFailureCategory: 'BOUNCE', lastErrorCode: 'bounce', lastErrorSummary: 'O provedor informou devolução permanente da entrega.' };
  }
  if (event.eventType === 'email.complained') {
    return { ...base, status: 'COMPLAINED', failedAt: event.occurredAt, lastFailureCategory: 'COMPLAINT', lastErrorCode: 'complaint', lastErrorSummary: 'O provedor informou reclamação do destinatário.' };
  }
  if (event.eventType === 'email.suppressed') {
    return { ...base, status: 'SUPPRESSED', failedAt: event.occurredAt, lastFailureCategory: 'SUPPRESSION', lastErrorCode: 'email.suppressed', lastErrorSummary: 'O provedor informou supressão efetiva do destinatário.' };
  }

  const classification = classifyResendFailedReason(event.failureReason);
  const retryable = classification.status === 'RETRY_PENDING' || classification.status === 'DEFERRED';
  return {
    ...base,
    status: classification.status,
    nextAttemptAt: retryable ? safeRetryAt(item, event, classification.status === 'DEFERRED') : base.nextAttemptAt,
    ...(retryable ? { idempotencySafeUntil: undefined, retryMode: 'NEW_ATTEMPT' as const, retrySafety: 'PROVIDER_REJECTED' as const } : {}),
    ...(retryable ? {} : { failedAt: event.occurredAt }),
    lastFailureCategory: classification.category,
    lastErrorCode: classification.code,
    lastErrorSummary: classification.summary,
  };
}

function attemptBase(attempt: NotificationDeliveryAttempt, event: NotificationWebhookEvent): NotificationDeliveryAttempt {
  return {
    ...attempt,
    providerMessageId: event.providerMessageId,
    ...(providerEventConfirmsAcceptance(event.eventType) && attempt.providerAcceptedAt === undefined ? { providerAcceptedAt: event.occurredAt } : {}),
    updatedAt: event.occurredAt,
    lastProviderEventAt: event.occurredAt,
    lastProviderEventType: event.eventType,
    retryMode: undefined,
    retrySafety: undefined,
    nextAttemptAt: undefined,
  };
}

export function applyDeliveryAttemptWebhookState(attempt: NotificationDeliveryAttempt, event: NotificationWebhookEvent): NotificationDeliveryAttempt {
  if (attempt.lastProviderEventAt !== undefined && event.occurredAt.getTime() < attempt.lastProviderEventAt.getTime()) return attempt;
  if (attempt.status === 'COMPLAINED') return attempt;
  if (attempt.status === 'BOUNCED' && event.eventType !== 'email.complained') return attempt;
  if (attempt.status === 'DELIVERED' && !['email.bounced', 'email.complained'].includes(event.eventType)) return attempt;

  const base = attemptBase(attempt, event);
  if (event.eventType === 'email.sent' || event.eventType === 'email.delivery_delayed') {
    return { ...base, status: attempt.status === 'DELIVERED' ? 'DELIVERED' : 'ACCEPTED', failureCategory: undefined, lastErrorCode: undefined, lastErrorSummary: undefined };
  }
  if (event.eventType === 'email.delivered') {
    return { ...base, status: 'DELIVERED', completedAt: event.occurredAt, failureCategory: undefined, lastErrorCode: undefined, lastErrorSummary: undefined };
  }
  if (event.eventType === 'email.bounced') {
    return { ...base, status: 'BOUNCED', completedAt: event.occurredAt, failureCategory: 'BOUNCE', lastErrorCode: 'bounce', lastErrorSummary: 'O provedor informou devolução permanente da tentativa.' };
  }
  if (event.eventType === 'email.complained') {
    return { ...base, status: 'COMPLAINED', completedAt: event.occurredAt, failureCategory: 'COMPLAINT', lastErrorCode: 'complaint', lastErrorSummary: 'O provedor informou reclamação associada à tentativa.' };
  }
  if (event.eventType === 'email.suppressed') {
    return { ...base, status: 'SUPPRESSED', completedAt: event.occurredAt, failureCategory: 'SUPPRESSION', lastErrorCode: 'email.suppressed', lastErrorSummary: 'O provedor informou supressão da tentativa.' };
  }

  const classification = classifyResendFailedReason(event.failureReason);
  return {
    ...base,
    status: classification.status === 'SUPPRESSED' ? 'SUPPRESSED' : 'FAILED',
    completedAt: event.occurredAt,
    failureCategory: classification.category,
    lastErrorCode: classification.code,
    lastErrorSummary: classification.summary,
  };
}
