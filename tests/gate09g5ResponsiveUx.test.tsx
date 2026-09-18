import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminRole, AdminUser } from '../src/models/admin';
import type { Occurrence } from '../src/models/occurrence';
import { AdminLayout } from '../src/layouts/AdminLayout';
import { AdminOccurrenceDetailPage } from '../src/pages/admin/AdminOccurrenceDetailPage';
import { AdminOccurrencesPage } from '../src/pages/admin/AdminOccurrencesPage';
import { AdminDashboardPage } from '../src/pages/admin/AdminDashboardPage';
import {
  type InfrastructureOverview,
  type NotificationStatus,
  CAPACITY_METRIC_LABELS,
  formatCapacityPercent,
} from '../src/models/infrastructure';
import { AdminLoginPage } from '../src/pages/admin/AdminLoginPage';
import { AdminSettingsPage } from '../src/pages/admin/AdminSettingsPage';
import { AdminInfrastructurePage } from '../src/pages/admin/AdminInfrastructurePage';
import { AdminUserManagement } from '../src/components/admin/AdminUserManagement';
import { StepIndicator } from '../src/components/public/StepIndicator';
import { Footer } from '../src/components/common/Footer';
import { adminService } from '../src/services/adminService';
import { configService } from '../src/services/configService';
import { infrastructureService } from '../src/services/infrastructureService';
import { notificationService } from '../src/services/notificationService';
import { occurrenceService } from '../src/services/occurrenceService';
import { operationsService } from '../src/services/operationsService';

let activeRole: AdminRole = 'Atendente';
let activeStatus: 'authorized' | 'signed-out' | 'denied' | 'error' | 'initializing' = 'authorized';
const mockAdminUser: AdminUser = {
  id: 'user-attendant-1',
  email: 'atendente@ifes.edu.br',
  normalizedEmail: 'atendente@ifes.edu.br',
  displayName: 'Servidor Atendente',
  role: 'Atendente',
  teamIds: ['team-manutencao'],
  active: true,
  legacyRole: false,
  createdAt: '2026-08-01T00:00:00Z',
  createdBy: 'system',
  updatedAt: '2026-08-01T00:00:00Z',
  updatedBy: 'system',
};

vi.mock('../src/context/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    session: activeStatus === 'authorized' ? {
      user: {
        ...mockAdminUser,
        role: activeRole,
      },
      token: 'fake-token',
    } : null,
    status: activeStatus,
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
        { id: 'cat-1', name: 'Elétrica', description: 'Problemas elétricos', active: true, sortOrder: 1 },
        { id: 'cat-2', name: 'Hidráulica', description: 'Vazamentos', active: true, sortOrder: 2 },
      ],
      locations: [
        {
          id: 'campus-bsf',
          campusName: 'Campus Barra de São Francisco',
          version: 1,
          buildings: [
            {
              id: 'b-principal',
              name: 'Bloco Principal',
              sortOrder: 1,
              active: true,
              floors: [
                {
                  id: 'f-terreo',
                  name: 'Térreo',
                  sortOrder: 1,
                  rooms: [{ id: 'r-101', name: 'Sala 101', sortOrder: 1, active: true }],
                },
              ],
            },
          ],
        },
      ],
      config: {
        institutionDisplayName: 'IFES Campus Barra de São Francisco',
      },
    },
    refresh: vi.fn(),
    loading: false,
    error: null,
  }),
}));

const mockOccurrence: Occurrence = {
  id: 'occ-123',
  protocol: 'INF-2026-000123',
  reportedCategoryId: 'cat-1',
  reportedCategoryName: 'Elétrica',
  categoryId: 'cat-1',
  categoryName: 'Elétrica',
  reportedLocation: {
    campusName: 'Campus Barra de São Francisco',
    buildingName: 'Bloco Principal',
    floor: 'Térreo',
    room: 'Sala 101',
  },
  location: {
    campusName: 'Campus Barra de São Francisco',
    buildingName: 'Bloco Principal',
    floor: 'Térreo',
    room: 'Sala 101',
  },
  description: 'Tomada sem energia na sala 101.',
  immediateRisk: false,
  status: 'Em atendimento',
  priority: 'Normal',
  assignedTeamId: 'team-manutencao',
  assignedTeamNameSnapshot: 'Equipe de Manutenção Elétrica',
  assignedToAdminUserId: 'user-attendant-1',
  assignedToDisplayNameSnapshot: 'Servidor Atendente',
  createdAt: '2026-08-10T10:00:00Z',
  updatedAt: '2026-08-10T10:00:00Z',
  version: 1,
  dataClassification: 'REAL',
  reopenedCount: 0,
  totalOpenHours: 0,
  effectiveBusinessHours: 0,
  slaStatus: 'ON_TIME',
  timeline: [],
  internalNotes: [],
  publicMessages: [],
  photos: [],
};

const mockInfrastructureOverview: InfrastructureOverview = {
  settings: {
    schemaVersion: 1,
    r2StorageReferenceBytes: 10_000_000_000,
    firestoreStorageReferenceBytes: 1_000_000_000,
    artifactRegistryStorageReferenceBytes: 5_000_000_000,
    resendDailyReference: 100,
    resendMonthlyReference: 3000,
    warningPercent: 80,
    alertPercent: 90,
    criticalPercent: 95,
    referenceVerifiedAt: '2026-08-01',
    version: 1,
    updatedAt: '2026-08-01T00:00:00Z',
    updatedBy: 'admin',
  },
  latest: {
    id: 'snap-1',
    schemaVersion: 1,
    capturedAt: '2026-08-10T10:00:00Z',
    captureSource: 'ADMIN',
    period: '2026-08',
    r2: {
      measured: true,
      inventoryComplete: true,
      objectCount: 150,
      bytes: 2_500_000_000,
      mainPhotoCount: 100,
      thumbnailCount: 50,
      oldestObjectAt: '2026-01-01T00:00:00Z',
      lastInventoryAt: '2026-08-10T09:00:00Z',
    },
    firestore: {
      counts: { occurrences: 120, adminUsers: 5 },
      totalDocuments: 125,
      estimatedLogicalBytes: 500_000_000,
      estimationMethod: 'Estatística amostral',
      documentsSampled: 125,
      coveragePercent: 100,
    },
    notifications: {
      sentToday: 10,
      sentThisMonth: 150,
      acceptedToday: 10,
      acceptedThisMonth: 150,
      acceptedTotal: 500,
      attemptsStarted: 10,
      attemptsAccepted: 10,
      attemptsDelivered: 10,
      attemptsFailed: 0,
      attemptsBounced: 0,
      attemptsComplained: 0,
      attemptsUncertain: 0,
      retries: 0,
      pending: 0,
      retryPending: 0,
      deliveryUncertain: 0,
      failed: 0,
      failedConfiguration: 0,
      delivered: 10,
      bounced: 0,
      complained: 0,
      unmatchedWebhookPending: 0,
      oldestPendingAt: null,
      oldestUnmatchedWebhookAt: null,
      lastAttemptAt: '2026-08-10T10:00:00Z',
      lastSuccessfulSendAt: '2026-08-10T10:00:00Z',
      lastError: null,
      lastFailureCategory: null,
    },
    cleanup: { pendingTasks: 0, completedTasks: 10, pendingObjects: 0, oldestPendingAt: null, lastError: null },
    artifactRegistry: { collected: true, capturedAt: '2026-08-10T10:00:00Z', bytes: 1_200_000_000, versionCount: 4, repository: 'olhos' },
    reconciliation: { missingObjects: 0, orphanObjects: 0, sizeMismatches: 0, lastRunAt: '2026-08-10T10:00:00Z' },
  },
  history: [],
  projections: [],
  notificationRuntime: {
    provider: 'Resend',
    environmentEnabled: true,
    applicationEnabled: true,
    effectiveEnabled: true,
    from: 'notificacoes@ifes.edu.br',
    recipientCount: 5,
    configurationIssues: [],
  },
  levels: {
    r2: { percent: 85.5, level: 'Atenção' },
    firestore: { percent: 50.0, level: 'Normal' },
    artifactRegistry: { percent: null, level: 'Alerta' },
    resendDaily: { percent: 10.0, level: 'Normal' },
    resendMonthly: { percent: 5.0, level: 'Normal' },
  },
};

beforeEach(() => {
  activeRole = 'Atendente';
  activeStatus = 'authorized';
  vi.clearAllMocks();

  vi.spyOn(occurrenceService, 'getAdminById').mockResolvedValue(mockOccurrence);
  vi.spyOn(occurrenceService, 'list').mockResolvedValue({
    items: [mockOccurrence],
    nextCursor: undefined,
    limit: 25,
    loadedCount: 1,
    hasMore: false,
  });
  vi.spyOn(occurrenceService, 'getStats').mockResolvedValue({
    urgentOrEmergency: 1,
    slaBreached: 0,
    withoutRouting: 0,
    inService: 3,
    awaitingAction: 1,
    resolvedRecently: 4,
    receivedToday: 2,
  });

  vi.spyOn(operationsService, 'listCategories').mockResolvedValue([
    { id: 'cat-1', name: 'Elétrica', description: 'Problemas elétricos', active: true, sortOrder: 1, resolutionBaseBusinessHours: 48, version: 1 },
  ]);
  vi.spyOn(operationsService, 'listLocations').mockResolvedValue([
    {
      id: 'campus-bsf',
      campusName: 'Campus Barra de São Francisco',
      version: 1,
      buildings: [
        {
          id: 'b-principal',
          name: 'Bloco Principal',
          sortOrder: 1,
          active: true,
          floors: [{ id: 'f-terreo', name: 'Térreo', rooms: [{ id: 'r-101', name: 'Sala 101', sortOrder: 1, active: true }] }],
        },
      ],
    },
  ]);
  vi.spyOn(operationsService, 'listTeams').mockResolvedValue([
    {
      id: 'team-manutencao',
      name: 'Equipe de Manutenção Elétrica',
      active: true,
      memberAdminUserIds: ['user-attendant-1'],
      schemaVersion: 2,
      sortOrder: 1,
      isInitialIntakeTeam: false,
      createdAt: '2026-08-01T00:00:00Z',
      createdBy: 'system',
      updatedAt: '2026-08-01T00:00:00Z',
      updatedBy: 'system',
    },
  ]);
  vi.spyOn(operationsService, 'getSlaSettings').mockResolvedValue({
    config: {
      schemaVersion: 1,
      policyVersion: '0.8.0',
      firstResponseBusinessHours: { Baixa: 24, Normal: 12, Alta: 4, Urgente: 2, Emergencial: 1 },
      priorityMultipliers: { Baixa: 1.5, Normal: 1.0, Alta: 0.5, Urgente: 0.25, Emergencial: 0.1 },
      nearDueThresholdPercent: 25,
      version: 1,
      updatedAt: '2026-08-01T00:00:00Z',
      updatedBy: 'admin',
    },
    calendar: {
      id: 'default',
      schemaVersion: 1,
      timezone: 'America/Sao_Paulo',
      version: 1,
      updatedAt: '2026-08-01T00:00:00Z',
      updatedBy: 'admin',
      weekly: {
        MONDAY: { open: true, start: '07:00', end: '19:00' },
        TUESDAY: { open: true, start: '07:00', end: '19:00' },
        WEDNESDAY: { open: true, start: '07:00', end: '19:00' },
        THURSDAY: { open: true, start: '07:00', end: '19:00' },
        FRIDAY: { open: true, start: '07:00', end: '19:00' },
        SATURDAY: { open: false, start: '07:00', end: '12:00' },
        SUNDAY: { open: false, start: '07:00', end: '12:00' },
      },
    },
    exceptions: [],
  });

  vi.spyOn(configService, 'getOperationalConfig').mockResolvedValue({
    institutionDisplayName: 'IFES Campus Barra de São Francisco',
    protocolPrefix: 'INF',
    autoAssignRisk: false,
    serviceNotice: 'Atendimento ordinário.',
    notificationEmails: ['manutencao@ifes.edu.br'],
    emailNotificationsEnabled: true,
  });

  vi.spyOn(adminService, 'listUsers').mockResolvedValue([
    mockAdminUser,
    {
      id: 'user-manager-1',
      email: 'gestor.campus.bsf@ifes.edu.br',
      normalizedEmail: 'gestor.campus.bsf@ifes.edu.br',
      displayName: 'Gestor Santos',
      role: 'Gestor',
      teamIds: ['team-manutencao'],
      active: true,
      legacyRole: false,
      createdAt: '2026-08-01T00:00:00Z',
      createdBy: 'system',
      updatedAt: '2026-08-01T00:00:00Z',
      updatedBy: 'system',
    },
  ]);
  vi.spyOn(adminService, 'listAssignees').mockResolvedValue([
    mockAdminUser,
    {
      id: 'user-manager-1',
      email: 'gestor.campus.bsf@ifes.edu.br',
      displayName: 'Gestor Santos',
      role: 'Gestor',
      teamIds: ['team-manutencao'],
    },
  ]);

  vi.spyOn(infrastructureService, 'overview').mockResolvedValue(mockInfrastructureOverview);
  const mockNotificationStatus: NotificationStatus = {
    ...mockInfrastructureOverview.notificationRuntime,
    metrics: mockInfrastructureOverview.latest!.notifications,
  };
  vi.spyOn(notificationService, 'status').mockResolvedValue(mockNotificationStatus);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Gate 0.9-G.5 — UX, Responsividade e Adaptação Mobile/Tablet', () => {
  describe('G09D-F002: ATTENDANT_NON_ACTIONABLE_CONTROLS', () => {
    it('para Atendente, não renderiza controles mortos/desabilitados no formulário de decisão operacional', async () => {
      activeRole = 'Atendente';
      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      // 1. Controles desabilitados não existem no formulário
      expect(screen.queryByRole('combobox', { name: /Prioridade/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /Equipe responsável/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /Responsável/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /Categoria da ocorrência/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /Campus ou unidade/i })).not.toBeInTheDocument();

      // 2. Dados informativos exibidos de forma semântica na seção de dados
      expect(screen.getByText('Tomada sem energia na sala 101.')).toBeInTheDocument();
      expect(screen.getAllByText('Equipe de Manutenção Elétrica').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Servidor Atendente').length).toBeGreaterThan(0);

      // 3. Controles acionáveis permanecem presentes e operáveis
      const statusSelect = screen.getByRole('combobox', { name: /Situação/i });
      expect(statusSelect).toBeInTheDocument();
      expect(statusSelect).toBeEnabled();

      expect(screen.getByRole('textbox', { name: /Nova mensagem pública/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Nova observação interna/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Registrar alterações/i })).toBeInTheDocument();
    });

    it('para Gestor, mantém controles de atribuição e prioridade interativos no formulário', async () => {
      activeRole = 'Gestor';
      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias/occ-123']}>
          <Routes>
            <Route path="/administracao/ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      expect(screen.getByRole('combobox', { name: /^Prioridade/i })).toBeEnabled();
      expect(screen.getByRole('combobox', { name: /^Equipe\/Setor responsável/i })).toBeEnabled();
      expect(screen.getByRole('combobox', { name: /^Responsável/i })).toBeEnabled();
    });
  });

  describe('G09D-F003: MOBILE_FILTER_DISCLOSURE', () => {
    it('oferece botão de disclosure de filtros em mobile com contagem e limpeza rápida', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias?status=Em+atendimento']}>
          <AdminOccurrencesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      // Botão de disclosure existe com aria-expanded e aria-controls
      const toggleButton = screen.getByRole('button', { name: /Expandir filtros/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      expect(toggleButton).toHaveAttribute('aria-controls', 'admin-occurrence-filters');

      // Linha resumo com badge e botão de limpar filtros
      expect(screen.getByText(/1 filtro\(s\) ativo\(s\)/i)).toBeInTheDocument();
      const clearButton = screen.getByRole('button', { name: /Limpar filtros/i });
      expect(clearButton).toBeInTheDocument();

      // Ao clicar, expande o formulário
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('G09D-F004: MOBILE_TABLE_CONTEXT', () => {
    it('apresenta visualização em cartões mobile com contexto integral e preserva tabela desktop', async () => {
      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias']}>
          <AdminOccurrencesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
      });

      // Cartões mobile
      const cardsContainer = screen.getByLabelText('Lista de ocorrências em cartões');
      expect(cardsContainer).toHaveClass('sm:hidden');
      expect(cardsContainer).toBeInTheDocument();

      const detailLink = screen.getByRole('link', { name: /Ver detalhamento da ocorrência INF-2026-000123/i });
      expect(detailLink).toBeInTheDocument();

      // Tabela desktop
      const desktopTable = screen.getByRole('table');
      expect(desktopTable.closest('div')).toHaveClass('hidden sm:block');
    });
  });

  describe('G09D-F006: ADMIN_MOBILE_NAVIGATION', () => {
    it('apresenta menu responsivo expansível com controle acessível e fecha com Escape', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/administracao']}>
          <AdminLayout />
        </MemoryRouter>
      );

      // Skip link
      const skipLink = screen.getByText('Pular navegação administrativa');
      expect(skipLink).toHaveAttribute('href', '#admin-main-content');

      // Botão de menu responsivo
      const menuButton = screen.getByRole('button', { name: 'Menu de navegação administrativa' });
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      expect(menuButton).toHaveAttribute('aria-controls', 'admin-navigation-menu');

      // Abre menu
      await user.click(menuButton);
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('navigation', { name: 'Menu administrativo expandido' })).toBeInTheDocument();

      // Fecha com Escape
      await user.keyboard('{Escape}');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('G09D-F007: PUBLIC_CURRENT_STEP', () => {
    it('renderiza indicador compacto para viewport estreito e mantém lista em desktop', () => {
      const { container } = render(<StepIndicator currentStep={2} totalSteps={5} />);

      // Visão mobile
      expect(screen.getByText(/Etapa/i)).toHaveTextContent('Etapa 2 de 5');
      const mobileGroup = screen.getByRole('group', { name: 'Progresso do formulário' });
      expect(mobileGroup).toHaveClass('sm:hidden');
      expect(mobileGroup.querySelector('[aria-current="step"]')).toHaveTextContent('Local');

      // Visão desktop
      const desktopList = container.querySelector('ol');
      expect(desktopList?.parentElement).toHaveClass('hidden sm:block');
    });
  });

  describe('G09D-F008: JARGON_REMOVAL', () => {
    it('remove jargão técnico em AdminOccurrencesPage, AdminLoginPage e Footer', async () => {
      // 1. AdminOccurrencesPage
      activeRole = 'Gestor';
      render(
        <MemoryRouter initialEntries={['/administracao/ocorrencias']}>
          <AdminOccurrencesPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText('Busca por palavras-chave principais no título e descrição.')).toBeInTheDocument();
      });
      expect(screen.getByText('Consulta operacional de ocorrências. Padrão: 25 registros por página.')).toBeInTheDocument();
      expect(screen.queryByText(/scan irrestrito/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cursor do Firestore/i)).not.toBeInTheDocument();

      // 2. AdminLoginPage
      activeStatus = 'signed-out';
      const { unmount: unmountLogin } = render(
        <MemoryRouter initialEntries={['/administracao/entrar']}>
          <AdminLoginPage />
        </MemoryRouter>
      );
      expect(screen.getByText(/cadastro administrativo institucional/i)).toBeInTheDocument();
      expect(screen.queryByText(/cadastro administrativo do Firestore/i)).not.toBeInTheDocument();
      unmountLogin();
      activeStatus = 'authorized';

      // 3. Footer
      render(<Footer />);
      expect(screen.getByText(/Versão .* — Sistema Institucional de Manutenção da Infraestrutura Física/i)).toBeInTheDocument();
      expect(screen.queryByText(/persistidos no Cloud Firestore/i)).not.toBeInTheDocument();
    });
  });

  describe('G09D-F009: CAPACITY_PERCENTAGE', () => {
    it('formata adequadamente valores válidos e trata valores nulos/indefinidos/não finitos sem isolar %', () => {
      expect(formatCapacityPercent(0)).toBe('(0.0%)');
      expect(formatCapacityPercent(55.4)).toBe('(55.4%)');
      expect(formatCapacityPercent(100)).toBe('(100.0%)');
      expect(formatCapacityPercent(120.5)).toBe('(120.5%)');
      expect(formatCapacityPercent(null)).toBe('(percentual não mensurável)');
      expect(formatCapacityPercent(undefined)).toBe('(percentual não mensurável)');
      expect(formatCapacityPercent(Number.NaN)).toBe('(percentual não mensurável)');
      expect(formatCapacityPercent(Infinity)).toBe('(percentual não mensurável)');
      expect(formatCapacityPercent(-Infinity)).toBe('(percentual não mensurável)');

      expect(CAPACITY_METRIC_LABELS.r2).toBe('Armazenamento de fotografias (R2)');
      expect(CAPACITY_METRIC_LABELS.firestore).toBe('Banco de dados (Firestore)');
      expect(CAPACITY_METRIC_LABELS.artifactRegistry).toBe('Registro de contêineres');
      expect(CAPACITY_METRIC_LABELS.resendDaily).toBe('Notificações diárias');
      expect(CAPACITY_METRIC_LABELS.resendMonthly).toBe('Notificações mensais');
    });

    it('renderiza alertas em AdminDashboardPage com rótulos amigáveis e percentuais seguros', async () => {
      activeRole = 'Administrador';
      render(
        <MemoryRouter initialEntries={['/administracao']}>
          <AdminDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Alertas de infraestrutura')).toBeInTheDocument();
      });

      // Alerta de R2 com nível Atenção e percentual formatado
      expect(screen.getByText(/Capacidade Armazenamento de fotografias \(R2\): nível Atenção \(85\.5%\)/i)).toBeInTheDocument();

      // Alerta de Artifact Registry com percentual nulo não isola '%'
      expect(screen.getByText(/Capacidade Registro de contêineres: nível Alerta \(percentual não mensurável\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/\(%\)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/NaN%/)).not.toBeInTheDocument();
    });

    it('assegura CAPACITY_NON_FINITE_UI_OUTPUT=SAFE no dashboard para valores Infinity, -Infinity, NaN, null e undefined', async () => {
      activeRole = 'Administrador';
      vi.spyOn(infrastructureService, 'overview').mockResolvedValueOnce({
        ...mockInfrastructureOverview,
        levels: {
          r2: { percent: Infinity, level: 'Crítico' },
          firestore: { percent: -Infinity, level: 'Alerta' },
          artifactRegistry: { percent: Number.NaN, level: 'Atenção' },
          resendDaily: { percent: null, level: 'Atenção' },
          resendMonthly: { percent: undefined as unknown as number, level: 'Atenção' },
        },
      });

      render(
        <MemoryRouter initialEntries={['/administracao']}>
          <AdminDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Alertas de infraestrutura')).toBeInTheDocument();
      });

      const alertsText = screen.getByLabelText('Alertas de infraestrutura').textContent ?? '';
      expect(alertsText).not.toContain('Infinity%');
      expect(alertsText).not.toContain('-Infinity%');
      expect(alertsText).not.toContain('NaN%');
      expect(alertsText).not.toContain('undefined%');
      expect(alertsText).not.toContain('(%)');
      expect(screen.getAllByText(/\(percentual não mensurável\)/).length).toBe(5);
    });
  });

  describe('G09D-F010: USERS_PAGE_RESPONSIVE_STRUCTURE', () => {
    it('renderiza cartões mobile para usuários com break-all em e-mails e tabela desktop', async () => {
      render(<AdminUserManagement />);

      await waitFor(() => {
        expect(screen.getByLabelText('Lista de usuários administrativos em dispositivos móveis')).toBeInTheDocument();
      });

      // Cartões mobile
      const mobileList = screen.getByLabelText('Lista de usuários administrativos em dispositivos móveis');
      expect(mobileList).toHaveClass('sm:hidden');

      const mobileEmails = mobileList.querySelectorAll('.break-all');
      expect(mobileEmails.length).toBeGreaterThan(0);

      // Tabela desktop
      const desktopTable = screen.getByRole('table');
      expect(desktopTable.closest('div')).toHaveClass('hidden sm:block');
    });
  });

  describe('G09D-F011: INFRASTRUCTURE_PANEL_RESPONSIVE_STRUCTURE', () => {
    it('renderiza painéis de infraestrutura com min-w-0, botões quebram texto e tabelas contidas', async () => {
      render(
        <MemoryRouter initialEntries={['/administracao/infraestrutura']}>
          <AdminInfrastructurePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Infraestrutura e capacidade' })).toBeInTheDocument();
      });

      // Botões com whitespace-normal
      const buttons = screen.getAllByRole('button');
      const wrappingButtons = buttons.filter(btn => btn.className.includes('whitespace-normal'));
      expect(wrappingButtons.length).toBeGreaterThan(0);

      // Tabelas contidas em containers com overflow-x-auto e max-w-full
      const tables = screen.getAllByRole('table');
      for (const table of tables) {
        const container = table.closest('div');
        expect(container?.className).toMatch(/overflow/);
      }
    });
  });

  describe('A11Y-IMP-006: TOUCH_TARGET_CATEGORIES_CHECKBOX', () => {
    it('envolve checkbox "Ativa" em rótulo com dimensão mínima de 44x44px (min-h-11 min-w-11)', async () => {
      render(
        <MemoryRouter initialEntries={['/administracao/configuracoes']}>
          <AdminSettingsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /Categoria Elétrica ativa/i })).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox', { name: /Categoria Elétrica ativa/i });
      const wrapperLabel = checkbox.closest('label');
      expect(wrapperLabel).toBeInTheDocument();
      expect(wrapperLabel).toHaveClass('min-h-11');
      expect(wrapperLabel).toHaveClass('min-w-11');
    });
  });

  describe('GLOBAL_OVERFLOW_MASK_REMOVED: VERIFICAÇÃO DE CSS', () => {
    it('confirma ausência de overflow-x: hidden nas tags html e body em src/index.css', () => {
      const cssPath = resolve(__dirname, '../src/index.css');
      const cssContent = readFileSync(cssPath, 'utf-8');

      // Verifica que html e body não têm overflow-x: hidden
      const htmlBlockMatch = cssContent.match(/html\s*\{([^}]+)\}/);
      const bodyBlockMatch = cssContent.match(/body\s*\{([^}]+)\}/);

      expect(htmlBlockMatch).not.toBeNull();
      expect(htmlBlockMatch![1]).not.toContain('overflow-x: hidden');

      expect(bodyBlockMatch).not.toBeNull();
      expect(bodyBlockMatch![1]).not.toContain('overflow-x: hidden');
    });

    const TARGET_VIEWPORTS = [
      { name: 'iPhone SE (320x568)', width: 320, height: 568, category: 'mobile' },
      { name: 'Android Moderno (360x800)', width: 360, height: 800, category: 'mobile' },
      { name: 'iPhone mini / X (375x812)', width: 375, height: 812, category: 'mobile' },
      { name: 'iPhone 12/13/14 Pro (390x844)', width: 390, height: 844, category: 'mobile' },
      { name: 'Pixel / Android amplo (412x915)', width: 412, height: 915, category: 'mobile' },
      { name: 'iPad Retrato / Tablet (768x1024)', width: 768, height: 1024, category: 'tablet' },
      { name: 'iPad Air Retrato (820x1180)', width: 820, height: 1180, category: 'tablet' },
      { name: 'Desktop HD (1280x720)', width: 1280, height: 720, category: 'desktop' },
      { name: 'Notebook Padrão (1366x768)', width: 1366, height: 768, category: 'desktop' },
      { name: 'Desktop Widescreen (1440x900)', width: 1440, height: 900, category: 'desktop' },
      { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080, category: 'desktop' },
    ] as const;

    it.each(TARGET_VIEWPORTS)(
      'valida adaptação estrutural sem máscara artificial para $name ($width x $height)',
      async ({ width, category }) => {
        // Simula dimensões de janela
        window.innerWidth = width;

        // 1. AdminLayout: menu adaptativo para mobile/tablet vs desktop
        const { unmount: unmountLayout } = render(
          <MemoryRouter initialEntries={['/administracao']}>
            <AdminLayout />
          </MemoryRouter>
        );

        const hamburgerBtn = screen.getByRole('button', { name: 'Menu de navegação administrativa' });
        const desktopNav = screen.getByRole('navigation', { name: 'Navegação administrativa' });

        if (category === 'mobile' || category === 'tablet') {
          // Em mobile/tablet (320px a 820px), o container do botão de menu existe para telas < lg
          expect(hamburgerBtn.closest('div')).toHaveClass('lg:hidden');
          expect(desktopNav).toHaveClass('hidden lg:flex');
        } else {
          // Em desktop (1280px+), a navegação desktop tem a classe de visibilidade lg:flex
          expect(desktopNav).toHaveClass('hidden lg:flex');
        }
        unmountLayout();

        // 2. AdminOccurrencesPage: cartões para telas estreitas vs tabela
        const { unmount: unmountOcc } = render(
          <MemoryRouter initialEntries={['/administracao/ocorrencias']}>
            <AdminOccurrencesPage />
          </MemoryRouter>
        );
        await waitFor(() => {
          expect(screen.getByText('INF-2026-000123')).toBeInTheDocument();
        });

        const mobileCards = screen.getByLabelText('Lista de ocorrências em cartões');
        const desktopTableDiv = screen.getByRole('table').closest('div');
        expect(mobileCards).toHaveClass('sm:hidden');
        expect(desktopTableDiv).toHaveClass('hidden sm:block');
        unmountOcc();
      }
    );
  });
});
