import { describe, expect, it } from 'vitest';
import type { AdminRole } from '../src/models/admin';
import { OCCURRENCE_STATUSES, type OccurrenceStatus } from '../src/models/occurrence';
import { assertOccurrenceTransition, canTransitionOccurrence, transitionMatrix } from '../server/domain/occurrenceStateMachine';

const EXPECTED: Readonly<Record<OccurrenceStatus, readonly OccurrenceStatus[]>> = {
  'Recebida': ['Em triagem', 'Cancelada'],
  'Em triagem': ['Em análise', 'Não procedente', 'Duplicada', 'Cancelada'],
  'Em análise': ['Encaminhada ao setor responsável', 'Em atendimento', 'Aguardando material', 'Aguardando contratação ou serviço externo', 'Não procedente', 'Duplicada', 'Cancelada'],
  'Encaminhada ao setor responsável': ['Em análise', 'Em atendimento', 'Aguardando material', 'Aguardando contratação ou serviço externo', 'Cancelada'],
  'Em atendimento': ['Em análise', 'Aguardando material', 'Aguardando contratação ou serviço externo', 'Resolvida', 'Não procedente', 'Cancelada'],
  'Aguardando material': ['Encaminhada ao setor responsável', 'Em atendimento', 'Aguardando contratação ou serviço externo', 'Cancelada'],
  'Aguardando contratação ou serviço externo': ['Encaminhada ao setor responsável', 'Em atendimento', 'Aguardando material', 'Cancelada'],
  'Resolvida': [],
  'Não procedente': [],
  'Duplicada': [],
  'Cancelada': [],
};
const FINAL = new Set<OccurrenceStatus>(['Resolvida', 'Não procedente', 'Duplicada', 'Cancelada']);
const ROLES: AdminRole[] = ['Administrador', 'Gestor'];

describe('máquina formal de estados', () => {
  it('preserva fluxo principal conservador', () => {
    const main = ['Recebida', 'Em triagem', 'Em análise', 'Encaminhada ao setor responsável', 'Em atendimento', 'Resolvida'] as const;
    for (let index = 0; index < main.length - 1; index += 1) expect(canTransitionOccurrence(main[index]!, main[index + 1]!, 'Gestor')).toBe(true);
  });

  it('rejeita saltos arbitrários e alteração silenciosa de estado final', () => {
    expect(canTransitionOccurrence('Recebida', 'Resolvida', 'Administrador')).toBe(false);
    expect(() => assertOccurrenceTransition('Resolvida', 'Em atendimento', 'Administrador')).toThrow(/reabertas/iu);
  });

  it('reabertura é explícita para Administrador ou Gestor e volta para Em análise', () => {
    for (const finalStatus of FINAL) {
      expect(canTransitionOccurrence(finalStatus, 'Em análise', 'Administrador')).toBe(true);
      expect(canTransitionOccurrence(finalStatus, 'Em análise', 'Gestor')).toBe(true);
    }
  });

  it('valida exaustivamente toda combinação origem × destino × papel', () => {
    for (const from of OCCURRENCE_STATUSES) {
      for (const to of OCCURRENCE_STATUSES) {
        for (const role of ROLES) {
          const expected = from === to
            || (FINAL.has(from) && to === 'Em análise' && (role === 'Administrador' || role === 'Gestor'))
            || (!FINAL.has(from) && EXPECTED[from].includes(to));
          expect(canTransitionOccurrence(from, to, role), `${role}: ${from} → ${to}`).toBe(expected);
        }
      }
    }
  });

  it('matriz declara exatamente todos os estados e destinos previstos', () => {
    expect(transitionMatrix()).toEqual(EXPECTED);
    expect(Object.keys(transitionMatrix()).sort()).toEqual([...OCCURRENCE_STATUSES].sort());
  });
});
