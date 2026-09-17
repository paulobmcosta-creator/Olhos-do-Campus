// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SystemConfig } from '../src/models/config';
import { createTestNotificationItem } from '../server/domain/notificationOutbox';
import { applyNotificationWebhookState, classifyResendFailedReason, PROVIDER_IDEMPOTENCY_WINDOW_MS } from '../server/domain/notificationDeliveryState';
import type { NotificationOutboxItem, NotificationWebhookEvent } from '../server/models/notificationDomain';
import type { EmailProvider, EmailSendRequest, EmailSendResult } from '../server/providers/emailProvider';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { InMemoryNotificationOutboxRepository } from '../server/repositories/notificationOutboxRepository';
import { NotificationService } from '../server/services/notificationService';
import { FakeSystemConfigRepository } from './helpers/fakeRepositories';

const now = new Date('2026-08-18T12:00:00.000Z');
const config: SystemConfig = { institutionDisplayName:'IFES',protocolPrefix:'INF',notificationEmails:['um@example.org'],emailNotificationsEnabled:true,autoAssignRisk:true,serviceNotice:'' };

class Provider implements EmailProvider {
  public readonly name = 'resend' as const;
  public send(_request: EmailSendRequest): Promise<EmailSendResult> { void _request; return Promise.resolve({ providerMessageId: 'provider-accepted' }); }
  public verifyWebhook(payload: string, _headers: { id: string; timestamp: string; signature: string }, _secret: string): unknown { void _headers; void _secret; return JSON.parse(payload) as unknown; }
}
class MarkSentFailsRepository extends InMemoryNotificationOutboxRepository {
  public override markSent(_id: string, _leaseOwner: string, _providerMessageId: string, _now: Date): Promise<void> { void _id; void _leaseOwner; void _providerMessageId; void _now; return Promise.reject(new Error('persist-failed')); }
}
function notifications(outbox: InMemoryNotificationOutboxRepository): NotificationService { return new NotificationService(outbox,new FakeSystemConfigRepository(config),new InMemoryAuditLogRepository(),new Provider(),{enabled:true,from:'Sistema <sistema@example.org>',webhookSecret:'placeholder'}); }
function event(type: NotificationWebhookEvent['eventType'], at: Date, reason?: string): NotificationWebhookEvent { return { eventId:`${type}-${at.getTime()}`,eventType:type,providerMessageId:'provider',occurredAt:at,...(reason===undefined?{}:{failureReason:reason}) }; }
function sentItem(status: NotificationOutboxItem['status']='SENT'): NotificationOutboxItem { return { ...createTestNotificationItem('um@example.org','state',now),status,providerMessageId:'provider',sentAt:now,updatedAt:now,lastProviderEventAt:now,lastProviderEventType:'email.sent' }; }

describe('semântica de entrega Resend 0.7.1', () => {
  it.each([
    ['reached_daily_quota','DEFERRED','QUOTA'],
    ['rate_limit_exceeded','DEFERRED','QUOTA'],
    ['temporary_provider_unavailable','RETRY_PENDING','TRANSIENT'],
    ['domain_not_verified','FAILED_CONFIGURATION','CONFIGURATION'],
    ['invalid_recipient','FAILED','INVALID_RECIPIENT'],
    ['recipient_suppressed','SUPPRESSED','SUPPRESSION'],
    ['unexpected_failure','FAILED','UNKNOWN'],
  ] as const)('classifica email.failed %s', (reason,status,category) => { expect(classifyResendFailedReason(reason)).toMatchObject({ status, category }); });

  it('DELIVERED + delivery_delayed continua DELIVERED', () => { const item=sentItem('DELIVERED'); const next=applyNotificationWebhookState(item,event('email.delivery_delayed',new Date(now.getTime()+1000))); expect(next.status).toBe('DELIVERED'); });
  it('DELIVERED + sent tardio continua DELIVERED', () => { const item=sentItem('DELIVERED'); const next=applyNotificationWebhookState(item,event('email.sent',new Date(now.getTime()+1000))); expect(next.status).toBe('DELIVERED'); });
  it('COMPLAINED não é apagado por delivered posterior', () => { const item=sentItem('COMPLAINED'); const next=applyNotificationWebhookState(item,event('email.delivered',new Date(now.getTime()+1000))); expect(next.status).toBe('COMPLAINED'); });
  it('BOUNCED não é apagado por sent posterior', () => { const item=sentItem('BOUNCED'); const next=applyNotificationWebhookState(item,event('email.sent',new Date(now.getTime()+1000))); expect(next.status).toBe('BOUNCED'); });
  it('evento com timestamp anterior ao último evento do provider é ignorado', () => { const item={...sentItem('DELIVERED'),lastProviderEventAt:new Date(now.getTime()+5000)}; const next=applyNotificationWebhookState(item,event('email.complained',new Date(now.getTime()+1000))); expect(next.status).toBe('DELIVERED'); });
  it('evento adverso posterior pode tornar DELIVERED em COMPLAINED', () => { const item=sentItem('DELIVERED'); const next=applyNotificationWebhookState(item,event('email.complained',new Date(now.getTime()+1000))); expect(next.status).toBe('COMPLAINED'); });
  it('terminal conflitante usa precedência explícita: COMPLAINED prevalece sobre BOUNCED', () => { const bounced=sentItem('BOUNCED'); const complained=applyNotificationWebhookState(bounced,event('email.complained',new Date(now.getTime()+1000))); expect(complained.status).toBe('COMPLAINED'); const laterBounce=applyNotificationWebhookState(complained,event('email.bounced',new Date(now.getTime()+2000))); expect(laterBounce.status).toBe('COMPLAINED'); });

  it('send accepted → persist success resulta em SENT', async () => { const outbox=new InMemoryNotificationOutboxRepository(); await outbox.enqueue(createTestNotificationItem('um@example.org','accepted',new Date())); const result=await notifications(outbox).processPending(); expect(result.sent).toBe(1); expect(outbox.all()[0]?.status).toBe('SENT'); });
  it('send accepted → markSent falha resulta em DELIVERY_UNCERTAIN', async () => { const outbox=new MarkSentFailsRepository(); await outbox.enqueue(createTestNotificationItem('um@example.org','uncertain',new Date())); const result=await notifications(outbox).processPending(); expect(result.uncertain).toBe(1); expect(outbox.all()[0]?.status).toBe('DELIVERY_UNCERTAIN'); });
  it('lease expirada dentro da janela de idempotência ainda pode ser reivindicada com a mesma janela segura', async () => { const outbox=new InMemoryNotificationOutboxRepository(); const item=createTestNotificationItem('um@example.org','inside',now); await outbox.enqueue(item); const [first]=await outbox.claimEligible(1,'a',now,1000); const [recovered]=await outbox.claimEligible(1,'b',new Date(now.getTime()+1001),1000); expect(first?.idempotencySafeUntil).toBeDefined(); expect(recovered?.idempotencySafeUntil?.getTime()).toBe(first?.idempotencySafeUntil?.getTime()); });
  it('lease expirada após a janela segura vira DELIVERY_UNCERTAIN e não é reenviada', async () => { const outbox=new InMemoryNotificationOutboxRepository(); const item=createTestNotificationItem('um@example.org','outside',now); await outbox.enqueue(item); await outbox.claimEligible(1,'a',now,1000); const later=new Date(now.getTime()+PROVIDER_IDEMPOTENCY_WINDOW_MS+1000); expect(await outbox.claimEligible(1,'b',later,1000)).toHaveLength(0); expect(outbox.all()[0]?.status).toBe('DELIVERY_UNCERTAIN'); });
  it('webhook confirma entrega que estava incerta', async () => { const outbox=new InMemoryNotificationOutboxRepository(); const item=createTestNotificationItem('um@example.org','webhook-uncertain',now); await outbox.enqueue(item); await outbox.claimEligible(1,'a',now,1000); await outbox.markDeliveryUncertain(item.id,'a','provider',now); await outbox.applyWebhook(event('email.delivered',new Date(now.getTime()+1000))); expect(outbox.all()[0]?.status).toBe('DELIVERED'); });
  it('retry administrativo não recoloca DELIVERY_UNCERTAIN, mas pode reabrir falha de configuração por decisão explícita', async () => { const outbox=new InMemoryNotificationOutboxRepository(); const uncertain={...createTestNotificationItem('um@example.org','no-retry-uncertain',now),status:'DELIVERY_UNCERTAIN' as const}; const configFailure={...createTestNotificationItem('dois@example.org','retry-config',now),status:'FAILED_CONFIGURATION' as const}; await outbox.enqueue(uncertain); await outbox.enqueue(configFailure); expect(await outbox.requeue(20,now)).toBe(1); expect(outbox.all().find(item=>item.id===uncertain.id)?.status).toBe('DELIVERY_UNCERTAIN'); expect(outbox.all().find(item=>item.id===configFailure.id)?.status).toBe('PENDING'); });
  it('email.failed de quota não vira SUPPRESSED e mantém categoria segura', async () => { const outbox=new InMemoryNotificationOutboxRepository(); const item=createTestNotificationItem('um@example.org','quota-event',now); await outbox.enqueue(item); await outbox.claimEligible(1,'a',now,1000); await outbox.markSent(item.id,'a','provider',now); await outbox.applyWebhook(event('email.failed',new Date(now.getTime()+1000),'reached_daily_quota')); expect(outbox.all()[0]).toMatchObject({status:'DEFERRED',lastFailureCategory:'QUOTA'}); });
  it('event ID duplicado continua deduplicado', async () => { const outbox=new InMemoryNotificationOutboxRepository(); const item=createTestNotificationItem('um@example.org','dedup',now); await outbox.enqueue(item); await outbox.claimEligible(1,'a',now,1000); await outbox.markSent(item.id,'a','provider',now); const webhook=event('email.delivered',new Date(now.getTime()+1000)); expect(await outbox.applyWebhook(webhook)).toBe('applied'); expect(await outbox.applyWebhook(webhook)).toBe('duplicate'); });
});
