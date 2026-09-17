export interface InfrastructureCapacitySettings {
  schemaVersion: 1;
  r2StorageReferenceBytes: number;
  firestoreStorageReferenceBytes: number;
  artifactRegistryStorageReferenceBytes: number;
  resendDailyReference: number;
  resendMonthlyReference: number;
  warningPercent: number;
  alertPercent: number;
  criticalPercent: number;
  referenceVerifiedAt: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export type CapacityLevel = 'Normal' | 'Atenção' | 'Alerta' | 'Crítico' | 'Não medido' | 'Inventário incompleto';
export type NotificationFailureCategory = 'TRANSIENT' | 'QUOTA' | 'CONFIGURATION' | 'INVALID_RECIPIENT' | 'SUPPRESSION' | 'BOUNCE' | 'COMPLAINT' | 'UNKNOWN';

export interface InfrastructureSnapshot {
  id: string;
  schemaVersion: 1;
  capturedAt: string;
  captureSource: 'ADMIN' | 'MAINTENANCE_WORKER' | 'ARTIFACT_SCRIPT';
  period: string;
  r2: {
    measured: boolean;
    inventoryComplete: boolean;
    objectCount: number | null;
    bytes: number | null;
    mainPhotoCount: number | null;
    thumbnailCount: number | null;
    oldestObjectAt: string | null;
    lastInventoryAt: string | null;
  };
  firestore: {
    counts: Record<string, number>;
    totalDocuments: number;
    estimatedLogicalBytes: number | null;
    estimationMethod: string;
    documentsSampled: number;
    coveragePercent: number | null;
  };
  notifications: {
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
    oldestPendingAt: string | null;
    oldestUnmatchedWebhookAt: string | null;
    lastAttemptAt: string | null;
    lastSuccessfulSendAt: string | null;
    lastError: string | null;
    lastFailureCategory: NotificationFailureCategory | null;
  };
  cleanup: { pendingTasks: number; completedTasks: number; pendingObjects: number; oldestPendingAt: string | null; lastError: string | null };
  artifactRegistry: { collected: boolean; capturedAt: string | null; bytes: number | null; versionCount: number | null; repository: string | null };
  reconciliation: { missingObjects: number; orphanObjects: number; sizeMismatches: number; lastRunAt: string | null };
}

export interface InfrastructureProjection {
  metric: 'R2' | 'Firestore' | 'Artifact Registry';
  monthlyGrowthBytes: number | null;
  monthsToReference: number | null;
  message: string;
}

export interface InfrastructureOverview {
  settings: InfrastructureCapacitySettings;
  latest: InfrastructureSnapshot | null;
  history: InfrastructureSnapshot[];
  projections: InfrastructureProjection[];
  notificationRuntime: {
    provider: 'Resend' | 'EWS'; environmentEnabled: boolean; applicationEnabled: boolean; effectiveEnabled: boolean;
    from: string | null; recipientCount: number; configurationIssues: string[];
  };
  levels: Record<'r2' | 'firestore' | 'artifactRegistry' | 'resendDaily' | 'resendMonthly', { percent: number | null; level: CapacityLevel }>;
}

export interface NotificationStatus {
  provider: 'Resend' | 'EWS';
  environmentEnabled: boolean;
  applicationEnabled: boolean;
  effectiveEnabled: boolean;
  from: string | null;
  recipientCount: number;
  configurationIssues: string[];
  metrics: InfrastructureSnapshot['notifications'];
}

export interface StorageReconciliationReport {
  dryRun: boolean;
  inventoryComplete: boolean;
  metadataCount: number;
  objectCount: number;
  missingObjects: string[];
  orphanObjects: string[];
  sizeMismatches: string[];
  deletedOrphans: number;
  generatedAt: string;
}

export const CAPACITY_METRIC_LABELS: Record<keyof InfrastructureOverview['levels'], string> = {
  r2: 'Armazenamento de fotografias (R2)',
  firestore: 'Banco de dados (Firestore)',
  artifactRegistry: 'Registro de contêineres',
  resendDaily: 'Notificações diárias',
  resendMonthly: 'Notificações mensais',
};

export function formatCapacityPercent(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return '(percentual não mensurável)';
  }
  return `(${percent.toFixed(1)}%)`;
}

