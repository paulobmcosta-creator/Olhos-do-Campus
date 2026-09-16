import type { AdminRole } from '../../src/models/admin';
import type { ServiceCalendar, ServiceCalendarException } from '../../src/models/operations';
import type {
  DataClassification, InternalNoteAudience, LocationDetail, OccurrenceEventType, OccurrenceEventVisibility,
  OccurrencePriority, OccurrenceStatus,
} from '../../src/models/occurrence';

export interface StoredOccurrenceSla {
  schemaVersion: 1;
  policyVersion: string;
  firstResponseTargetBusinessMinutes: number;
  firstResponseDueAt: Date;
  firstResponseAt?: Date;
  firstResponseOutcome?: 'ON_TIME' | 'BREACHED';
  resolutionBaseBusinessMinutes: number;
  priorityMultiplier: number;
  resolutionTargetBusinessMinutes: number;
  resolutionDueAt: Date;
  resolutionNearDueAt: Date;
  resolutionPaused: boolean;
  resolutionPauseStartedAt?: Date;
  accumulatedPausedBusinessMinutes: number;
  completedAt?: Date;
  resolutionOutcome?: 'ON_TIME' | 'BREACHED';
  calendarSnapshotId: string;
  calendarSnapshot?: { calendar: ServiceCalendar; exceptions: ServiceCalendarException[] };
  legacyAssessment?: 'CALCULATED' | 'ESTIMATED' | 'UNAVAILABLE';
}

export interface StoredOccurrence {
  id: string;
  schemaVersion: 2;
  protocol: string;
  trackingKeyHash: string;
  trackingKeySalt: string;
  reportedCategoryId: string;
  reportedCategoryNameSnapshot: string;
  categoryId: string;
  categoryNameSnapshot: string;
  reportedLocation: LocationDetail;
  location: LocationDetail;
  description: string;
  immediateRisk: boolean;
  status: OccurrenceStatus;
  priority: OccurrencePriority;
  priorityRank: number;
  assignedTeamId?: string;
  assignedTeamNameSnapshot?: string;
  assignedToAdminUserId?: string;
  assignedToDisplayNameSnapshot?: string;
  duplicateOfOccurrenceId?: string;
  duplicateOfProtocol?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  resolvedAt?: Date;
  firstPublicResponseAt?: Date;
  version: number;
  dataClassification: DataClassification;
  reopenedCount: number;
  lastReopenedAt?: Date;
  hasPhoto: boolean;
  searchTokens: string[];
  sla?: StoredOccurrenceSla;
}

export interface OccurrenceEventRecord {
  id: string;
  schemaVersion: 2;
  eventType: OccurrenceEventType;
  visibility: OccurrenceEventVisibility;
  audience?: InternalNoteAudience;
  audienceTeamIdSnapshot?: string;
  createdAt: Date;
  actorType: 'SYSTEM' | 'ADMIN';
  actorAdminUserId?: string;
  actorUid?: string;
  actorRoleSnapshot?: AdminRole | 'Sistema';
  actorDisplayNameSnapshot?: string;
  publicDescription?: string;
  internalDescription?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  correlationId: string;
}
export type NewOccurrenceEvent = Omit<OccurrenceEventRecord, 'id'>;

export interface NewOccurrenceRecord {
  categoryId: string;
  categoryNameSnapshot: string;
  location: LocationDetail;
  description: string;
  immediateRisk: boolean;
  priority: OccurrencePriority;
  trackingKeyHash: string;
  trackingKeySalt: string;
  dataClassification: DataClassification;
  sla?: StoredOccurrenceSla;
  searchTokens: string[];
}
