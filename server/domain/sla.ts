import type { CategoryItem } from '../../src/models/config';
import type { SlaConfiguration } from '../../src/models/operations';
import type { OccurrencePriority, OccurrenceStatus, SlaFilterStatus } from '../../src/models/occurrence';
import type { StoredOccurrenceSla } from '../models/occurrenceDomain';
import type { BusinessTimePolicy } from './businessTime';
import { addBusinessMinutes, businessMinutesBetween } from './businessTime';

const PAUSED = new Set<OccurrenceStatus>(['Aguardando material','Aguardando contratação ou serviço externo']);
const TERMINAL = new Set<OccurrenceStatus>(['Resolvida','Não procedente','Duplicada','Cancelada']);
export function isSlaPaused(status: OccurrenceStatus): boolean { return PAUSED.has(status); }
export function isTerminalStatus(status: OccurrenceStatus): boolean { return TERMINAL.has(status); }

export function createSlaSnapshot(createdAt: Date, priority: OccurrencePriority, category: CategoryItem, config: SlaConfiguration, policy: BusinessTimePolicy): StoredOccurrenceSla {
  const firstMinutes = Math.round(config.firstResponseBusinessHours[priority]*60);
  const baseMinutes = Math.round(category.resolutionBaseBusinessHours*60);
  const multiplier = config.priorityMultipliers[priority];
  const target = Math.round(baseMinutes*multiplier);
  const due = addBusinessMinutes(createdAt,target,policy);
  const nearThresholdMinutes = Math.max(1,Math.round(target*(config.nearDueThresholdPercent/100)));
  return {
    schemaVersion: 1, policyVersion: config.policyVersion,
    firstResponseTargetBusinessMinutes: firstMinutes,
    firstResponseDueAt: addBusinessMinutes(createdAt,firstMinutes,policy),
    resolutionBaseBusinessMinutes: baseMinutes, priorityMultiplier: multiplier,
    resolutionTargetBusinessMinutes: target, resolutionDueAt: due,
    resolutionNearDueAt: addBusinessMinutes(createdAt,Math.max(0,target-nearThresholdMinutes),policy),
    resolutionPaused: false, accumulatedPausedBusinessMinutes: 0, calendarSnapshotId: `${policy.calendar.id}:v${policy.calendar.version}`,
    calendarSnapshot: structuredClone(policy),
  };
}

export function recalculateResolutionSla(sla: StoredOccurrenceSla, createdAt: Date, now: Date, priority: OccurrencePriority, category: CategoryItem, config: SlaConfiguration, policy: BusinessTimePolicy): StoredOccurrenceSla {
  const base = Math.round(category.resolutionBaseBusinessHours*60);
  const multiplier = config.priorityMultipliers[priority];
  const target = Math.round(base*multiplier);
  const historicalPaused = sla.accumulatedPausedBusinessMinutes;
  const ongoingPaused = sla.resolutionPaused && sla.resolutionPauseStartedAt !== undefined
    ? businessMinutesBetween(sla.resolutionPauseStartedAt, now, policy)
    : 0;
  const pausedToDate = historicalPaused + ongoingPaused;
  const baseDue = addBusinessMinutes(createdAt,target,policy);
  const due = addBusinessMinutes(baseDue,pausedToDate,policy);
  const nearMinutes = Math.max(1,Math.round(target*(config.nearDueThresholdPercent/100)));
  const nearBase = addBusinessMinutes(createdAt,Math.max(0,target-nearMinutes),policy);
  const recalculated: StoredOccurrenceSla = { ...sla, policyVersion: `${sla.policyVersion}|recalc:${config.policyVersion}`, resolutionBaseBusinessMinutes: base,
    priorityMultiplier: multiplier, resolutionTargetBusinessMinutes: target, resolutionDueAt: due,
    resolutionNearDueAt: addBusinessMinutes(nearBase,pausedToDate,policy) };
  if (recalculated.completedAt !== undefined) {
    const elapsed = effectiveResolutionMinutes(createdAt,recalculated.completedAt,recalculated,policy);
    recalculated.resolutionOutcome = elapsed <= target ? 'ON_TIME' : 'BREACHED';
  }
  return recalculated;
}

export function recalculateFirstResponseBeforeResponse(sla: StoredOccurrenceSla, createdAt: Date, priority: OccurrencePriority, config: SlaConfiguration, policy: BusinessTimePolicy): StoredOccurrenceSla {
  if (sla.firstResponseAt !== undefined) return sla;
  const minutes = Math.round(config.firstResponseBusinessHours[priority]*60);
  return { ...sla, firstResponseTargetBusinessMinutes: minutes, firstResponseDueAt: addBusinessMinutes(createdAt,minutes,policy) };
}

export function markFirstPublicResponse(sla: StoredOccurrenceSla, at: Date): StoredOccurrenceSla {
  if (sla.firstResponseAt !== undefined) return sla;
  return { ...sla, firstResponseAt: at, firstResponseOutcome: at <= sla.firstResponseDueAt ? 'ON_TIME' : 'BREACHED' };
}

export function pauseSla(sla: StoredOccurrenceSla, at: Date): StoredOccurrenceSla {
  if (sla.resolutionPaused) return sla;
  return { ...sla, resolutionPaused: true, resolutionPauseStartedAt: at };
}

export function resumeSla(sla: StoredOccurrenceSla, at: Date, policy: BusinessTimePolicy): StoredOccurrenceSla {
  if (!sla.resolutionPaused || sla.resolutionPauseStartedAt === undefined) return sla;
  const paused = businessMinutesBetween(sla.resolutionPauseStartedAt,at,policy);
  return { ...sla, resolutionPaused: false, resolutionPauseStartedAt: undefined,
    accumulatedPausedBusinessMinutes: sla.accumulatedPausedBusinessMinutes+paused,
    resolutionDueAt: addBusinessMinutes(sla.resolutionDueAt,paused,policy),
    resolutionNearDueAt: addBusinessMinutes(sla.resolutionNearDueAt,paused,policy),
  };
}

export function completeSla(sla: StoredOccurrenceSla, createdAt: Date, at: Date, policy: BusinessTimePolicy): StoredOccurrenceSla {
  const resumed = sla.resolutionPaused ? resumeSla(sla,at,policy) : sla;
  const elapsed = effectiveResolutionMinutes(createdAt,at,resumed,policy);
  return { ...resumed, completedAt: at, resolutionOutcome: elapsed <= resumed.resolutionTargetBusinessMinutes ? 'ON_TIME' : 'BREACHED' };
}

export function reopenSla(sla: StoredOccurrenceSla, at: Date, policy: BusinessTimePolicy): StoredOccurrenceSla {
  if (sla.completedAt === undefined) {
    return { ...sla, completedAt: undefined, resolutionOutcome: undefined, resolutionPaused: false, resolutionPauseStartedAt: undefined };
  }
  const stoppedBusinessMinutes = businessMinutesBetween(sla.completedAt, at, policy);
  return {
    ...sla,
    completedAt: undefined,
    resolutionOutcome: undefined,
    resolutionPaused: false,
    resolutionPauseStartedAt: undefined,
    accumulatedPausedBusinessMinutes: sla.accumulatedPausedBusinessMinutes + stoppedBusinessMinutes,
    resolutionDueAt: addBusinessMinutes(sla.resolutionDueAt, stoppedBusinessMinutes, policy),
    resolutionNearDueAt: addBusinessMinutes(sla.resolutionNearDueAt, stoppedBusinessMinutes, policy),
  };
}

export function effectiveResolutionMinutes(createdAt: Date, now: Date, sla: StoredOccurrenceSla, policy: BusinessTimePolicy): number {
  const until = sla.completedAt ?? now;
  let total = businessMinutesBetween(createdAt,until,policy)-sla.accumulatedPausedBusinessMinutes;
  if (sla.resolutionPaused && sla.resolutionPauseStartedAt !== undefined) total -= businessMinutesBetween(sla.resolutionPauseStartedAt,until,policy);
  return Math.max(0,total);
}

export function calculateSlaFilterStatus(status: OccurrenceStatus, sla: StoredOccurrenceSla, now: Date): SlaFilterStatus {
  if (isTerminalStatus(status) || sla.completedAt !== undefined) return 'COMPLETED';
  if (sla.resolutionPaused) return 'PAUSED';
  if (now > sla.resolutionDueAt) return 'BREACHED';
  if (now >= sla.resolutionNearDueAt) return 'NEAR_DUE';
  return 'ON_TIME';
}

export function policyForSla(sla: StoredOccurrenceSla | undefined, fallback: BusinessTimePolicy): BusinessTimePolicy {
  return sla?.calendarSnapshot === undefined ? fallback : structuredClone(sla.calendarSnapshot);
}
