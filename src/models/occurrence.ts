export const OCCURRENCE_STATUSES = [
  'Recebida','Em triagem','Em análise','Encaminhada ao setor responsável','Em atendimento',
  'Aguardando material','Aguardando contratação ou serviço externo','Resolvida','Não procedente','Duplicada','Cancelada',
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];
export const TERMINAL_OCCURRENCE_STATUSES = ['Resolvida','Não procedente','Duplicada','Cancelada'] as const;

export const OCCURRENCE_PRIORITIES = ['Baixa','Normal','Alta','Urgente','Emergencial'] as const;
export type OccurrencePriority = (typeof OCCURRENCE_PRIORITIES)[number];
export const PRIORITY_RANK: Record<OccurrencePriority, number> = { Emergencial: 1, Urgente: 2, Alta: 3, Normal: 4, Baixa: 5 };

export const INTERNAL_NOTE_AUDIENCES = ['ADMIN_ONLY','ADMINS_AND_MANAGERS','RESPONSIBLE_TEAM'] as const;
export type InternalNoteAudience = (typeof INTERNAL_NOTE_AUDIENCES)[number];
export type DataClassification = 'REAL' | 'TEST';
export type AttachmentRelation = 'DUPLICATE' | 'SIMILAR';
export type SlaFilterStatus = 'ON_TIME' | 'NEAR_DUE' | 'BREACHED' | 'PAUSED' | 'COMPLETED';

export const OCCURRENCE_EVENT_TYPES = [
  'OCCURRENCE_CREATED','STATUS_CHANGED','CATEGORY_CHANGED','LOCATION_CHANGED','PRIORITY_CHANGED',
  'TEAM_ASSIGNED','TEAM_CHANGED','RESPONSIBLE_CHANGED','PUBLIC_MESSAGE_ADDED','INTERNAL_NOTE_ADDED',
  'DUPLICATE_LINKED','DUPLICATE_UNLINKED','OCCURRENCE_RESOLVED','OCCURRENCE_CLOSED','OCCURRENCE_REOPENED',
  'DATA_CLASSIFICATION_CHANGED','OCCURRENCE_ATTACHED','OCCURRENCE_DETACHED',
  'SLA_PAUSED','SLA_RESUMED','PHOTO_ADDED','PHOTO_DELETED','PHOTO_VISIBILITY_CHANGED',
] as const;
export type OccurrenceEventType = (typeof OCCURRENCE_EVENT_TYPES)[number];
export type OccurrenceEventVisibility = 'PUBLIC' | 'INTERNAL';

export function isOccurrenceStatus(value: string): value is OccurrenceStatus { return OCCURRENCE_STATUSES.some((item) => item === value); }
export function isOccurrencePriority(value: string): value is OccurrencePriority { return OCCURRENCE_PRIORITIES.some((item) => item === value); }

export interface LocationDetail {
  campusId?: string;
  campusName: string;
  buildingId?: string;
  buildingName: string;
  floorId?: string;
  floor: string;
  roomId?: string;
  room: string;
  complement?: string;
  isOther?: boolean;
  otherDescription?: string;
}
export type PublicLocationDetail = Omit<LocationDetail, 'campusId' | 'buildingId' | 'floorId' | 'roomId'>;
export interface LocationSelectionInput {
  campusId: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  complement?: string;
  isOther?: boolean;
  otherDescription?: string;
}

export interface OccurrenceSla {
  schemaVersion: 1;
  policyVersion: string;
  firstResponseTargetBusinessMinutes: number;
  firstResponseDueAt: string;
  firstResponseAt?: string;
  firstResponseOutcome?: 'ON_TIME' | 'BREACHED';
  resolutionBaseBusinessMinutes: number;
  priorityMultiplier: number;
  resolutionTargetBusinessMinutes: number;
  resolutionDueAt: string;
  resolutionNearDueAt: string;
  resolutionPaused: boolean;
  resolutionPauseStartedAt?: string;
  accumulatedPausedBusinessMinutes: number;
  effectiveElapsedBusinessMinutes: number;
  completedAt?: string;
  resolutionOutcome?: 'ON_TIME' | 'BREACHED';
  calendarSnapshotId: string;
  legacyAssessment?: 'CALCULATED' | 'ESTIMATED' | 'UNAVAILABLE';
}

export interface TimelineEvent { id: string; date: string; title: string; description?: string; isPublic: boolean; authorRole?: string; }
export interface PublicMessage { id: string; date: string; message: string; authorRole: string; }
export interface InternalNote { id: string; date: string; note: string; authorName: string; authorRole: string; audience: InternalNoteAudience; }
export interface OccurrencePhoto { id: string; kind: 'INITIAL' | 'RESOLUTION'; visibility: 'INTERNAL' | 'PUBLIC'; status: 'READY' | 'DELETED'; width: number; height: number; byteSize: number; createdAt: string; }
export interface PublicOccurrencePhoto { id: string; kind: 'RESOLUTION'; createdAt: string; width: number; height: number; }

export interface OccurrenceAttachmentMember {
  id: string;
  protocol: string;
  relation: 'PRIMARY' | AttachmentRelation;
}
export interface OccurrenceAttachmentGroup {
  primaryOccurrenceId: string;
  primaryProtocol: string;
  isPrimary: boolean;
  memberCount: number;
  members: OccurrenceAttachmentMember[];
}

export interface Occurrence {
  id: string;
  protocol: string;
  reportedLocation: LocationDetail;
  location: LocationDetail;
  reportedCategoryId: string;
  reportedCategoryName: string;
  categoryId: string;
  categoryName: string;
  description: string;
  immediateRisk: boolean;
  status: OccurrenceStatus;
  priority: OccurrencePriority;
  assignedTeamId?: string;
  assignedTeamNameSnapshot?: string;
  assignedToAdminUserId?: string;
  assignedToDisplayNameSnapshot?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  resolvedAt?: string;
  firstPublicResponseAt?: string;
  duplicateOfProtocol?: string;
  attachedToOccurrenceId?: string;
  attachedToProtocol?: string;
  attachmentRelation?: AttachmentRelation;
  attachmentReason?: string;
  attachedAt?: string;
  attachmentGroup?: OccurrenceAttachmentGroup;
  version: number;
  dataClassification: DataClassification;
  reopenedCount: number;
  sla?: OccurrenceSla;
  slaStatus?: SlaFilterStatus;
  totalOpenHours: number;
  effectiveBusinessHours: number;
  timeline: TimelineEvent[];
  publicMessages: PublicMessage[];
  internalNotes: InternalNote[];
  photos: OccurrencePhoto[];
}

export interface PublicOccurrence {
  protocol: string;
  category: string;
  location: PublicLocationDetail;
  description: string;
  immediateRisk: boolean;
  status: OccurrenceStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  resolvedAt?: string;
  duplicateOfProtocol?: string;
  categoryAdjusted: boolean;
  locationAdjusted: boolean;
  timeline: TimelineEvent[];
  publicMessages: PublicMessage[];
  photos: PublicOccurrencePhoto[];
}

export type OccurrenceSort = 'operational' | 'newest' | 'oldest' | 'priority' | 'sla' | 'protocol';
export interface OccurrenceFilterOptions {
  protocol?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  closedStartDate?: string;
  closedEndDate?: string;
  category?: string;
  areaId?: string;
  environmentId?: string;
  status?: OccurrenceStatus | 'TODAS';
  priority?: OccurrencePriority | 'TODAS';
  assignedTeamId?: string;
  assignedToAdminUserId?: string;
  immediateRisk?: 'true' | 'false';
  slaStatus?: SlaFilterStatus;
  withoutTeam?: boolean;
  withoutRouting?: boolean;
  criticalPriority?: boolean;
  awaitingAction?: boolean;
  withoutResponsible?: boolean;
  withPhoto?: boolean;
  withoutPhoto?: boolean;
  reopened?: boolean;
  reopenedStartDate?: string;
  reopenedEndDate?: string;
  dataClassification?: DataClassification;
  sort?: OccurrenceSort;
  pageSize?: 25 | 50 | 100;
  cursor?: string;
}

export interface CreateOccurrenceInput { location: LocationSelectionInput; categoryId: string; description: string; immediateRisk: boolean; }
export interface UpdateOccurrenceInput {
  expectedVersion: number;
  status?: OccurrenceStatus;
  priority?: OccurrencePriority;
  categoryId?: string;
  categoryChangeReason?: string;
  location?: LocationSelectionInput;
  locationChangeReason?: string;
  assignedTeamId?: string | null;
  assignedToAdminUserId?: string | null;
  newPublicMessage?: string;
  newInternalNote?: string;
  internalNoteAudience?: InternalNoteAudience;
  duplicateOfProtocol?: string | null;
  dataClassification?: DataClassification;
  attachmentTargetProtocol?: string | null;
  attachmentRelation?: AttachmentRelation;
  attachmentReason?: string;
  applyPublicMessageToAttached?: boolean;
}
export interface AddResolutionPhotosInput { expectedVersion: number; }
export interface UpdatePhotoVisibilityInput { expectedVersion: number; visibility: 'INTERNAL' | 'PUBLIC'; }
export interface DeletePhotoInput { expectedVersion: number; }
export interface CreateOccurrenceResponse { protocol: string; trackingKey: string; createdAt: string; }
export interface OccurrenceListResponse { items: Occurrence[]; limit: number; loadedCount: number; hasMore: boolean; nextCursor?: string; }

export interface DashboardStats {
  urgentOrEmergency: number;
  slaBreached: number;
  withoutRouting: number;
  inService: number;
  awaitingAction: number;
  resolvedRecently: number;
  receivedToday: number;
}
