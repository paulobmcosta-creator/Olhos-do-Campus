import { describe, expect, it, vi } from 'vitest';
import { createOccurrenceNotificationItems, createTestNotificationItem } from '../server/domain/notificationOutbox';
import { InMemoryNotificationOutboxRepository } from '../server/repositories/notificationOutboxRepository';
import { NotificationService } from '../server/services/notificationService';
import { OccurrenceService } from '../server/services/occurrenceService';
import type { EmailProvider, EmailSendRequest, EmailSendResult } from '../server/providers/emailProvider';
import type { SystemConfigRepository } from '../server/repositories/systemConfigRepository';
import type { AuditLogRepository } from '../server/repositories/auditLogRepository';
import type { StoredOccurrence } from '../server/models/occurrenceDomain';
import type { NotificationOutboxItem, NotificationWebhookEvent } from '../server/models/notificationDomain';
import { DEFAULT_OPERATIONAL_CONFIG, REFERENCE_CATEGORIES, REFERENCE_LOCATIONS } from '../server/repositories/referenceSeedData';
import { FakeCategoryRepository, FakeLocationRepository, FakeSystemConfigRepository } from './helpers/fakeRepositories';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';
import { makeTestPhotoService } from './helpers/fakePhotoInfrastructure';

const sampleOccurrence: StoredOccurrence = {
  id: 'occ-1',
  schemaVersion: 2,
  protocol: '2026.0001',
  trackingKeyHash: 'hash',
  trackingKeySalt: 'salt',
  reportedCategoryId: 'cat-1',
  reportedCategoryNameSnapshot: 'Elétrica',
  categoryId: 'cat-1',
  categoryNameSnapshot: 'Elétrica',
  reportedLocation: { campusName: 'Campus', buildingName: 'Prédio A', floor: '1º', room: '101' },
  location: { campusName: 'Campus', buildingName: 'Prédio A', floor: '1º', room: '101' },
  description: 'Tomada sem energia',
  immediateRisk: false,
  status: 'Recebida',
  priority: 'Normal',
  priorityRank: 4,
  createdAt: new Date('2026-03-01T10:00:00Z'),
  updatedAt: new Date('2026-03-01T10:00:00Z'),
  version: 1,
  dataClassification: 'REAL',
  reopenedCount: 0,
  hasPhoto: false,
  searchTokens: ['tomada'],
};

describe('Notification Provider Binding and Isolation (0.7.6)', () => {
  it('vincula determinística e imutavelmente o provedor na criação dos itens de outbox para novas ocorrências', () => {
    const ewsItems = createOccurrenceNotificationItems(sampleOccurrence, ['admin@ifes.edu.br'], sampleOccurrence.createdAt, 'ews');
    expect(ewsItems).toHaveLength(1);
    expect(ewsItems[0]?.provider).toBe('ews');

    const resendItems = createOccurrenceNotificationItems(sampleOccurrence, ['admin@ifes.edu.br'], sampleOccurrence.createdAt, 'resend');
    expect(resendItems).toHaveLength(1);
    expect(resendItems[0]?.provider).toBe('resend');

    const ewsTest = createTestNotificationItem('admin@ifes.edu.br', 'req-1', new Date(), 'ews');
    expect(ewsTest.provider).toBe('ews');

    const resendTest = createTestNotificationItem('admin@ifes.edu.br', 'req-2', new Date(), 'resend');
    expect(resendTest.provider).toBe('resend');
  });

  it('despacha cada item exclusivamente para seu provedor correspondente sem fallback silencioso', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const configs: Partial<SystemConfigRepository> = {
      get: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        protocolPrefix: 'IFES-TEST',
        notificationEmails: ['destinatario@ifes.edu.br'],
        emailNotificationsEnabled: true,
        version: 1,
        updatedAt: new Date(),
        updatedBy: 'admin',
      }),
    };
    const auditLogs: Partial<AuditLogRepository> = {
      write: vi.fn().mockResolvedValue(undefined),
    };

    const mockEwsSend = vi.fn().mockResolvedValue({} as EmailSendResult);
    const mockEwsProvider: EmailProvider = {
      name: 'ews',
      send: mockEwsSend,
    };

    const mockResendSend = vi.fn().mockResolvedValue({ providerMessageId: 'resend_123' } as EmailSendResult);
    const mockResendProvider: EmailProvider = {
      name: 'resend',
      send: mockResendSend,
    };

    const service = new NotificationService(
      outbox,
      configs as SystemConfigRepository,
      auditLogs as AuditLogRepository,
      { ews: mockEwsProvider, resend: mockResendProvider },
      { activeProvider: 'ews', ewsEnabled: true, resendEnabled: true, ewsFrom: 'notificacoes@ifes.edu.br', resendFrom: 'onboarding@resend.dev' },
    );

    const ewsItem = createTestNotificationItem('ews-user@ifes.edu.br', 'req-ews', new Date(), 'ews');
    const resendItem = createTestNotificationItem('resend-user@ifes.edu.br', 'req-resend', new Date(), 'resend');
    await outbox.enqueue(ewsItem);
    await outbox.enqueue(resendItem);

    const result = await service.processPending(10);
    expect(result.sent).toBe(2);
    expect(mockEwsSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend).toHaveBeenCalledTimes(1);

    const ewsCall = mockEwsSend.mock.calls[0]?.[0] as EmailSendRequest;
    expect(ewsCall.message.to).toBe('ews-user@ifes.edu.br');

    const resendCall = mockResendSend.mock.calls[0]?.[0] as EmailSendRequest;
    expect(resendCall.message.to).toBe('resend-user@ifes.edu.br');
  });

  it('preserva o envio por Resend de um item histórico mesmo após mudança de configuração ativa para EWS', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const configs: Partial<SystemConfigRepository> = {
      get: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        protocolPrefix: 'IFES-TEST',
        notificationEmails: ['destinatario@ifes.edu.br'],
        emailNotificationsEnabled: true,
        version: 1,
        updatedAt: new Date(),
        updatedBy: 'admin',
      }),
    };
    const auditLogs: Partial<AuditLogRepository> = { write: vi.fn().mockResolvedValue(undefined) };

    const mockEwsSend = vi.fn().mockResolvedValue({} as EmailSendResult);
    const mockResendSend = vi.fn().mockResolvedValue({ providerMessageId: 'resend_hist' } as EmailSendResult);

    // Item histórico gravado com provider='resend'
    const historicalResendItem = createTestNotificationItem('dest@ifes.edu.br', 'req-hist', new Date(), 'resend');
    await outbox.enqueue(historicalResendItem);

    // Provedor ativo agora é EWS, mas Resend continua configurado para drenar fila histórica
    const service = new NotificationService(
      outbox,
      configs as SystemConfigRepository,
      auditLogs as AuditLogRepository,
      { ews: { name: 'ews', send: mockEwsSend }, resend: { name: 'resend', send: mockResendSend } },
      { activeProvider: 'ews', ewsEnabled: true, resendEnabled: true, ewsFrom: 'notificacoes@ifes.edu.br', resendFrom: 'onboarding@resend.dev' },
    );

    const result = await service.processPending(10);
    expect(result.sent).toBe(1);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockEwsSend).not.toHaveBeenCalled();
  });

  it('falha com FAILED_CONFIGURATION se o provedor específico do item não estiver configurado/habilitado, sem recorrer ao outro provedor', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const configs: Partial<SystemConfigRepository> = {
      get: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        protocolPrefix: 'IFES-TEST',
        notificationEmails: ['destinatario@ifes.edu.br'],
        emailNotificationsEnabled: true,
        version: 1,
        updatedAt: new Date(),
        updatedBy: 'admin',
      }),
    };
    const auditLogs: Partial<AuditLogRepository> = { write: vi.fn().mockResolvedValue(undefined) };

    const mockEwsSend = vi.fn().mockResolvedValue({} as EmailSendResult);

    // Apenas EWS configurado, Resend desabilitado/ausente
    const service = new NotificationService(
      outbox,
      configs as SystemConfigRepository,
      auditLogs as AuditLogRepository,
      { ews: { name: 'ews', send: mockEwsSend } },
      { activeProvider: 'ews', ewsEnabled: true, resendEnabled: false, ewsFrom: 'notificacoes@ifes.edu.br' },
    );

    const resendItem = createTestNotificationItem('resend-user@ifes.edu.br', 'req-resend-isolated', new Date(), 'resend');
    await outbox.enqueue(resendItem);

    const result = await service.processPending(10);
    expect(result.failed).toBe(1);
    expect(mockEwsSend).not.toHaveBeenCalled();

    const stored = outbox.all().find((i) => i.id === resendItem.id);
    expect(stored?.status).toBe('FAILED_CONFIGURATION');
  });

  it('marca item como SENT e tentativa como ACCEPTED sem fabricar providerMessageId quando ausente', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const configs: Partial<SystemConfigRepository> = {
      get: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        protocolPrefix: 'IFES-TEST',
        notificationEmails: ['destinatario@ifes.edu.br'],
        emailNotificationsEnabled: true,
        version: 1,
        updatedAt: new Date(),
        updatedBy: 'admin',
      }),
    };
    const auditLogs: Partial<AuditLogRepository> = { write: vi.fn().mockResolvedValue(undefined) };

    const mockEwsProvider: EmailProvider = {
      name: 'ews',
      send: vi.fn().mockResolvedValue({} as EmailSendResult), // sem providerMessageId
    };

    const service = new NotificationService(
      outbox,
      configs as SystemConfigRepository,
      auditLogs as AuditLogRepository,
      { ews: mockEwsProvider },
      { activeProvider: 'ews', ewsEnabled: true, resendEnabled: false, ewsFrom: 'notificacoes@ifes.edu.br' },
    );

    const item = createTestNotificationItem('test@ifes.edu.br', 'req-no-id', new Date(), 'ews');
    await outbox.enqueue(item);

    const result = await service.processPending(10);
    expect(result.sent).toBe(1);

    const stored = outbox.all().find((i) => i.id === item.id);
    expect(stored?.status).toBe('SENT');
    expect(stored?.providerMessageId).toBeUndefined();

    const attempts = outbox.attempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe('ACCEPTED');
    expect(attempts[0]?.providerMessageId).toBeUndefined();
  });

  it('marca tentativa como DELIVERY_UNCERTAIN se a persistência local falhar após o envio confirmado pelo provedor', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const configs: Partial<SystemConfigRepository> = {
      get: vi.fn().mockResolvedValue({
        schemaVersion: 1,
        protocolPrefix: 'IFES-TEST',
        notificationEmails: ['destinatario@ifes.edu.br'],
        emailNotificationsEnabled: true,
        version: 1,
        updatedAt: new Date(),
        updatedBy: 'admin',
      }),
    };
    const auditLogs: Partial<AuditLogRepository> = { write: vi.fn().mockResolvedValue(undefined) };

    const mockEwsProvider: EmailProvider = {
      name: 'ews',
      send: vi.fn().mockResolvedValue({} as EmailSendResult),
    };

    // Simular falha de markSent
    vi.spyOn(outbox, 'markSent').mockRejectedValueOnce(new Error('TRANSACTION_COLLISION'));
    const markUncertainSpy = vi.spyOn(outbox, 'markDeliveryUncertain');

    const service = new NotificationService(
      outbox,
      configs as SystemConfigRepository,
      auditLogs as AuditLogRepository,
      { ews: mockEwsProvider },
      { activeProvider: 'ews', ewsEnabled: true, resendEnabled: false, ewsFrom: 'notificacoes@ifes.edu.br' },
    );

    const item = createTestNotificationItem('test@ifes.edu.br', 'req-fail-persist', new Date(), 'ews');
    await outbox.enqueue(item);

    const result = await service.processPending(10);
    expect(result.uncertain).toBe(1);
    expect(markUncertainSpy).toHaveBeenCalledWith(item.id, expect.any(String), undefined, expect.any(Date), expect.any(String));
  });

  it('rejeita com inconsistent e não altera notificação EWS quando um webhook Resend for recebido', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const ewsItem = createTestNotificationItem('ews-target@ifes.edu.br', 'req-ews-webhook', new Date(), 'ews');
    await outbox.enqueue(ewsItem);

    // Reivindicar para ter uma tentativa
    const claimed = await outbox.claimEligible(1, 'owner-1', new Date(), 60_000);
    const attemptId = claimed[0]?.currentAttemptId;

    const webhookEvent: NotificationWebhookEvent = {
      eventId: 'evt-resend-123',
      eventType: 'email.delivered',
      providerMessageId: 'resend_msg_fake',
      notificationId: ewsItem.id,
      attemptId,
      occurredAt: new Date(),
    };

    const applyResult = await outbox.applyWebhook(webhookEvent);
    expect(applyResult).toBe('inconsistent');

    // A notificação EWS não pode ter sido modificada pelo webhook Resend
    const itemAfter = outbox.all().find((i) => i.id === ewsItem.id);
    expect(itemAfter?.deliveredAt).toBeUndefined();
  });

  it('fluxo real: OccurrenceService.create propaga deterministicamente defaultEmailProvider para o repositório e outbox', async () => {
    const { occurrences, events, adminUsers, teams, sla, auditLogs } = makeOccurrenceServiceFixture();
    const photo = makeTestPhotoService();

    // 1. Serviço instanciado com EWS como defaultEmailProvider
    const ewsService = new OccurrenceService(
      occurrences,
      events,
      new FakeCategoryRepository(REFERENCE_CATEGORIES),
      new FakeLocationRepository(REFERENCE_LOCATIONS),
      new FakeSystemConfigRepository({ ...DEFAULT_OPERATIONAL_CONFIG, notificationEmails: ['admin@ifes.edu.br'], emailNotificationsEnabled: true }),
      adminUsers,
      teams,
      sla,
      auditLogs,
      photo.service,
      'ews',
    );

    const createdEws = await ewsService.create(createInput, 'corr-ews-flow');
    expect(createdEws.protocol).toBeDefined();

    const storedEws = await occurrences.findByProtocol(createdEws.protocol);
    expect(storedEws).toBeDefined();

    const lastEwsOutbox = occurrences.outboxItems.find((n: NotificationOutboxItem) => n.occurrenceId === storedEws?.id);
    expect(lastEwsOutbox).toBeDefined();
    expect(lastEwsOutbox?.provider).toBe('ews');

    // 2. Serviço instanciado com Resend como defaultEmailProvider
    const resendService = new OccurrenceService(
      occurrences,
      events,
      new FakeCategoryRepository(REFERENCE_CATEGORIES),
      new FakeLocationRepository(REFERENCE_LOCATIONS),
      new FakeSystemConfigRepository({ ...DEFAULT_OPERATIONAL_CONFIG, notificationEmails: ['admin@ifes.edu.br'], emailNotificationsEnabled: true }),
      adminUsers,
      teams,
      sla,
      auditLogs,
      photo.service,
      'resend',
    );

    const createdResend = await resendService.create(createInput, 'corr-resend-flow');
    expect(createdResend.protocol).toBeDefined();

    const storedResend = await occurrences.findByProtocol(createdResend.protocol);
    expect(storedResend).toBeDefined();

    const lastResendOutbox = occurrences.outboxItems.find((n: NotificationOutboxItem) => n.occurrenceId === storedResend?.id);
    expect(lastResendOutbox).toBeDefined();
    expect(lastResendOutbox?.provider).toBe('resend');
  });

  it('processa webhooks Resend mesmo com EWS ativo e sem API Key de envio do Resend configurada', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const configs: Partial<SystemConfigRepository> = {
      get: vi.fn().mockResolvedValue(DEFAULT_OPERATIONAL_CONFIG),
    };
    const auditLogs: Partial<AuditLogRepository> = { write: vi.fn().mockResolvedValue(undefined) };

    const mockEwsProvider: EmailProvider = {
      name: 'ews',
      send: vi.fn().mockResolvedValue({} as EmailSendResult),
    };

    // NotificationService SEM provider de envio Resend, mas com resendWebhookSecret configurado
    const service = new NotificationService(
      outbox,
      configs as SystemConfigRepository,
      auditLogs as AuditLogRepository,
      { ews: mockEwsProvider }, // apenas EWS no mapa de envio
      { activeProvider: 'ews', ewsEnabled: true, resendEnabled: false, resendWebhookSecret: 'whsec_dummy_test_secret' },
    );

    const resendItem = createTestNotificationItem('hist@ifes.edu.br', 'corr-hist-resend', new Date(), 'resend');
    await outbox.enqueue(resendItem);
    const claimed = await outbox.claimEligible(1, 'owner-drain', new Date(), 60_000);
    const attemptId = claimed[0]!.currentAttemptId!;

    // Mockar verificação do webhook na camada de verificação para simular assinatura válida
    const verifierSpy = vi.spyOn((service as unknown as { webhookVerifier: { verify: (...args: unknown[]) => unknown } }).webhookVerifier, 'verify')
      .mockReturnValue({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: {
          email_id: 're_msg_hist_123',
          tags: {
            notification_id: resendItem.id,
            attempt_id: attemptId,
          },
        },
      });

    const result = await service.processWebhook(
      Buffer.from('{"type":"email.delivered"}'),
      { id: 'msg_123', timestamp: '1234567890', signature: 'v1,valid_sig' },
    );

    expect(verifierSpy).toHaveBeenCalled();
    expect(result).toBe('applied');

    const updated = outbox.all().find((i) => i.id === resendItem.id);
    expect(updated?.deliveredAt).toBeDefined();
  });
});
