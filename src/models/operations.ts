import type { OccurrencePriority, OccurrenceStatus } from './occurrence';

export interface OperationalTeam {
  id: string;
  schemaVersion: 1;
  name: string;
  description?: string;
  active: boolean;
  sortOrder: number;
  memberAdminUserIds: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TeamCreateInput {
  name: string;
  description?: string;
  active?: boolean;
  sortOrder: number;
  memberAdminUserIds?: string[];
}
export type TeamUpdateInput = Partial<TeamCreateInput>;

export const WEEKDAY_KEYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export interface ServiceDaySchedule { open: boolean; start: string; end: string; }
export type WeeklySchedule = Record<WeekdayKey, ServiceDaySchedule>;

export interface ServiceCalendar {
  id: 'default';
  schemaVersion: 1;
  timezone: 'America/Sao_Paulo';
  weekly: WeeklySchedule;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export const CALENDAR_EXCEPTION_TYPES = ['FERIADO','RECESSO','SUSPENSAO','HORARIO_ESPECIAL'] as const;
export type CalendarExceptionType = (typeof CALENDAR_EXCEPTION_TYPES)[number];
export interface ServiceCalendarException {
  id: string;
  schemaVersion: 1;
  date: string;
  type: CalendarExceptionType;
  label: string;
  closed: boolean;
  start?: string;
  end?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SlaConfiguration {
  schemaVersion: 1;
  policyVersion: string;
  firstResponseBusinessHours: Record<OccurrencePriority, number>;
  priorityMultipliers: Record<OccurrencePriority, number>;
  nearDueThresholdPercent: number;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  areaId?: string;
  environmentId?: string;
  priority?: OccurrencePriority;
  status?: OccurrenceStatus;
  teamId?: string;
  responsibleId?: string;
}

export interface NamedMetric { name: string; value: number; }
export interface AnalyticsStats {
  period: { start: string; end: string };
  openNow: number;
  createdInPeriod: number;
  urgentOrEmergency: number;
  slaBreached: number;
  withoutTeam: number;
  withoutResponsible: number;
  resolvedInPeriod: number;
  closedInPeriod: number;
  reopenedInPeriod: number;
  averageFirstResponseBusinessHours: number | null;
  medianFirstResponseBusinessHours: number | null;
  averageTotalClosureHours: number | null;
  medianTotalClosureHours: number | null;
  averageEffectiveBusinessHours: number | null;
  medianEffectiveBusinessHours: number | null;
  firstResponseOnTimePercent: number | null;
  resolutionOnTimePercent: number | null;
  byCategory: NamedMetric[];
  byStatus: NamedMetric[];
  byPriority: NamedMetric[];
  byArea: NamedMetric[];
  byTeam: NamedMetric[];
  byResponsible: NamedMetric[];
  unavailableMetrics: string[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
