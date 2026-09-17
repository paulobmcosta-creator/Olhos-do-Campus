import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Occurrence } from '../src/models/occurrence';
import { AdminPhotoGallery } from '../src/components/photos/AdminPhotoGallery';
import { PublicSolutionPhotoGallery } from '../src/components/photos/PublicSolutionPhotoGallery';
import { NewOccurrencePage } from '../src/pages/NewOccurrencePage';
import { AdminSettingsPage } from '../src/pages/admin/AdminSettingsPage';

let sequence = 0;

beforeEach(() => {
  sequence = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:a11y-test-${++sequence}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

vi.mock('../src/services/occurrenceService', () => ({
  occurrenceService: {
    getAdminPhoto: vi.fn(() => Promise.resolve(new Blob([new Uint8Array([1])], { type: 'image/webp' }))),
    getPublicPhoto: vi.fn(() => Promise.resolve(new Blob([new Uint8Array([1])], { type: 'image/webp' }))),
    addResolutionPhotos: vi.fn(),
    updatePhotoVisibility: vi.fn(),
    deletePhoto: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/services/operationsService', () => ({
  operationsService: {
    listCategories: vi.fn(() => Promise.resolve([
      { id: 'cat-1', name: 'Iluminação', description: 'Problemas com lâmpadas e luminárias', active: true, sortOrder: 1, resolutionBaseBusinessHours: 72 },
      { id: 'cat-2', name: 'Hidráulica', description: 'Problemas de encanamento', active: true, sortOrder: 2, resolutionBaseBusinessHours: 48 },
    ])),
    listLocations: vi.fn(() => Promise.resolve([
      {
        id: 'campus-bsf',
        campusName: 'Campus Barra de São Francisco',
        version: 1,
        buildings: [
          {
            id: 'b-adm',
            name: 'Bloco Administrativo',
            sortOrder: 1,
            active: true,
            floors: [
              {
                id: 'f-terreo',
                name: 'Térreo',
                sortOrder: 1,
                rooms: [
                  { id: 'r-101', name: 'Sala 101', sortOrder: 1, active: true },
                ],
              },
            ],
          },
        ],
      },
    ])),
    getSlaSettings: vi.fn(() => Promise.resolve({
      config: {
        id: 'default',
        policyVersion: '0.8.0-policy-1',
        firstResponseBusinessHours: { BAIXA: 24, MEDIA: 12, ALTA: 4, CRITICA: 2 },
        priorityMultipliers: { BAIXA: 1.5, MEDIA: 1.0, ALTA: 0.5, CRITICA: 0.25 },
        nearDueThresholdPercent: 25,
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
      exceptions: [
        { id: 'exc-1', date: '2026-12-25', label: 'Natal', type: 'FERIADO', closed: true },
      ],
    })),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    addArea: vi.fn(),
    updateArea: vi.fn(),
    deleteArea: vi.fn(),
    addEnvironment: vi.fn(),
    updateEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    updateSla: vi.fn(),
    updateCalendar: vi.fn(),
    upsertException: vi.fn(),
    deleteException: vi.fn(),
  },
}));

vi.mock('../src/services/configService', () => ({
  configService: {
    getOperationalConfig: vi.fn(() => Promise.resolve({
      id: 'default',
      institutionDisplayName: 'IFES Campus Barra de São Francisco',
      protocolPrefix: 'INF',
      autoAssignRisk: false,
      serviceNotice: 'Atendimento em dias úteis.',
      notificationEmails: ['manutencao@ifes.edu.br'],
      emailNotificationsEnabled: true,
      updatedAt: '2026-08-01T00:00:00Z',
      updatedBy: 'admin',
    })),
    updateConfig: vi.fn(),
  },
}));

vi.mock('../src/services/notificationService', () => ({
  notificationService: {
    status: vi.fn(() => Promise.resolve({
      provider: 'Resend',
      effectiveEnabled: true,
      from: 'notificacoes@ifes.edu.br',
      configurationIssues: [],
      metrics: { deliveryUncertain: 0, failedConfiguration: 0, lastFailureCategory: null },
    })),
    test: vi.fn(),
  },
}));

vi.mock('../src/context/AppDataContext', () => ({
  useAppData: () => ({
    data: {
      categories: [
        { id: 'cat-1', name: 'Iluminação', description: 'Lâmpadas e luminárias', active: true, sortOrder: 1 },
        { id: 'cat-2', name: 'Hidráulica', description: 'Vazamentos e tubulações', active: true, sortOrder: 2 },
      ],
      locations: [
        {
          id: 'campus-bsf',
          campusName: 'Campus Barra de São Francisco',
          buildings: [
            {
              id: 'b-adm',
              name: 'Bloco Administrativo',
              active: true,
              sortOrder: 1,
              floors: [
                {
                  id: 'f-terreo',
                  name: 'Térreo',
                  rooms: [
                    { id: 'r-101', name: 'Sala 101', active: true, sortOrder: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    refresh: vi.fn(),
    loading: false,
    error: null,
  }),
}));

const testOccurrence: Occurrence = {
  id: 'occ-a11y',
  protocol: 'INF-2026-000001',
  reportedCategoryId: 'cat-1',
  reportedCategoryName: 'Iluminação',
  categoryId: 'cat-1',
  categoryName: 'Iluminação',
  reportedLocation: { campusName: 'Campus Barra de São Francisco', buildingName: 'Bloco Administrativo', floor: 'Térreo', room: 'Sala 101' },
  location: { campusName: 'Campus Barra de São Francisco', buildingName: 'Bloco Administrativo', floor: 'Térreo', room: 'Sala 101' },
  description: 'Lâmpada piscando na sala de aula.',
  immediateRisk: false,
  status: 'Em atendimento',
  priority: 'Normal',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
  version: 1,
  dataClassification: 'REAL',
  reopenedCount: 0,
  totalOpenHours: 0,
  effectiveBusinessHours: 0,
  timeline: [],
  publicMessages: [],
  internalNotes: [],
  photos: [
    {
      id: 'photo-1',
      kind: 'INITIAL',
      visibility: 'INTERNAL',
      status: 'READY',
      width: 800,
      height: 600,
      byteSize: 5000,
      createdAt: '2026-09-01T10:00:00Z',
    },
  ],
};

describe('GATE 0.9-G.4 — Acessibilidade WCAG 2.2 AA', () => {
  describe('G09E-F001 — Gerenciamento e Confinamento de Foco no Modal', () => {
    it('MODAL_INITIAL_FOCUS, MODAL_FOCUS_TRAP, MODAL_ESCAPE e MODAL_RETURN_FOCUS', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <button id="outside-button" type="button">Botão Externo</button>
          <AdminPhotoGallery occurrence={testOccurrence} role="Gestor" onOccurrenceUpdated={vi.fn()} />
        </div>
      );

      // Localiza o botão que abre o modal
      const openTrigger = await screen.findByRole('button', {
        name: /abrir fotografia 1 de fotografias do registro em tamanho maior/i,
      });

      // 1. Posiciona o foco no botão acionador
      openTrigger.focus();
      expect(document.activeElement).toBe(openTrigger);

      // 2. Abre o modal
      await user.click(openTrigger);

      const dialog = await screen.findByRole('dialog', { name: 'Visualização ampliada da fotografia' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      // 3. MODAL_INITIAL_FOCUS: o foco inicial deve ser posicionado no botão Fechar
      const closeButton = screen.getByRole('button', { name: /fechar/i });
      await waitFor(() => {
        expect(document.activeElement).toBe(closeButton);
      });

      // 4. MODAL_FOCUS_TRAP: Tab e Shift+Tab confinam o foco dentro do diálogo
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);

      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);

      // 5. MODAL_ESCAPE: Tecla Escape fecha o modal sem efeitos destrutivos
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // 6. MODAL_RETURN_FOCUS: Foco deve retornar exatamente ao elemento que abriu o modal
      await waitFor(() => {
        expect(document.activeElement).toBe(openTrigger);
      });
    });

    it('Galeria pública da solução também confina foco e devolve ao trigger', async () => {
      const user = userEvent.setup();
      const photos = [
        { id: 'sol-1', kind: 'RESOLUTION' as const, width: 800, height: 600, createdAt: '2026-09-01T10:00:00Z' },
      ];

      render(
        <div>
          <PublicSolutionPhotoGallery photos={photos} protocol="INF-2026-000001" trackingKey="CHAVE-1234" />
        </div>
      );

      const openButton = await screen.findByRole('button', { name: /ampliar fotografia pública da solução 1/i });
      openButton.focus();
      expect(document.activeElement).toBe(openButton);

      await user.click(openButton);

      const dialog = await screen.findByRole('dialog', { name: 'Fotografia pública ampliada da solução' });
      expect(dialog).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /fechar/i });
      await waitFor(() => {
        expect(document.activeElement).toBe(closeButton);
      });

      // Fecha via botão fechar
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(openButton);
      });
    });
  });

  describe('G09E-F002 — File Input: Foco Visível e Operabilidade por Teclado', () => {
    it('FILE_UPLOAD_KEYBOARD_OPERABLE e FILE_UPLOAD_FOCUS_VISIBLE no formulário público', async () => {
      render(
        <MemoryRouter>
          <NewOccurrencePage />
        </MemoryRouter>
      );

      const cameraInput = screen.getByLabelText('Tirar fotografia da ocorrência');
      const galleryInput = screen.getByLabelText('Selecionar fotografia da galeria para a ocorrência');

      expect(cameraInput).toBeInTheDocument();
      expect(galleryInput).toBeInTheDocument();

      // Confirma que os contêineres visíveis (labels) contêm estilização de foco visível
      const cameraLabel = cameraInput.closest('label');
      const galleryLabel = galleryInput.closest('label');

      expect(cameraLabel?.className).toContain('has-[:focus-visible]:outline');
      expect(galleryLabel?.className).toContain('has-[:focus-visible]:outline');

      // Testa operabilidade por teclado (receber foco)
      cameraInput.focus();
      expect(document.activeElement).toBe(cameraInput);

      galleryInput.focus();
      expect(document.activeElement).toBe(galleryInput);
    });

    it('FILE_UPLOAD_FOCUS_VISIBLE na galeria administrativa', async () => {
      render(
        <AdminPhotoGallery occurrence={testOccurrence} role="Gestor" onOccurrenceUpdated={vi.fn()} />
      );

      const uploadInput = screen.getByLabelText('Selecionar fotografias da solução');
      expect(uploadInput).toBeInTheDocument();

      const uploadLabel = uploadInput.closest('label');
      expect(uploadLabel?.className).toContain('has-[:focus-visible]:outline');

      uploadInput.focus();
      expect(document.activeElement).toBe(uploadInput);
    });
  });

  describe('G09E-F003 — Configurações Administrativas e SLA: Nomes Acessíveis', () => {
    it('SETTINGS_CONTROL_ACCESSIBLE_NAMES em todos os controles de SLA e Configurações', async () => {
      render(
        <MemoryRouter>
          <AdminSettingsPage />
        </MemoryRouter>
      );

      // 1. Controles numéricos/temporais de SLA (identificam configuração + prioridade + unidade)
      expect(await screen.findByRole('spinbutton', {
        name: /prazo de primeira resposta para prioridade baixa, em horas úteis/i,
      })).toBeInTheDocument();

      expect(screen.getByRole('spinbutton', {
        name: /prazo de primeira resposta para prioridade alta, em horas úteis/i,
      })).toBeInTheDocument();

      expect(screen.getByRole('spinbutton', {
        name: /prazo de primeira resposta para prioridade urgente, em horas úteis/i,
      })).toBeInTheDocument();

      expect(screen.getByRole('spinbutton', {
        name: /multiplicador de conclusão para prioridade alta/i,
      })).toBeInTheDocument();

      expect(screen.getByRole('spinbutton', {
        name: /limite percentual para considerar ocorrência próxima do vencimento, em porcentagem/i,
      })).toBeInTheDocument();

      // 2. Controles de categorias
      expect(screen.getByRole('textbox', { name: /nome da categoria iluminação/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /descrição da categoria iluminação/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /prazo de sla-base para categoria iluminação, em horas úteis/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /ordem de exibição da categoria iluminação/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /categoria iluminação ativa/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /salvar categoria iluminação/i })).toBeInTheDocument();

      // 3. Controles do calendário semanal
      expect(screen.getByRole('checkbox', { name: /atendimento aberto na segunda-feira/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/horário de início de atendimento na segunda-feira/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/horário de término de atendimento na segunda-feira/i)).toBeInTheDocument();

      // 4. Controles de exceções do calendário
      expect(screen.getByLabelText(/data da exceção do calendário/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/tipo da exceção do calendário/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/descrição da exceção do calendário/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/dia com atendimento totalmente fechado/i)).toBeInTheDocument();

      // 5. Tabela semântica com caption e scope (A11Y-IMP-003)
      expect(screen.getByText(/matriz de prazos de sla e multiplicadores por nível de prioridade/i)).toBeInTheDocument();
    });
  });

  describe('G09E-F004 — Identificação Antecipada de Campos Obrigatórios', () => {
    it('PUBLIC_REQUIRED_FIELDS_IDENTIFIED no formulário de ocorrência', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <NewOccurrencePage />
        </MemoryRouter>
      );

      // Avança para o Passo 2: Local da ocorrência
      const nextButton = screen.getByRole('button', { name: /próximo/i });
      await user.click(nextButton);

      // Verifica instrução prévia de campos obrigatórios
      expect(screen.getByText(/indica campo de preenchimento obrigatório/i)).toBeInTheDocument();

      // Verifica campos obrigatórios identificados por rótulo e atributo
      const campusSelect = screen.getByLabelText(/campus ou unidade/i);
      expect(campusSelect).toBeRequired();
      expect(campusSelect).toHaveAttribute('aria-required', 'true');

      const buildingSelect = screen.getByLabelText(/prédio, bloco ou área/i);
      expect(buildingSelect).toBeRequired();
      expect(buildingSelect).toHaveAttribute('aria-required', 'true');

      const roomSelect = screen.getByLabelText(/sala, ambiente ou local/i);
      expect(roomSelect).toBeRequired();
      expect(roomSelect).toHaveAttribute('aria-required', 'true');

      // Verifica que campo opcional é expressamente identificado como opcional
      expect(screen.getByText('(opcional)')).toBeInTheDocument();
    });
  });

  describe('G09E-F005 — Grupo Semântico de Categorias', () => {
    it('CATEGORY_RADIO_GROUP_NAMED com fieldset e legend nativos', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <NewOccurrencePage />
        </MemoryRouter>
      );

      // Passo 1 -> Passo 2
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Preenche dados do Passo 2 para poder avançar
      const campusSelect = screen.getByLabelText(/campus ou unidade/i);
      await user.selectOptions(campusSelect, 'campus-bsf');

      const buildingSelect = screen.getByLabelText(/prédio, bloco ou área/i);
      await user.selectOptions(buildingSelect, 'b-adm');

      const roomSelect = screen.getByLabelText(/sala, ambiente ou local/i);
      await user.selectOptions(roomSelect, 'r-101');

      // Passo 2 -> Passo 3 (Categorias)
      await user.click(screen.getByRole('button', { name: /próximo/i }));

      // Verifica o grupo semântico (fieldset / legend)
      const group = screen.getByRole('group', { name: /categoria do problema/i });
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('aria-required', 'true');

      // Radios individuais são selecionáveis por nome
      const radioIluminacao = screen.getByRole('radio', { name: /iluminação/i });
      const radioHidraulica = screen.getByRole('radio', { name: /hidráulica/i });

      expect(radioIluminacao).toBeInTheDocument();
      expect(radioHidraulica).toBeInTheDocument();

      await user.click(radioIluminacao);
      expect(radioIluminacao).toBeChecked();
      expect(radioHidraulica).not.toBeChecked();

      await user.click(radioHidraulica);
      expect(radioHidraulica).toBeChecked();
      expect(radioIluminacao).not.toBeChecked();
    });
  });

  describe('G09E-F006 + G09D-F005 — Calendário Semanal e Reflow a 320 CSS px', () => {
    it('CALENDAR_REFLOW_320: Calendário semanal reponsivo sem causar overflow horizontal', async () => {
      render(
        <MemoryRouter>
          <AdminSettingsPage />
        </MemoryRouter>
      );

      // Aguarda carregamento
      expect(await screen.findByText('Semana padrão de atendimento')).toBeInTheDocument();

      // Localiza os cartões dos dias da semana
      const mondayLabel = screen.getByText('Segunda-feira');
      const mondayContainer = mondayLabel.closest('.rounded');

      // Confirma que o container possui layout flex responsivo (empilha no mobile, grid apenas em sm:)
      expect(mondayContainer?.className).toContain('flex flex-col');
      expect(mondayContainer?.className).toContain('sm:grid');
      expect(mondayContainer?.className).toContain('sm:grid-cols-[1fr_auto_8rem_8rem]');

      // Confirma que os inputs de horário no mobile utilizam w-full em grid de 2 colunas
      const startTimeInput = screen.getByLabelText(/horário de início de atendimento na segunda-feira/i);
      expect(startTimeInput.className).toContain('w-full');
      expect(startTimeInput.className).toContain('sm:w-32');
    });
  });
});
