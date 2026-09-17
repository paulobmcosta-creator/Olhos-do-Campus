export const NOTIFICATION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'DELIVERED',
  'RETRY_PENDING',
  'DEFERRED',
  'DELIVERY_UNCERTAIN',
  'FAILED',
  'FAILED_CONFIGURATION',
  'BOUNCED',
  'COMPLAINED',
  'SUPPRESSED',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type NotificationEventType = 'OCCURRENCE_CREATED' | 'OCCURRENCE_TEAM_ROUTED' | 'OCCURRENCE_RESPONSIBLE_ASSIGNED' | 'ADMIN_TEST';

export const NOTIFICATION_FAILURE_CATEGORIES = [
  'TRANSIENT',
  'QUOTA',
  'CONFIGURATION',
  'INVALID_RECIPIENT',
  'SUPPRESSION',
  'BOUNCE',
  'COMPLAINT',
  'UNKNOWN',
] as const;
export type NotificationFailureCategory = (typeof NOTIFICATION_FAILURE_CATEGORIES)[number];

export const NOTIFICATION_RETRY_MODES = ['SAME_ATTEMPT', 'NEW_ATTEMPT'] as const;
export type NotificationRetryMode = (typeof NOTIFICATION_RETRY_MODES)[number];
export const NOTIFICATION_RETRY_SAFETY = ['IDEMPOTENCY_WINDOW', 'PROVIDER_REJECTED'] as const;
export type NotificationRetrySafety = (typeof NOTIFICATION_RETRY_SAFETY)[number];

export const NOTIFICATION_DELIVERY_ATTEMPT_STATUSES = [
  'PROCESSING',
  'RETRY_PENDING',
  'ACCEPTED',
  'UNCERTAIN',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED',
  'SUPPRESSED',
] as const;
export type NotificationDeliveryAttemptStatus = (typeof NOTIFICATION_DELIVERY_ATTEMPT_STATUSES)[number];

export const NOTIFICATION_WEBHOOK_STATUSES = [
  'UNMATCHED_PENDING',
  'PROCESSED',
  'UNMATCHED_EXPIRED',
  'INCONSISTENT',
] as const;
export type NotificationWebhookStatus = (typeof NOTIFICATION_WEBHOOK_STATUSES)[number];

export interface NotificationTemplateData {
  occurredAt: Date;
  category: string;
  location: string;
  priority: string;
  immediateRisk: boolean;
  teamName?: string;
  responsibleName?: string;
}

export interface NotificationOutboxItem {
  schemaVersion: 1 | 2;
  id: string;
  eventType: NotificationEventType;
  entityType: 'occurrence' | 'notificationTest';
  entityId: string;
  occurrenceId?: string;
  protocol: string;
  recipient: string;
  recipientHash: string;
  status: NotificationStatus;
  attemptCount: number;
  provider: 'resend' | 'ews';
  /** Último providerMessageId conhecido; mantido como cache/compatibilidade com documentos 0.7.2. */
  providerMessageId?: string;
  /** Cache da chave da tentativa corrente; documentos 0.7.2 podem conter a chave lógica legada. */
  idempotencyKey: string;
  currentAttemptId?: string;
  retryMode?: NotificationRetryMode;
  retrySafety?: NotificationRetrySafety;
  idempotencySafeUntil?: Date;
  providerAcceptedAt?: Date;
  lastProviderEventAt?: Date;
  lastProviderEventType?: NotificationWebhookEvent['eventType'];
  templateVersion: 'occurrence-created-v1' | 'occurrence-team-routed-v1' | 'occurrence-responsible-assigned-v1' | 'notification-test-v1';
  templateData: NotificationTemplateData;
  createdAt: Date;
  updatedAt: Date;
  nextAttemptAt: Date;
  lastAttemptAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  lastFailureCategory?: NotificationFailureCategory;
  lastErrorCode?: string;
  lastErrorSummary?: string;
  leaseUntil?: Date;
  leaseOwner?: string;
}


export interface NotificationDeliveryAttempt {
  schemaVersion: 1;
  id: string;
  notificationId: string;
  attemptNumber: number;
  status: NotificationDeliveryAttemptStatus;
  idempotencyKey: string;
  technicalRetryCount: number;
  retryMode?: NotificationRetryMode;
  retrySafety?: NotificationRetrySafety;
  nextAttemptAt?: Date;
  createdAt: Date;
  startedAt: Date;
  updatedAt: Date;
  providerAcceptedAt?: Date;
  providerMessageId?: string;
  completedAt?: Date;
  failureCategory?: NotificationFailureCategory;
  lastErrorCode?: string;
  lastErrorSummary?: string;
  lastProviderEventAt?: Date;
  lastProviderEventType?: NotificationWebhookEvent['eventType'];
}

export interface NotificationDeliveryMetrics {
  sentToday: number;
  sentThisMonth: number;
  acceptedToday: number;
  acceptedThisMonth: number;
  acceptedTotal: number;
  attemptsStarted: number;
  attemptsAccepted: number;
  attemptsDelivered: number;
  attemptsFailed: number;
  attemptsBounced: number;
  attemptsComplained: number;
  attemptsUncertain: number;
  retries: number;
  pending: number;
  retryPending: number;
  deliveryUncertain: number;
  failed: number;
  failedConfiguration: number;
  delivered: number;
  bounced: number;
  complained: number;
  unmatchedWebhookPending: number;
  oldestPendingAt?: Date;
  oldestUnmatchedWebhookAt?: Date;
  lastAttemptAt?: Date;
  lastSuccessfulSendAt?: Date;
  lastError?: string;
  lastFailureCategory?: NotificationFailureCategory;
}

export interface NotificationWebhookEvent {
  eventId: string;
  eventType: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.bounced' | 'email.complained' | 'email.failed' | 'email.suppressed';
  providerMessageId: string;
  notificationId?: string;
  attemptId?: string;
  occurredAt: Date;
  failureReason?: string;
}

export interface NotificationWebhookRecord extends NotificationWebhookEvent {
  schemaVersion: 2 | 3;
  status: NotificationWebhookStatus;
  firstSeenAt: Date;
  lastAttemptAt: Date;
  attemptCount: number;
  nextAttemptAt?: Date;
  processedAt?: Date;
  targetNotificationId?: string;
  targetAttemptId?: string;
  lastErrorCode?: string;
  retentionUntil: Date;
}

export interface NotificationWebhookReconciliationResult {
  examined: number;
  processed: number;
  pending: number;
  expired: number;
  inconsistent: number;
  deletedExpiredRetention: number;
}
