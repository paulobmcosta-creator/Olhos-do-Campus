export const ADMIN_ROLES = ['Administrador', 'Gestor', 'Atendente'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const LEGACY_ADMIN_ROLES = ['Atendente'] as const;
export type LegacyAdminRole = (typeof LEGACY_ADMIN_ROLES)[number];
export type StoredAdminRole = AdminRole | LegacyAdminRole;

export function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLES.some((role) => role === value);
}

export function isLegacyAdminRole(value: string): value is LegacyAdminRole {
  return LEGACY_ADMIN_ROLES.some((role) => role === value);
}

export interface AdminUser {
  id: string;
  email: string;
  normalizedEmail: string;
  uid?: string;
  displayName: string;
  role: StoredAdminRole;
  department?: string;
  teamIds: string[];
  active: boolean;
  legacyRole: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  lastAuthorizedLoginAt?: string;
}

export interface AuthorizedAdminProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  department?: string;
  teamIds: string[];
  active: true;
  lastAuthorizedLoginAt?: string;
}

export interface AdminSession { user: AuthorizedAdminProfile; }

export interface AdminAssignee {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  teamIds: string[];
}

export interface AdminUserCreateInput {
  email: string;
  displayName: string;
  role: AdminRole;
  teamIds?: string[];
  active?: boolean;
}

export interface AdminUserUpdateInput {
  displayName?: string;
  role?: AdminRole;
  teamIds?: string[];
  active?: boolean;
}

export interface LegacyAdminResolutionInput {
  action: 'CONVERT_TO_MANAGER' | 'DEACTIVATE' | 'ACTIVATE_AS_ATTENDANT';
}

export const AUDIT_EVENT_TYPES = [
  'ADMIN_LOGIN_AUTHORIZED', 'ADMIN_LOGIN_DENIED', 'ADMIN_USER_CREATED', 'ADMIN_USER_UPDATED',
  'ADMIN_USER_ACTIVATED', 'ADMIN_USER_DEACTIVATED', 'ADMIN_ROLE_CHANGED', 'ADMIN_UID_BOUND',
  'LEGACY_ADMIN_ROLE_RESOLVED', 'LAST_ADMIN_CHANGE_BLOCKED', 'SYSTEM_CONFIG_UPDATED',
  'OCCURRENCE_STATUS_CHANGED', 'OCCURRENCE_CATEGORY_CHANGED', 'OCCURRENCE_LOCATION_CHANGED',
  'OCCURRENCE_PRIORITY_CHANGED', 'OCCURRENCE_TEAM_CHANGED', 'OCCURRENCE_RESPONSIBLE_CHANGED',
  'OCCURRENCE_TEAM_ROUTED', 'OCCURRENCE_RESPONSIBLE_ASSIGNED',
  'OCCURRENCE_DATA_CLASSIFICATION_CHANGED', 'OCCURRENCE_ATTACHED', 'OCCURRENCE_DETACHED',
  'OCCURRENCE_REOPENED', 'OCCURRENCE_RESOLVED', 'OCCURRENCE_CLOSED', 'PUBLIC_MESSAGE_ADDED',
  'INTERNAL_NOTE_ADDED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'CATEGORY_DEACTIVATED',
  'LOCATION_CREATED', 'LOCATION_UPDATED', 'LOCATION_DEACTIVATED', 'LOCATION_REACTIVATED', 'LOCATION_DELETED',
  'TEAM_CREATED', 'TEAM_UPDATED', 'TEAM_DEACTIVATED', 'TEAM_INITIAL_INTAKE_CHANGED', 'SLA_CONFIG_UPDATED', 'SERVICE_CALENDAR_UPDATED',
  'SERVICE_CALENDAR_EXCEPTION_CREATED', 'SERVICE_CALENDAR_EXCEPTION_UPDATED',
  'SERVICE_CALENDAR_EXCEPTION_DELETED', 'TEST_OCCURRENCE_DELETED', 'REPORT_EXPORTED',
  'NOTIFICATION_SETTINGS_CHANGED', 'NOTIFICATION_TEST_REQUESTED', 'NOTIFICATION_RETRY_REQUESTED',
  'INFRASTRUCTURE_SETTINGS_CHANGED', 'INFRASTRUCTURE_SNAPSHOT_REQUESTED', 'FIRESTORE_ESTIMATE_REQUESTED',
  'STORAGE_RECONCILIATION_REQUESTED', 'STORAGE_CLEANUP_REQUESTED',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type AuditTargetType = 'adminUser' | 'adminSession' | 'security' | 'systemConfig' | 'occurrence' | 'category' | 'location' | 'team' | 'sla' | 'calendar' | 'report' | 'notification' | 'infrastructure' | 'storage';

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: AdminRole;
  targetType: AuditTargetType;
  targetId?: string;
  timestamp: string;
  summary: string;
  requestCorrelationId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AuditLogFilters {
  actor?: string;
  eventType?: AuditEventType;
  occurrenceId?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  limit?: 25 | 50 | 100;
  cursor?: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  limit: number;
  nextCursor?: string;
  hasMore: boolean;
}
