import type { AdminRole } from '../../src/models/admin';
import type { OccurrenceStatus } from '../../src/models/occurrence';
import { HttpError } from '../types/errors';

export const FINAL_OCCURRENCE_STATUSES = new Set<OccurrenceStatus>([
  'Resolvida',
  'Não procedente',
  'Duplicada',
  'Cancelada',
]);

const TRANSITIONS: Readonly<Record<OccurrenceStatus, readonly OccurrenceStatus[]>> = {
  'Recebida': ['Em triagem', 'Cancelada'],
  'Em triagem': ['Em análise', 'Não procedente', 'Duplicada', 'Cancelada'],
  'Em análise': [
    'Encaminhada ao setor responsável',
    'Em atendimento',
    'Aguardando material',
    'Aguardando contratação ou serviço externo',
    'Não procedente',
    'Duplicada',
    'Cancelada',
  ],
  'Encaminhada ao setor responsável': [
    'Em análise',
    'Em atendimento',
    'Aguardando material',
    'Aguardando contratação ou serviço externo',
    'Cancelada',
  ],
  'Em atendimento': [
    'Em análise',
    'Aguardando material',
    'Aguardando contratação ou serviço externo',
    'Resolvida',
    'Não procedente',
    'Cancelada',
  ],
  'Aguardando material': [
    'Encaminhada ao setor responsável',
    'Em atendimento',
    'Aguardando contratação ou serviço externo',
    'Cancelada',
  ],
  'Aguardando contratação ou serviço externo': [
    'Encaminhada ao setor responsável',
    'Em atendimento',
    'Aguardando material',
    'Cancelada',
  ],
  'Resolvida': [],
  'Não procedente': [],
  'Duplicada': [],
  'Cancelada': [],
};

const ATTENDANT_TRANSITIONS: Readonly<Record<OccurrenceStatus, readonly OccurrenceStatus[]>> = {
  'Recebida': [],
  'Em triagem': [],
  'Em análise': ['Em atendimento'],
  'Encaminhada ao setor responsável': ['Em atendimento'],
  'Em atendimento': ['Aguardando material', 'Aguardando contratação ou serviço externo', 'Resolvida'],
  'Aguardando material': ['Em atendimento'],
  'Aguardando contratação ou serviço externo': ['Em atendimento'],
  'Resolvida': [],
  'Não procedente': [],
  'Duplicada': [],
  'Cancelada': [],
};

export function isReopeningTransition(from: OccurrenceStatus, to: OccurrenceStatus): boolean {
  return FINAL_OCCURRENCE_STATUSES.has(from) && to === 'Em análise';
}

export function canTransitionOccurrence(from: OccurrenceStatus, to: OccurrenceStatus, role: AdminRole): boolean {
  if (from === to) return true;
  if (role === 'Atendente') {
    return (ATTENDANT_TRANSITIONS[from] ?? []).includes(to);
  }
  if (isReopeningTransition(from, to)) return role === 'Administrador' || role === 'Gestor';
  return TRANSITIONS[from].includes(to);
}

export function assertOccurrenceTransition(from: OccurrenceStatus, to: OccurrenceStatus, role: AdminRole): void {
  if (canTransitionOccurrence(from, to, role)) return;
  if (role === 'Atendente') {
    throw new HttpError(403, 'FORBIDDEN', `O perfil Atendente não possui permissão para transitar de “${from}” para “${to}”.`);
  }
  if (FINAL_OCCURRENCE_STATUSES.has(from)) {
    throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Ocorrências finalizadas somente podem ser reabertas explicitamente por Administrador ou Gestor para Em análise.');
  }
  throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `A transição de “${from}” para “${to}” não é permitida pelo fluxo institucional.`);
}

export function transitionMatrix(role?: AdminRole): Readonly<Record<OccurrenceStatus, readonly OccurrenceStatus[]>> {
  if (role === 'Atendente') return ATTENDANT_TRANSITIONS;
  return TRANSITIONS;
}

