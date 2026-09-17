// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SystemConfig } from '../src/models/config';
import { createTestNotificationItem } from '../server/domain/notificationOutbox';
import type { NotificationWebhookEvent } from '../server/models/notificationDomain';
import type { EmailProvider, EmailSendRequest, EmailSendResult } from '../server/providers/emailProvider';
import { RESEND_ATTEMPT_TAG_NAME, RESEND_NOTIFICATION_TAG_NAME, resendNotificationTags } from '../server/providers/resendEmailProvider';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { InMemoryNotificationOutboxRepository } from '../server/repositories/notificationOutboxRepository';
import { NotificationService } from '../server/services/notificationService';
import { FakeSystemConfigRepository } from './helpers/fakeRepositories';

const now = new Date('2026-08-18T15:00:00.000Z');
const config: SystemConfig = {
  institutionDisplayName: 'IFES', protocolPrefix: 'INF', notificationEmails: ['um@example.org'],
  emailNotificationsEnabled: true, autoAssignRisk: true, serviceNotice: '',
};

class CapturingProvider implements EmailProvider {
  public readonly name = 'resend' as const;
  public readonly requests: EmailSendRequest[] = [];
  public send(request: EmailSendRequest): Promise<EmailSendResult> {
    this.requests.push(structuredClone(request));
    return Promise.resolve({ providerMessageId: `provider-${this.requests.length}` });
  }
  public verifyWebhook(payload: string, _headers: { id: string; timestamp: string; signature: string }, _secret: string): unknown {
    void _headers; void _secret;
    return JSON.parse(payload) as unknown;
  }
}

function service(outbox: InMemoryNotificationOutboxRepository, provider = new CapturingProvider()): NotificationService {
  return new NotificationService(
    outbox,
    new FakeSystemConfigRepository(config),
    new InMemoryAuditLogRepository(),
    provider,
    { enabled: true, from: 'Sistema <sistema@example.org>', webhookSecret: 'placeholder' },
  );
}

function webhook(
  itemId: string | undefined,
  providerMessageId: string,
  type: NotificationWebhookEvent['eventType'] = 'email.delivered',
  eventId = `event-${providerMessageId}-${type}`,
  occurredAt = new Date(now.getTime() + 1_000),
  failureReason?: string,
): NotificationWebhookEvent {
  return {
    eventId,
    eventType: type,
    providerMessageId,
    ...(itemId === undefined ? {} : { notificationId: itemId }),
    occurredAt,
    ...(failureReason === undefined ? {} : { failureReason }),
  };
}

function body(type: NotificationWebhookEvent['eventType'], providerMessageId: string, notificationId?: string, failureReason?: string, attemptId?: string): Buffer {
  return Buffer.from(JSON.stringify({
    type,
    created_at: new Date(now.getTime() + 1_000).toISOString(),
    data: {
      email_id: providerMessageId,
      ...(notificationId === undefined ? {} : { tags: { [RESEND_NOTIFICATION_TAG_NAME]: notificationId, ...(attemptId === undefined ? {} : { [RESEND_ATTEMPT_TAG_NAME]: attemptId }) } }),
      ...(failureReason === undefined ? {} : { failed: { reason: failureReason } }),
    },
  }));
}

const headers = (id: string): { id: string; timestamp: string; signature: string } => ({ id, timestamp: '1755529200', signature: 'valid' });

async function markSent(outbox: InMemoryNotificationOutboxRepository, itemId: string, providerMessageId: string, at = now): Promise<void> {
  await outbox.claimEligible(1, 'owner', at, 60_000);
  await outbox.markSent(itemId, 'owner', providerMessageId, at);
}

describe('correlação e observabilidade de notificações 0.7.2', () => {
  it('o envio leva o notificationId lógico até a abstração do provider', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const provider = new CapturingProvider();
    const item = createTestNotificationItem('um@example.org', 'provider-request', now);
    await outbox.enqueue(item);
    await service(outbox, provider).processPending();
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.notificationId).toBe(item.id);
    expect(provider.requests[0]?.notificationId).not.toContain('um@example.org');
    expect(provider.requests[0]?.notificationId).not.toContain(item.protocol);
  });

  it('o provider transforma IDs técnicos em tags sem dado pessoal', () => {
    const item = createTestNotificationItem('pessoa@example.org', 'tag', now);
    const attemptId = 'a'.repeat(64);
    expect(resendNotificationTags(item.id, attemptId)).toEqual([{ name: 'notification_id', value: item.id }, { name: 'attempt_id', value: attemptId }]);
    expect(JSON.stringify(resendNotificationTags(item.id, attemptId))).not.toContain('pessoa@example.org');
    expect(() => resendNotificationTags('id inválido', attemptId)).toThrow(/identificador lógico/iu);
    expect(() => resendNotificationTags(item.id, 'tentativa inválida')).toThrow(/tentativa/iu);
  });

  it('tag inválida é rejeitada no parser do webhook', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    await expect(service(outbox).processWebhook(body('email.delivered', 'provider-invalid', 'fora-do-formato'), headers('event-invalid-tag')))
      .rejects.toMatchObject({ status: 400, code: 'WEBHOOK_NOTIFICATION_ID_INVALID' });
  });

  it('correlaciona primeiro por notification_id mesmo antes de providerMessageId existir localmente', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'direct-tag', now);
    await outbox.enqueue(item);
    await outbox.claimEligible(1, 'owner', now, 60_000);
    expect(await service(outbox).processWebhook(body('email.delivered', 'provider-direct', item.id), headers('event-direct-tag'))).toBe('applied');
    expect(outbox.all()[0]).toMatchObject({ id: item.id, status: 'DELIVERED', providerMessageId: 'provider-direct' });
  });

  it('mantém compatibilidade com mensagem antiga sem tag por providerMessageId', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'legacy-fallback', now);
    await outbox.enqueue(item);
    await markSent(outbox, item.id, 'provider-legacy');
    expect(await service(outbox).processWebhook(body('email.delivered', 'provider-legacy'), headers('event-legacy'))).toBe('applied');
    expect(outbox.all()[0]?.status).toBe('DELIVERED');
  });

  it('notification_id inexistente tenta fallback por providerMessageId', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'missing-tag-target', now);
    const nonexistent = createTestNotificationItem('dois@example.org', 'nonexistent', now).id;
    await outbox.enqueue(item);
    await markSent(outbox, item.id, 'provider-fallback');
    expect(await outbox.applyWebhook(webhook(nonexistent, 'provider-fallback'))).toBe('applied');
    expect(outbox.all()[0]?.status).toBe('DELIVERED');
  });

  it('notification_id e providerMessageId conflitantes não atualizam entrega errada', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const direct = createTestNotificationItem('um@example.org', 'conflict-direct', now);
    const providerTarget = createTestNotificationItem('dois@example.org', 'conflict-provider', now);
    await outbox.enqueue(direct);
    await outbox.enqueue({ ...providerTarget, status: 'SENT', providerMessageId: 'provider-conflict', providerAcceptedAt: now, sentAt: now });
    expect(await outbox.applyWebhook(webhook(direct.id, 'provider-conflict', 'email.delivered', 'event-conflict'))).toBe('inconsistent');
    expect(outbox.all().find((item) => item.id === direct.id)?.status).toBe('PENDING');
    expect(outbox.all().find((item) => item.id === providerTarget.id)?.status).toBe('SENT');
    expect(outbox.webhookRecords().find((event) => event.eventId === 'event-conflict')).toMatchObject({ status: 'INCONSISTENT', lastErrorCode: 'WEBHOOK_CORRELATION_CONFLICT' });
  });

  it('webhook válido ainda não correlacionável vira UNMATCHED_PENDING e não é descartado', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'future-item', now);
    expect(await outbox.applyWebhook(webhook(item.id, 'provider-future', 'email.delivered', 'event-future'), now)).toBe('unmatched');
    expect(outbox.webhookRecords()).toHaveLength(1);
    expect(outbox.webhookRecords()[0]).toMatchObject({ eventId: 'event-future', status: 'UNMATCHED_PENDING', attemptCount: 1 });
    const metrics = await outbox.metrics(new Date(now.getTime() + 1_000));
    expect(metrics.unmatchedWebhookPending).toBe(1);
    expect(metrics.oldestUnmatchedWebhookAt?.getTime()).toBe(now.getTime());
  });

  it('unmatched persiste somente razão técnica canônica, sem eventual e-mail do payload', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'failure-privacy', now);
    await outbox.applyWebhook(
      webhook(item.id, 'provider-private-failure', 'email.failed', 'event-private-failure', now, 'invalid recipient pessoa@example.org'),
      now,
    );
    const record = outbox.webhookRecords()[0];
    expect(record?.failureReason).toBe('invalid_recipient');
    expect(JSON.stringify(record)).not.toContain('pessoa@example.org');
  });

  it('reconciliação posterior atualiza o mesmo evento para PROCESSED', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'reconcile-later', now);
    const event = webhook(item.id, 'provider-reconcile', 'email.delivered', 'event-reconcile');
    expect(await outbox.applyWebhook(event, now)).toBe('unmatched');
    await outbox.enqueue(item);
    const result = await outbox.reconcilePendingWebhooks(20, new Date(now.getTime() + 61_000));
    expect(result.processed).toBe(1);
    expect(outbox.all()[0]?.status).toBe('DELIVERED');
    expect(outbox.webhookRecords()).toHaveLength(1);
    expect(outbox.webhookRecords()[0]).toMatchObject({ eventId: 'event-reconcile', status: 'PROCESSED', targetNotificationId: item.id, attemptCount: 2 });
  });

  it('replay de webhook já processado não duplica processamento', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'replay', now);
    await outbox.enqueue(item);
    const event = webhook(item.id, 'provider-replay', 'email.delivered', 'event-replay');
    expect(await outbox.applyWebhook(event, now)).toBe('applied');
    expect(await outbox.applyWebhook(event, new Date(now.getTime() + 5_000))).toBe('duplicate');
    expect(outbox.webhookRecords()).toHaveLength(1);
  });

  it('unmatched antigo expira de forma controlada', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'expire', now);
    await outbox.applyWebhook(webhook(item.id, 'provider-expire', 'email.delivered', 'event-expire'), now);
    const result = await outbox.reconcilePendingWebhooks(20, new Date(now.getTime() + 73 * 60 * 60_000));
    expect(result.expired).toBe(1);
    expect(outbox.webhookRecords()[0]).toMatchObject({ status: 'UNMATCHED_EXPIRED', lastErrorCode: 'WEBHOOK_CORRELATION_EXPIRED' });
  });

  it('webhook antes de markSent prevalece e markSent tardio não rebaixa DELIVERED', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'race-mark-sent', now);
    await outbox.enqueue(item);
    await outbox.claimEligible(1, 'owner', now, 60_000);
    await outbox.applyWebhook(webhook(item.id, 'provider-race-sent'), now);
    await outbox.markSent(item.id, 'owner', 'provider-race-sent', new Date(now.getTime() + 2_000));
    expect(outbox.all()[0]?.status).toBe('DELIVERED');
  });

  it('webhook antes de markDeliveryUncertain prevalece e escrita tardia não rebaixa DELIVERED', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', 'race-uncertain', now);
    await outbox.enqueue(item);
    await outbox.claimEligible(1, 'owner', now, 60_000);
    await outbox.applyWebhook(webhook(item.id, 'provider-race-uncertain'), now);
    await outbox.markDeliveryUncertain(item.id, 'owner', 'provider-race-uncertain', new Date(now.getTime() + 2_000));
    expect(outbox.all()[0]?.status).toBe('DELIVERED');
  });

  it.each([
    ['email.delivered', undefined, 'DELIVERED'],
    ['email.bounced', undefined, 'BOUNCED'],
    ['email.complained', undefined, 'COMPLAINED'],
    ['email.failed', 'domain_not_verified', 'FAILED_CONFIGURATION'],
  ] as const)('webhook %s resolve DELIVERY_UNCERTAIN para %s', async (type, reason, expected) => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const item = createTestNotificationItem('um@example.org', `uncertain-${type}`, now);
    await outbox.enqueue(item);
    await outbox.claimEligible(1, 'owner', now, 60_000);
    await outbox.markDeliveryUncertain(item.id, 'owner', 'provider-uncertain', now);
    await outbox.applyWebhook(webhook(item.id, 'provider-uncertain', type, `event-${type}`, new Date(now.getTime() + 1_000), reason));
    expect(outbox.all()[0]?.status).toBe(expected);
  });

  it('consumo lógico conta providerAcceptedAt uma vez, inclusive DELIVERY_UNCERTAIN, e não conta não aceitos', async () => {
    const outbox = new InMemoryNotificationOutboxRepository();
    const sent = createTestNotificationItem('um@example.org', 'metric-sent', now);
    const uncertain = createTestNotificationItem('dois@example.org', 'metric-uncertain', now);
    const pending = createTestNotificationItem('tres@example.org', 'metric-pending', now);
    await outbox.enqueue(sent); await outbox.enqueue(uncertain); await outbox.enqueue(pending);
    const claims = await outbox.claimEligible(3, 'owner', now, 60_000);
    expect(claims).toHaveLength(3);
    await outbox.markSent(sent.id, 'owner', 'provider-sent', now);
    await outbox.markDeliveryUncertain(uncertain.id, 'owner', 'provider-uncertain-metric', now);
    const metrics = await outbox.metrics(new Date(now.getTime() + 1_000));
    expect(metrics.acceptedToday).toBe(2);
    expect(metrics.acceptedThisMonth).toBe(2);
    expect(metrics.acceptedTotal).toBe(2);
    expect(metrics.sentToday).toBe(1);
    expect(metrics.deliveryUncertain).toBe(1);
  });


  it('índices Firestore existem apenas para as consultas operacionais introduzidas', () => {
    const indexes = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8')) as {
      indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order: string }> }>;
    };
    const webhookIndexes = indexes.indexes
      .filter((index) => index.collectionGroup === 'notificationWebhookEvents')
      .map((index) => index.fields.map((field) => field.fieldPath).join('+'));
    expect(webhookIndexes).toEqual(expect.arrayContaining([
      'status+nextAttemptAt',
      'status+firstSeenAt',
      'status+retentionUntil',
    ]));
  });

  it('painel descreve Artifact Registry como estimativa lógica e não como faturamento real', () => {
    const source = readFileSync(new URL('../src/pages/admin/AdminInfrastructurePage.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Soma lógica aproximada das imagens observadas');
    expect(source).toContain('não corresponde necessariamente ao armazenamento faturado');
    expect(source).toContain('camadas podem ser compartilhadas');
    expect(source).toContain('Webhooks sem correlação');
    expect(source).toContain('webhook(s) válido(s) aguardando correlação');
  });

  it('o ciclo de manutenção existente também executa reconciliação de webhooks', async () => {
    class ReconcileSpyRepository extends InMemoryNotificationOutboxRepository {
      public calls = 0;
      public override reconcilePendingWebhooks(limit: number, at?: Date) {
        this.calls += 1;
        return super.reconcilePendingWebhooks(limit, at);
      }
    }
    const outbox = new ReconcileSpyRepository();
    const result = await service(outbox).processMaintenance(20);
    expect(outbox.calls).toBe(1);
    expect(result.webhookReconciliation).toMatchObject({ examined: 0, processed: 0 });
  });
});
