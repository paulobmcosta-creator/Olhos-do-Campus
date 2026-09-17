import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AdminRole, AdminSession } from '../src/models/admin';
import type { Occurrence } from '../src/models/occurrence';
import { AdminOccurrencesPage } from '../src/pages/admin/AdminOccurrencesPage';
import { AdminOccurrenceDetailPage } from '../src/pages/admin/AdminOccurrenceDetailPage';
import { adminService } from '../src/services/adminService';
import { operationsService } from '../src/services/operationsService';
import { occurrenceService } from '../src/services/occurrenceService';

let activeRole: AdminRole = 'Atendente';

function makeSession(role: AdminRole): AdminSession {
  return {
    user: {
      id: 'attendant-user-id',
      uid: 'attendant-uid',
      email: 'atendente@ifes.edu.br',
      displayName: 'Atendente Silva',
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
      categories: [
        { id: 'cat-1', name: 'Elétrica', active: true, sortOrder: 1 },
      ],
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

const mockOccurrence: Occurrence = {
  id: 'occ-123',
  version: 1,
  protocol: 'INF-2026-000123',
  status: 'Em atendimento',
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
  description: 'Lâmpada piscando continuamente.',
  immediateRisk: false,
  assignedTeamId: 'team-manutencao',
  assignedTeamNameSnapshot: 'Equipe de Manutenção Elétrica',
  assignedToAdminUserId: 'attendant-user-id',
  assignedToDisplayNameSnapshot: 'Atendente Silva Operacional',
  dataClassification: 'REAL',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-10T10:00:00.000Z',
  reopenedCount: 0,
  totalOpenHours: 5.5,
  effectiveBusinessHours: 4.0,
  timeline: [],
  publicMessages: [],
  internalNotes: [],
  photos: [],
};

describe('G09B-F004 — Menor Privilégio no Frontend: Chamadas a listAssignees() e Fluxo de Atendente', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(operationsService, 'listTeams').mockResolvedValue([
      {
        id: 'team-manutencao',
        name: 'Equipe de Manutenção Elétrica',
        active: true,
        schemaVersion: 2,
        sortOrder: 1,
        isInitialIntakeTeam: false,
        memberAdminUserIds: ['attendant-user-id'],
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

    vi.spyOn(occurrenceService, 'list').mockResolvedValue({
      items: [mockOccurrence],
      nextCursor: undefined,
      limit: 25,
      loadedCount: 1,
      hasMore: false,
    });

    vi.spyOn(occurrenceService, 'getAdminById').mockResolvedValue(mockOccurrence);
    vi.spyOn(occurrenceService, 'update').mockResolvedValue({
      ...mockOccurrence,
      version: 2,
      status: 'Aguardando material',
    });

    vi.spyOn(adminService, 'listAssignees').mockResolvedValue([
      {
        id: 'attendant-user-id',
        email: 'atendente@ifes.edu.br',
        displayName: 'Atendente Silva',
        role: 'Atendente',
        teamIds: ['team-manutencao'],
      },
      {
        id: 'manager-user-id',
        email: 'gestor@ifes.edu.br',
        displayName: 'Gestor Santos',
        role: 'Gestor',
        teamIds: ['team-manutencao'],
      },
    ]);
  });

  describe('AdminOccurrencesPage', () => {
    it('Com Atendente: listAssignees() CALLED = NO e filtro de responsável oculto', async () => {
      activeRole = 'Atendente';
      const assigneesSpy = vi.spyOn(adminService, 'listAssignees');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias']}>
          <AdminOccurrencesPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      expect(assigneesSpy).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
    });

    it('Com Gestor: listAssignees() CALLED = YES e filtro de responsável disponível', async () => {
      activeRole = 'Gestor';
      const assigneesSpy = vi.spyOn(adminService, 'listAssignees');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias']}>
          <AdminOccurrencesPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      expect(assigneesSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('Responsável')).toBeInTheDocument();
    });

    it('Com Administrador: listAssignees() CALLED = YES e filtro de responsável disponível', async () => {
      activeRole = 'Administrador';
      const assigneesSpy = vi.spyOn(adminService, 'listAssignees');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias']}>
          <AdminOccurrencesPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      expect(assigneesSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('Responsável')).toBeInTheDocument();
    });
  });

  describe('AdminOccurrenceDetailPage', () => {
    it('Com Atendente: listAssignees() CALLED = NO, dados do responsável exibidos via snapshot e formulário preservado', async () => {
      activeRole = 'Atendente';
      const assigneesSpy = vi.spyOn(adminService, 'listAssignees');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      // listAssignees() não pode ser chamado
      expect(assigneesSpy).not.toHaveBeenCalled();

      // Dados legítimos da ocorrência (snapshots) são exibidos corretamente
      expect(screen.getAllByText('Atendente Silva Operacional').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Equipe de Manutenção Elétrica').length).toBeGreaterThan(0);

      // Gate 0.9-G.5 (G09D-F002): Atendente não possui <select disabled> morto no formulário de decisão operacional;
      // o responsável é exibido semanticamente nos detalhes da ocorrência e não há controle de formulário para Atendente.
      expect(screen.queryByRole('combobox', { name: /Responsável/i })).not.toBeInTheDocument();
      expect(screen.getByText('Responsável')).toBeInTheDocument();
    });

    it('Com Gestor: listAssignees() CALLED = YES em AdminOccurrenceDetailPage', async () => {
      activeRole = 'Gestor';
      const assigneesSpy = vi.spyOn(adminService, 'listAssignees');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      expect(assigneesSpy).toHaveBeenCalledTimes(1);
    });

    it('Com Administrador: listAssignees() CALLED = YES em AdminOccurrenceDetailPage', async () => {
      activeRole = 'Administrador';
      const assigneesSpy = vi.spyOn(adminService, 'listAssignees');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      expect(assigneesSpy).toHaveBeenCalledTimes(1);
    });

    it('Fluxo de Atendente: realiza transição de status autorizada sem bloqueio por falta de assignees globais', async () => {
      activeRole = 'Atendente';
      const updateSpy = vi.spyOn(occurrenceService, 'update');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      // Seleciona uma situação válida permitida para Atendente em 'Em atendimento' -> 'Aguardando material'
      const statusSelect = screen.getByLabelText('Situação');
      fireEvent.change(statusSelect, { target: { value: 'Aguardando material' } });

      // Clica em registrar alterações submetendo o formulário
      const saveButton = screen.getByRole('button', { name: /Registrar alterações/i });
      const form = saveButton.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'occ-123',
          expect.objectContaining({
            status: 'Aguardando material',
            expectedVersion: 1,
          }),
        );
      });

      // Mensagem de sucesso deve ser exibida sem erro
      expect(await screen.findByText(/Alterações registradas. Versão atual: 2./i)).toBeInTheDocument();
    });

    it('Fluxo de Atendente: adiciona observação interna com audiência RESPONSIBLE_TEAM sem erros', async () => {
      activeRole = 'Atendente';
      const updateSpy = vi.spyOn(occurrenceService, 'update');

      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      // Digita observação interna
      const noteInput = screen.getByLabelText(/Nova observação interna/i);
      fireEvent.change(noteInput, { target: { value: 'Material requisitado ao almoxarifado.' } });

      // Clica em salvar
      const saveButton = screen.getByRole('button', { name: /Registrar alterações/i });
      fireEvent.submit(saveButton.closest('form')!);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'occ-123',
          expect.objectContaining({
            newInternalNote: 'Material requisitado ao almoxarifado.',
            internalNoteAudience: 'RESPONSIBLE_TEAM',
            expectedVersion: 1,
          }),
        );
      });
    });
  });
});
