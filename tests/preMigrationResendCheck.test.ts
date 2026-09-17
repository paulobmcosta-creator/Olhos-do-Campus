import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import {
  diagnoseResendMigrationFromFirestore,
  evaluateResendPreCheck,
  normalizeNotificationProvider,
  type ResendPreCheckAttemptItem,
  type ResendPreCheckNotificationItem,
  type ResendPreCheckWebhookItem,
} from '../scripts/preMigrationResendCheck';

describe('Pre-Migration Resend Check Test Suite (0.7.6 — Fail-Closed & Legacy Compatible)', () => {
  it('Caso 1: Tudo zero e sem pendências Resend -> READY_TO_DISABLE_RESEND = true', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-1', provider: 'resend', status: 'DELIVERED' },
      { id: 'notif-2', provider: 'resend', status: 'BOUNCED' },
      { id: 'notif-3', provider: 'resend', status: 'COMPLAINED' },
      { id: 'notif-4', provider: 'resend', status: 'SUPPRESSED' },
      { id: 'notif-ews-1', provider: 'ews', status: 'PENDING' },
    ];

    const attempts: ResendPreCheckAttemptItem[] = [
      { id: 'att-1', notificationId: 'notif-1', status: 'DELIVERED', deliveredAt: new Date() },
      { id: 'att-2', notificationId: 'notif-2', status: 'ACCEPTED', completedAt: new Date() },
    ];

    const webhooks: ResendPreCheckWebhookItem[] = [
      { id: 'wh-1', status: 'PROCESSED' },
      { id: 'wh-2', status: 'UNMATCHED_EXPIRED' },
    ];

    const summary = evaluateResendPreCheck(notifications, attempts, webhooks);

    expect(summary.readyToDisableResend).toBe(true);
    expect(summary.activePendingCount).toBe(0);
    expect(summary.notifications.SENT).toBe(0);
    expect(summary.notifications.FAILED).toBe(0);
    expect(summary.notifications.RETRY_PENDING).toBe(0);
    expect(summary.notifications.OTHER).toBe(0);
    expect(summary.potentiallyReconcilableAttempts).toBe(0);
    expect(summary.orphanAttemptsCount).toBe(0);
    expect(summary.unmatchedWebhooksCount).toBe(0);
    expect(summary.readErrorsCount).toBe(0);
    expect(summary.blockingReasons).toHaveLength(0);
  });

  it('Caso 2: PENDING > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-p', provider: 'resend', status: 'PENDING' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.PENDING).toBe(1);
    expect(summary.activePendingCount).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('PENDING: 1'))).toBe(true);
  });

  it('Caso 3: PROCESSING > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-pr', provider: 'resend', status: 'PROCESSING' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.PROCESSING).toBe(1);
    expect(summary.activePendingCount).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('PROCESSING: 1'))).toBe(true);
  });

  it('Caso 4: DEFERRED > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-d', provider: 'resend', status: 'DEFERRED' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.DEFERRED).toBe(1);
    expect(summary.activePendingCount).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('DEFERRED: 1'))).toBe(true);
  });

  it('Caso 5: RETRY_PENDING > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-rp', provider: 'resend', status: 'RETRY_PENDING' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.RETRY_PENDING).toBe(1);
    expect(summary.activePendingCount).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('RETRY_PENDING: 1'))).toBe(true);
  });

  it('Caso 6: SENT > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-s', provider: 'resend', status: 'SENT' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.SENT).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('SENT aguardando confirmação final'))).toBe(true);
  });

  it('Caso 7: DELIVERY_UNCERTAIN > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-u', provider: 'resend', status: 'DELIVERY_UNCERTAIN' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.DELIVERY_UNCERTAIN).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('DELIVERY_UNCERTAIN'))).toBe(true);
  });

  it('Caso 8: FAILED_CONFIGURATION > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-fc', provider: 'resend', status: 'FAILED_CONFIGURATION' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.FAILED_CONFIGURATION).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('FAILED_CONFIGURATION'))).toBe(true);
  });

  it('Caso 9: OTHER / status desconhecido > 0 -> READY_TO_DISABLE_RESEND = false', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-other-1', provider: 'resend', status: 'CORRUPTED_STATUS_VALUE' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.OTHER).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('UNKNOWN/OTHER'))).toBe(true);
  });

  it('Caso 10: FAILED > 0 -> READY_TO_DISABLE_RESEND = false (notificações com falha podem ser reprocessadas)', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-f', provider: 'resend', status: 'FAILED' },
    ];
    const summary = evaluateResendPreCheck(notifications, [], []);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.notifications.FAILED).toBe(1);
    expect(summary.blockingReasons.some((r) => r.includes('FAILED (podem ser reprocessadas/requeued'))).toBe(true);
  });

  it('Caso 11: DeliveryAttempt EWS ACCEPTED sem deliveredAt -> NÃO deve ser contabilizada como Resend', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-ews-1', provider: 'ews', status: 'PROCESSING' },
      { id: 'notif-resend-done', provider: 'resend', status: 'DELIVERED' },
    ];

    const attempts: ResendPreCheckAttemptItem[] = [
      { id: 'att-ews-1', notificationId: 'notif-ews-1', status: 'ACCEPTED', deliveredAt: null, completedAt: null },
    ];

    const summary = evaluateResendPreCheck(notifications, attempts, []);
    expect(summary.potentiallyReconcilableAttempts).toBe(0);
    expect(summary.orphanAttemptsCount).toBe(0);
    expect(summary.readyToDisableResend).toBe(true);
  });

  it('Caso 12: DeliveryAttempt Resend ACCEPTED sem deliveredAt -> DEVE bloquear (READY_TO_DISABLE_RESEND = false)', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-resend-1', provider: 'resend', status: 'DELIVERED' },
    ];

    const attempts: ResendPreCheckAttemptItem[] = [
      { id: 'att-resend-1', notificationId: 'notif-resend-1', status: 'ACCEPTED', deliveredAt: null, completedAt: null },
    ];

    const summary = evaluateResendPreCheck(notifications, attempts, []);
    expect(summary.potentiallyReconcilableAttempts).toBe(1);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.blockingReasons.some((r) => r.includes('tentativas Resend aceitas aguardando entrega'))).toBe(true);
  });

  it('Caso 13: Notification pai inexistente (tentativa órfã) -> bloqueia com orphanAttemptsCount > 0', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-resend-done', provider: 'resend', status: 'DELIVERED' },
    ];

    // Tentativa faz referência a notificação inexistente no mapa/banco
    const attempts: ResendPreCheckAttemptItem[] = [
      { id: 'att-orphan-1', notificationId: 'notif-nonexistent-id', status: 'PROCESSING' },
    ];

    const summary = evaluateResendPreCheck(notifications, attempts, []);
    expect(summary.orphanAttemptsCount).toBe(1);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.blockingReasons.some((r) => r.includes('tentativas de entrega órfãs'))).toBe(true);
  });

  it('Caso 14: Falha ao ler Notification pai (readErrorsCount > 0) -> pré-check falha (READY_TO_DISABLE_RESEND = false)', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-1', provider: 'resend', status: 'DELIVERED' },
    ];

    const summary = evaluateResendPreCheck(notifications, [], [], undefined, 1);
    expect(summary.readErrorsCount).toBe(1);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.blockingReasons.some((r) => r.includes('erros de leitura/consulta no Firestore'))).toBe(true);
  });

  it('Caso 15: Webhook Resend UNMATCHED_PENDING -> bloqueia (READY_TO_DISABLE_RESEND = false)', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-1', provider: 'resend', status: 'DELIVERED' },
    ];

    const webhooks: ResendPreCheckWebhookItem[] = [
      { id: 'wh-pending-1', status: 'UNMATCHED_PENDING' },
    ];

    const summary = evaluateResendPreCheck(notifications, [], webhooks);
    expect(summary.unmatchedWebhooksCount).toBe(1);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.blockingReasons.some((r) => r.includes('webhooks Resend em UNMATCHED_PENDING'))).toBe(true);
  });

  it('Caso 16: Webhook finalizado (PROCESSED, UNMATCHED_EXPIRED, INCONSISTENT) -> NÃO bloqueia', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-1', provider: 'resend', status: 'DELIVERED' },
    ];

    const webhooks: ResendPreCheckWebhookItem[] = [
      { id: 'wh-1', status: 'PROCESSED' },
      { id: 'wh-2', status: 'UNMATCHED_EXPIRED' },
      { id: 'wh-3', status: 'INCONSISTENT' },
    ];

    const summary = evaluateResendPreCheck(notifications, [], webhooks);
    expect(summary.unmatchedWebhooksCount).toBe(0);
    expect(summary.readyToDisableResend).toBe(true);
    expect(summary.blockingReasons).toHaveLength(0);
  });

  it('Caso 17: Erro ao consultar notificationWebhookEvents -> não pode retornar READY (readErrorsCount > 0 -> false)', () => {
    const notifications: ResendPreCheckNotificationItem[] = [
      { id: 'notif-1', provider: 'resend', status: 'DELIVERED' },
    ];

    // Simula falha na consulta de webhooks gerando readErrorsCount = 2
    const summary = evaluateResendPreCheck(notifications, [], [], undefined, 2);
    expect(summary.readErrorsCount).toBe(2);
    expect(summary.readyToDisableResend).toBe(false);
    expect(summary.blockingReasons.some((r) => r.includes('2 erros de leitura/consulta no Firestore'))).toBe(true);
  });

  describe('Compatibilidade Legada de Provider (Semântica do Runtime)', () => {
    it('Caso Legado A: provider ausente/undefined + status PENDING -> interpretado como Resend e bloqueia', () => {
      const notifications: ResendPreCheckNotificationItem[] = [
        { id: 'notif-legacy-1', provider: undefined, status: 'PENDING' },
      ];
      const summary = evaluateResendPreCheck(notifications, [], []);
      expect(summary.notifications.totalResend).toBe(1);
      expect(summary.notifications.PENDING).toBe(1);
      expect(summary.readyToDisableResend).toBe(false);
    });

    it('Caso Legado B: provider ausente/undefined + status DELIVERED -> interpretado como Resend terminal e NÃO bloqueia', () => {
      const notifications: ResendPreCheckNotificationItem[] = [
        { id: 'notif-legacy-2', provider: undefined, status: 'DELIVERED' },
      ];
      const summary = evaluateResendPreCheck(notifications, [], []);
      expect(summary.notifications.totalResend).toBe(1);
      expect(summary.notifications.DELIVERED).toBe(1);
      expect(summary.readyToDisableResend).toBe(true);
    });

    it('Caso Legado C: provider desconhecido + status PENDING -> conservadoramente interpretado como Resend e bloqueia', () => {
      const notifications: ResendPreCheckNotificationItem[] = [
        { id: 'notif-legacy-3', provider: 'smtp_unknown_provider', status: 'PENDING' },
      ];
      const summary = evaluateResendPreCheck(notifications, [], []);
      expect(summary.notifications.totalResend).toBe(1);
      expect(summary.notifications.PENDING).toBe(1);
      expect(summary.readyToDisableResend).toBe(false);
    });

    it('Caso Legado D: provider === "ews" + status PENDING -> NÃO é contado nas notificações Resend', () => {
      const notifications: ResendPreCheckNotificationItem[] = [
        { id: 'notif-ews-p', provider: 'ews', status: 'PENDING' },
      ];
      const summary = evaluateResendPreCheck(notifications, [], []);
      expect(summary.notifications.totalResend).toBe(0);
      expect(summary.notifications.PENDING).toBe(0);
      expect(summary.readyToDisableResend).toBe(true);
    });

    it('normalizeNotificationProvider: mapeia com exatidão segundo as regras do runtime', () => {
      expect(normalizeNotificationProvider('ews')).toBe('ews');
      expect(normalizeNotificationProvider('resend')).toBe('resend');
      expect(normalizeNotificationProvider(undefined)).toBe('resend');
      expect(normalizeNotificationProvider(null)).toBe('resend');
      expect(normalizeNotificationProvider('')).toBe('resend');
      expect(normalizeNotificationProvider('other_provider')).toBe('resend');
    });
  });

  describe('Camada de Diagnóstico Firestore (Fake/Mock)', () => {
    it('diagnoseResendMigrationFromFirestore: consulta todos os documentos da outbox e normaliza documentos legados sem provider', async () => {
      const fakeOutboxDocs = [
        { id: 'doc-legacy-pending', data: () => ({ status: 'PENDING' }) }, // sem provider
        { id: 'doc-legacy-delivered', data: () => ({ status: 'DELIVERED' }) }, // sem provider
        { id: 'doc-ews-pending', data: () => ({ status: 'PENDING', provider: 'ews' }) }, // ews
        { id: 'doc-unknown-pending', data: () => ({ status: 'PENDING', provider: 'custom_smtp' }) }, // desconhecido
      ];

      const fakeFirestore = {
        collection(name: string) {
          if (name === 'notificationOutbox') {
            return {
              get: async () => ({ docs: fakeOutboxDocs }),
              doc: (id: string) => ({
                get: async () => {
                  const found = fakeOutboxDocs.find((d) => d.id === id);
                  return { exists: !!found, data: () => found?.data() ?? {} };
                },
              }),
            };
          }
          if (name === 'notificationWebhookEvents') {
            return {
              where: () => ({
                get: async () => ({ docs: [] }),
              }),
            };
          }
          throw new Error(`Collection inesperada: ${name}`);
        },
        collectionGroup(name: string) {
          if (name === 'attempts') {
            return {
              get: async () => ({ docs: [] }),
            };
          }
          throw new Error(`CollectionGroup inesperado: ${name}`);
        },
      } as unknown as Firestore;

      const summary = await diagnoseResendMigrationFromFirestore(fakeFirestore);

      // doc-legacy-pending, doc-legacy-delivered, doc-unknown-pending devem ser contados como Resend (total = 3)
      // doc-ews-pending não deve ser contado como Resend
      expect(summary.notifications.totalResend).toBe(3);
      expect(summary.notifications.PENDING).toBe(2); // doc-legacy-pending + doc-unknown-pending
      expect(summary.notifications.DELIVERED).toBe(1); // doc-legacy-delivered
      expect(summary.readyToDisableResend).toBe(false);
      expect(summary.readErrorsCount).toBe(0);
    });
  });
});


