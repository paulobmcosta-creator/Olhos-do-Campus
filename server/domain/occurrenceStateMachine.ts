import type { AdminRole } from '../../src/models/admin';
import {
  OCCURRENCE_STATUSES,
  OCCURRENCE_STATUS_VALUES,
  TERMINAL_OCCURRENCE_STATUSES,
  isActiveOccurrenceStatus,
  type ActiveOccurrenceStatus,
  type OccurrenceStatus,
} from '../../src/models/occurrence';
import { HttpError } from '../types/errors';

export const FINAL_OCCURRENCE_STATUSES = new Set<OccurrenceStatus>(TERMINAL_OCCURRENCE_STATUSES);

export function isReopeningTransition(from: OccurrenceStatus, to: OccurrenceStatus): boolean {
  return from !== to && FINAL_OCCURRENCE_STATUSES.has(from) && !FINAL_OCCURRENCE_STATUSES.has(to);
}

export function canTransitionOccurrence(from: OccurrenceStatus, to: OccurrenceStatus, role: AdminRole): boolean {
  void role;
  return from === to || isActiveOccurrenceStatus(to);
}

export function assertOccurrenceTransition(from: OccurrenceStatus, to: OccurrenceStatus, role: AdminRole): void {
  if (canTransitionOccurrence(from, to, role)) return;
  throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `A situação “${to}” não está disponível para novas alterações operacionais.`);
}

export function transitionMatrix(_role?: AdminRole): Readonly<Record<OccurrenceStatus, readonly ActiveOccurrenceStatus[]>> {
  return Object.fromEntries(
    OCCURRENCE_STATUS_VALUES.map((from) => [
      from,
      OCCURRENCE_STATUSES.filter((to) => to !== from),
    ]),
  ) as Readonly<Record<OccurrenceStatus, readonly ActiveOccurrenceStatus[]>>;
}
