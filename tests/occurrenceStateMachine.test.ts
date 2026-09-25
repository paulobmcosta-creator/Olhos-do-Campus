import { describe, expect, it } from 'vitest';
import type { AdminRole } from '../src/models/admin';
import {
  OCCURRENCE_STATUSES,
  OCCURRENCE_STATUS_VALUES,
  TERMINAL_OCCURRENCE_STATUSES,
  type OccurrenceStatus,
} from '../src/models/occurrence';
import {
  assertOccurrenceTransition,
  canTransitionOccurrence,
  isReopeningTransition,
  transitionMatrix,
} from '../server/domain/occurrenceStateMachine';

const ROLES: AdminRole[] = ['Administrador', 'Gestor', 'Atendente'];
const FINAL = new Set<OccurrenceStatus>(TERMINAL_OCCURRENCE_STATUSES);

describe('situações operacionais livres', () => {
  it('permite qualquer destino ativo para todos os papéis', () => {
    for (const from of OCCURRENCE_STATUS_VALUES) {
      for (const to of OCCURRENCE_STATUSES) {
        for (const role of ROLES) {
          expect(canTransitionOccurrence(from, to, role), `${role}: ${from} → ${to}`).toBe(true);
          expect(() => assertOccurrenceTransition(from, to, role)).not.toThrow();
        }
      }
    }
  });

  it('retira Duplicada das situações ativas sem perder compatibilidade de leitura', () => {
    expect(OCCURRENCE_STATUSES).not.toContain('Duplicada');
    expect(OCCURRENCE_STATUS_VALUES).toContain('Duplicada');
    for (const role of ROLES) {
      expect(canTransitionOccurrence('Recebida', 'Duplicada', role)).toBe(false);
      expect(() => assertOccurrenceTransition('Recebida', 'Duplicada', role)).toThrow(/não está disponível/iu);
    }
  });

  it('considera reabertura qualquer saída de situação final para situação não final', () => {
    const nonFinal = OCCURRENCE_STATUSES.filter((status) => !FINAL.has(status));
    for (const from of TERMINAL_OCCURRENCE_STATUSES) {
      for (const to of nonFinal) {
        expect(isReopeningTransition(from, to)).toBe(true);
      }
      for (const to of TERMINAL_OCCURRENCE_STATUSES) {
        expect(isReopeningTransition(from, to)).toBe(false);
      }
    }
  });

  it('matriz declarativa contém todos os estados de origem e todos os destinos ativos possíveis', () => {
    const matrix = transitionMatrix();
    expect(Object.keys(matrix).sort()).toEqual([...OCCURRENCE_STATUS_VALUES].sort());
    for (const from of OCCURRENCE_STATUS_VALUES) {
      const expected = OCCURRENCE_STATUSES.filter((to) => to !== from);
      expect(matrix[from]).toEqual(expected);
    }
  });
});
