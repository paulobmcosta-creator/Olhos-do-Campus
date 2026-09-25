import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AdminRole, AdminSession } from '../src/models/admin';
import { OCCURRENCE_STATUSES, type Occurrence } from '../src/models/occurrence';
import { AdminOccurrenceDetailPage } from '../src/pages/admin/AdminOccurrenceDetailPage';
import { ApiError } from '../src/services/apiClient';
import { adminService } from '../src/services/adminService';
import { operationsService } from '../src/services/operationsService';
import { occurrenceService } from '../src/services/occurrenceService';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

let activeRole: AdminRole = 'Gestor';

function makeSession(role: AdminRole): AdminSession {
  return {
    user: {
      id: 'manager-user-id',
      uid: 'manager-uid',
      email: 'gestor@ifes.edu.br',
      displayName: 'Gestor Teste',
      role,
      teamIds: ['team-manutencao'],
      active: true,
    },
  };
}

const sessionCache: Record<AdminRole, AdminSession> = {
  Atendente: makeSession('Atendente'),
  Gestor: makeSession('Gestor'),
  Administrador: makeSession('Administrador'),
};

vi.mock('../src/context/AdminAuthContext', () => ({
  AdminAuthProvider: ({ children }: { children: ReactNode }) => children,
  useAdminAuth: () => ({
    session: sessionCache[activeRole],
    status: 'authorized',
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    retryAuthorization: vi.fn(),
  }),
}));

vi.mock('../src/context/AppDataContext', () => ({
  useAppData: () => ({
    data: {
      categories: [{ id: 'cat-1', name: 'Elétrica', active: true, sortOrder: 1 }],
      locations: [
        {
          id: 'campus-1',
          campusName: 'Campus Barra de São Francisco',
          buildings: [
            {
              id: 'b-1',
              name: 'Bloco Principal',
              active: true,
              sortOrder: 1,
              floors: [
                {
                  id: 'f-1',
                  name: 'Térreo',
                  rooms: [{ id: 'r-1', name: 'Sala 101', active: true, sortOrder: 1 }],
                },
              ],
            },
          ],
        },
      ],
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

const sampleOccurrence: Occurrence = {
  id: 'occ-test-g3',
  version: 1,
  protocol: 'INF-2026-000999',
  status: 'Recebida',
  priority: 'Normal',
  categoryId: 'cat-1',
  categoryName: 'Elétrica',
  reportedCategoryName: 'Elétrica',
  location: {
    campusId: 'campus-1',
    campusName: 'Campus Barra de São Francisco',
    buildingId: 'b-1',
    buildingName: 'Bloco Principal',
    floorId: 'f-1',
    floor: 'Térreo',
    roomId: 'r-1',
    room: 'Sala 101',
  },
  reportedLocation: {
    campusName: 'Campus Barra de São Francisco',
    buildingName: 'Bloco Principal',
    floor: 'Térreo',
    room: 'Sala 101',
  },
  reportedCategoryId: 'cat-1',
  description: 'Problema na tomada da sala.',
  immediateRisk: false,
  dataClassification: 'REAL',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-10T10:00:00.000Z',
  reopenedCount: 0,
  totalOpenHours: 1.0,
  effectiveBusinessHours: 1.0,
  timeline: [],
  publicMessages: [],
  internalNotes: [],
  photos: [],
};

describe('Situações livres e conflito de concorrência', () => {
  describe('Validação no Backend', () => {
    it('FREE_TRANSITION_BACKEND_TEST — permite salto direto de Recebida para Resolvida', async () => {
      const { service, manager } = makeOccurrenceServiceFixture();
      await service.create(createInput, 'c0');
      const occurrence = (await service.list({}, manager)).items[0]!;

      expect(occurrence.status).toBe('Recebida');
      const updated = await service.update(
        occurrence.id,
        { expectedVersion: occurrence.version, status: 'Resolvida' },
        manager,
        'c-free-transition',
      );

      expect(updated.status).toBe('Resolvida');
      expect(updated.resolvedAt).toBeDefined();
    });

    it('CONCURRENCY_BACKEND_TEST — rejeita versão obsoleta com HTTP 409 e código CONFLICT', async () => {
      const { service, manager } = makeOccurrenceServiceFixture();
      await service.create(createInput, 'c0');
      const original = (await service.list({}, manager)).items[0]!;

      // Primeira mutação avança a versão de 1 para 2
      await service.update(
        original.id,
        { expectedVersion: original.version, priority: 'Alta' },
        manager,
        'c-first-mutation',
      );

      // Segunda mutação tenta salvar com base na versão 1 original obsoleta
      let thrownError: unknown;
      try {
        await service.update(
          original.id,
          { expectedVersion: original.version, newInternalNote: 'Nota concorrente.' },
          manager,
          'c-stale-mutation',
        );
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError).toMatchObject({
        status: 409,
        code: 'CONFLICT',
      });

      const message = (thrownError as Error).message;
      expect(message).toMatch(/atualizada por outra operação|atualizada por outro usuário/i);
      expect(message).not.toContain('INVALID_STATUS_TRANSITION');
    });
  });

  describe('Validação no Frontend (AdminOccurrenceDetailPage)', () => {
    let getAdminByIdSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      activeRole = 'Gestor';
      vi.restoreAllMocks();

      getAdminByIdSpy = vi.spyOn(occurrenceService, 'getAdminById').mockResolvedValue(sampleOccurrence);
      vi.spyOn(operationsService, 'listTeams').mockResolvedValue([
        {
          id: 'team-manutencao',
          name: 'Equipe de Manutenção Elétrica',
          active: true,
          schemaVersion: 2,
          sortOrder: 1,
          isInitialIntakeTeam: false,
          memberAdminUserIds: ['manager-user-id'],
          createdAt: '2026-08-10T00:00:00.000Z',
          createdBy: 'test',
          updatedAt: '2026-08-10T00:00:00.000Z',
          updatedBy: 'test',
        },
      ]);
      vi.spyOn(operationsService, 'listCategories').mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Elétrica',
          description: 'Reparos elétricos',
          active: true,
          sortOrder: 1,
          resolutionBaseBusinessHours: 48,
          version: 1,
        },
      ]);
      vi.spyOn(operationsService, 'listLocations').mockResolvedValue([
        {
          id: 'campus-1',
          campusName: 'Campus Barra de São Francisco',
          buildings: [
            {
              id: 'b-1',
              name: 'Bloco Principal',
              active: true,
              sortOrder: 1,
              floors: [
                {
                  id: 'f-1',
                  name: 'Térreo',
                  rooms: [{ id: 'r-1', name: 'Sala 101', active: true, sortOrder: 1 }],
                },
              ],
            },
          ],
        },
      ]);
      vi.spyOn(adminService, 'listAssignees').mockResolvedValue([]);
    });

    it('FREE_TRANSITION_FRONTEND_TEST — Atendente visualiza todas as situações ativas e não visualiza Duplicada', async () => {
      activeRole = 'Atendente';

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-test-g3']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000999')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Situação') as HTMLSelectElement;
      const values = Array.from(statusSelect.options).map((option) => option.value);
      expect(values).toEqual([...OCCURRENCE_STATUSES]);
      expect(values).not.toContain('Duplicada');
      expect(values).toContain('Em atendimento');
      expect(values).toContain('Resolvida');
    });

    it('CONCURRENCY_FRONTEND_TEST — exibe mensagem de concorrência e executa recarregamento dos dados', async () => {
      const updateSpy = vi.spyOn(occurrenceService, 'update').mockRejectedValueOnce(
        new ApiError(
          'Esta ocorrência foi atualizada por outra operação. Recarregue os dados e tente novamente.',
          409,
          'CONFLICT',
        ),
      );

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-test-g3']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000999')).toBeInTheDocument();
      });

      // Digita uma observação interna
      const noteInput = screen.getByLabelText(/Nova observação interna/i);
      fireEvent.change(noteInput, { target: { value: 'Observação concorrente.' } });

      const saveButton = screen.getByRole('button', { name: /Registrar alterações/i });
      fireEvent.submit(saveButton.closest('form')!);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });

      // Mensagem de concorrência deve ser exibida
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Esta ocorrência foi atualizada por outra operação/i);

      // Deve ter recarregado a ocorrência (chamou getAdminById uma 2ª vez)
      await waitFor(() => {
        expect(getAdminByIdSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
