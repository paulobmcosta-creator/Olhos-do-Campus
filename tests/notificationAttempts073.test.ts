// @vitest-environment node
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

const now = new Date('2026-08-19T03:00:00.000Z');
const config: SystemConfig = { institutionDisplayName:'IFES',protocolPrefix:'INF',notificationEmails:['um@example.org'],emailNotificationsEnabled:true,autoAssignRisk:true,serviceNotice:'' };

class CapturingProvider implements EmailProvider {
  public readonly name = 'resend' as const;
  public readonly requests: EmailSendRequest[] = [];
  public send(request: EmailSendRequest): Promise<EmailSendResult> { this.requests.push(structuredClone(request)); return Promise.resolve({ providerMessageId:`P${this.requests.length}` }); }
  public verifyWebhook(payload:string,_headers:{id:string;timestamp:string;signature:string},_secret:string):unknown { void _headers; void _secret; return JSON.parse(payload) as unknown; }
}

function service(outbox:InMemoryNotificationOutboxRepository,provider:EmailProvider=new CapturingProvider()):NotificationService {
  return new NotificationService(outbox,new FakeSystemConfigRepository(config),new InMemoryAuditLogRepository(),provider,{enabled:true,from:'Sistema <sistema@example.org>',webhookSecret:'placeholder'});
}

function event(notificationId:string|undefined,attemptId:string|undefined,providerMessageId:string,type:NotificationWebhookEvent['eventType']='email.delivered',eventId=`evt-${providerMessageId}-${type}`,at=new Date(now.getTime()+1_000),reason?:string):NotificationWebhookEvent {
  return { eventId,eventType:type,providerMessageId,...(notificationId===undefined?{}:{notificationId}),...(attemptId===undefined?{}:{attemptId}),occurredAt:at,...(reason===undefined?{}:{failureReason:reason}) };
}

async function firstAccepted(outbox:InMemoryNotificationOutboxRepository,key:string):Promise<{itemId:string;attemptId:string}> {
  const item=createTestNotificationItem('um@example.org',key,now); await outbox.enqueue(item);
  const [claimed]=await outbox.claimEligible(1,'worker-a',now,1_000); expect(claimed?.currentAttemptId).toBeDefined();
  const attemptId=claimed!.currentAttemptId!; await outbox.markSent(item.id,'worker-a','P1',now,attemptId);
  return {itemId:item.id,attemptId};
}

async function makeSecondAttempt(outbox:InMemoryNotificationOutboxRepository,key:string):Promise<{itemId:string;a1:string;a2:string;k1:string;k2:string}> {
  const {itemId,attemptId:a1}=await firstAccepted(outbox,key);
  await outbox.applyWebhook(event(itemId,a1,'P1','email.failed','evt-a1-retry',new Date(now.getTime()+1_000),'temporary_provider_unavailable'),new Date(now.getTime()+1_000));
  const retryAt=new Date(now.getTime()+86_500_000);
  const [second]=await outbox.claimEligible(1,'worker-b',retryAt,60_000);
  expect(second?.currentAttemptId).toBeDefined();
  const attempts=outbox.attempts().sort((a,b)=>a.attemptNumber-b.attemptNumber);
  return { itemId,a1,a2:second!.currentAttemptId!,k1:attempts[0]!.idempotencyKey,k2:attempts[1]!.idempotencyKey };
}

describe('delivery attempts e correlação attempt-aware 0.7.3',()=>{
  it('primeiro envio materializa attempt antes do provider e leva notification_id + attempt_id sem PII',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository(),provider=new CapturingProvider();const item=createTestNotificationItem('pessoa@example.org','tags-073',now);await outbox.enqueue(item);await service(outbox,provider).processPending();
    expect(outbox.attempts()).toHaveLength(1);expect(provider.requests).toHaveLength(1);const request=provider.requests[0]!;expect(request.notificationId).toBe(item.id);expect(request.attemptId).toBe(outbox.attempts()[0]?.id);expect(request.idempotencyKey).toBe(outbox.attempts()[0]?.idempotencyKey);
    expect(resendNotificationTags(request.notificationId,request.attemptId)).toEqual([{name:RESEND_NOTIFICATION_TAG_NAME,value:item.id},{name:RESEND_ATTEMPT_TAG_NAME,value:request.attemptId}]);expect(JSON.stringify(request)).not.toContain('trackingKey');
  });

  it('A2 é criada antes do send, usa novo attempt_id/K2 e P1 não conflita com webhook rápido P2',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const {itemId,a1,a2,k1,k2}=await makeSecondAttempt(outbox,'retry-p2');expect(a2).not.toBe(a1);expect(k2).not.toBe(k1);expect(outbox.all()[0]).toMatchObject({currentAttemptId:a2,providerMessageId:'P1',status:'PROCESSING'});
    expect(await outbox.applyWebhook(event(itemId,a2,'P2','email.delivered','evt-fast-p2'),new Date(now.getTime()+86_501_000))).toBe('applied');expect(outbox.all()[0]).toMatchObject({status:'DELIVERED',providerMessageId:'P2'});expect(outbox.attempts().find(a=>a.id===a2)).toMatchObject({status:'DELIVERED',providerMessageId:'P2'});
    await outbox.markSent(itemId,'worker-b','P2',new Date(now.getTime()+86_502_000),a2);expect(outbox.all()[0]?.status).toBe('DELIVERED');
  });

  it('webhook tardio de A1 atualiza seu histórico mas não rebaixa A2 DELIVERED',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const {itemId,a1,a2}=await makeSecondAttempt(outbox,'late-a1');await outbox.applyWebhook(event(itemId,a2,'P2','email.delivered','evt-a2-delivered'),new Date(now.getTime()+86_501_000));
    expect(await outbox.applyWebhook(event(itemId,a1,'P1','email.bounced','evt-late-a1',new Date(now.getTime()+86_600_000)),new Date(now.getTime()+86_600_000))).toBe('applied');expect(outbox.attempts().find(a=>a.id===a1)?.status).toBe('BOUNCED');expect(outbox.all()[0]?.status).toBe('DELIVERED');
  });

  it('providerMessageId local ausente pode ser estabelecido pelo webhook da mesma attempt; divergência na mesma attempt é conflito real',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const item=createTestNotificationItem('um@example.org','same-attempt',now);await outbox.enqueue(item);const [claim]=await outbox.claimEligible(1,'owner',now,60_000);const a1=claim!.currentAttemptId!;
    expect(await outbox.applyWebhook(event(item.id,a1,'P1','email.sent','evt-establish'),now)).toBe('applied');expect(outbox.attempts()[0]?.providerMessageId).toBe('P1');expect(await outbox.applyWebhook(event(item.id,a1,'P2','email.delivered','evt-conflict',new Date(now.getTime()+2_000)),new Date(now.getTime()+2_000))).toBe('inconsistent');expect(outbox.attempts()[0]?.providerMessageId).toBe('P1');
  });

  it('providerMessageId correlaciona tentativa sem tags e attempt_id inexistente pode cair no fallback seguro do provider',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const {itemId,attemptId}=await firstAccepted(outbox,'provider-fallback-073');expect(await outbox.applyWebhook(event(undefined,undefined,'P1','email.delivered','evt-provider-only'))).toBe('applied');expect(outbox.attempts().find(a=>a.id===attemptId)?.status).toBe('DELIVERED');
    const nonexistent='f'.repeat(64);expect(await outbox.applyWebhook(event(itemId,nonexistent,'P1','email.delivered','evt-bogus-attempt',new Date(now.getTime()+2_000)),new Date(now.getTime()+2_000))).toBe('applied');
  });

  it('attempt_id pertencente a outra notification não atualiza entrega errada',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const one=createTestNotificationItem('um@example.org','one',now),two=createTestNotificationItem('dois@example.org','two',now);await outbox.enqueue(one);await outbox.enqueue(two);const claims=await outbox.claimEligible(2,'owner',now,60_000);const aOne=claims.find(x=>x.id===one.id)!.currentAttemptId!,aTwo=claims.find(x=>x.id===two.id)!.currentAttemptId!;await outbox.markSent(two.id,'owner','P2',now,aTwo);
    expect(await outbox.applyWebhook(event(one.id,aTwo,'P2','email.delivered','evt-cross'))).toBe('inconsistent');expect(outbox.all().find(x=>x.id===one.id)?.status).toBe('PROCESSING');expect(outbox.attempts().find(x=>x.id===aOne)?.status).toBe('PROCESSING');
  });

  it('retry técnico da mesma lease usa A1/K1; retry lógico posterior cria A2/K2; claims concorrentes não duplicam tentativa',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const item=createTestNotificationItem('um@example.org','idempotency',now);await outbox.enqueue(item);const [[first],[concurrent]]=await Promise.all([outbox.claimEligible(1,'a',now,1_000),outbox.claimEligible(1,'b',now,1_000)]);expect([first,concurrent].filter(Boolean)).toHaveLength(1);const claimed=first??concurrent!;const a1=claimed.currentAttemptId!,k1=claimed.idempotencyKey;const [recovered]=await outbox.claimEligible(1,'c',new Date(now.getTime()+1_001),1_000);expect(recovered?.currentAttemptId).toBe(a1);expect(recovered?.idempotencyKey).toBe(k1);expect(outbox.attempts()).toHaveLength(1);
    await outbox.markFailure(item.id,'c',{status:'RETRY_PENDING',nextAttemptAt:new Date(now.getTime()+2_000),code:'temporary',summary:'Falha transitória.',category:'TRANSIENT'},new Date(now.getTime()+1_100),a1);const [second]=await outbox.claimEligible(1,'d',new Date(now.getTime()+2_001),1_000);expect(second?.currentAttemptId).not.toBe(a1);expect(second?.idempotencyKey).not.toBe(k1);expect(outbox.attempts()).toHaveLength(2);
  });

  it('consumo é por tentativa aceita: A1=1, A2 não aceita mantém 1, A2 aceita vira 2 e delivered/replay não incrementam',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const {itemId,a1,a2}=await makeSecondAttempt(outbox,'metrics-attempts');let metrics=await outbox.metrics(new Date(now.getTime()+86_500_001));expect(metrics.acceptedTotal).toBe(1);expect(metrics.attemptsAccepted).toBe(1);expect(metrics.retries).toBe(1);
    await outbox.markSent(itemId,'worker-b','P2',new Date(now.getTime()+86_501_000),a2);metrics=await outbox.metrics(new Date(now.getTime()+86_501_001));expect(metrics.acceptedTotal).toBe(2);const delivered=event(itemId,a2,'P2','email.delivered','evt-metric-delivered',new Date(now.getTime()+86_502_000));await outbox.applyWebhook(delivered);await outbox.applyWebhook(delivered);metrics=await outbox.metrics(new Date(now.getTime()+86_503_000));expect(metrics.acceptedTotal).toBe(2);expect(metrics.attemptsDelivered).toBe(1);expect(outbox.attempts().find(a=>a.id===a1)?.providerAcceptedAt).toBeDefined();
  });

  it('failed pré-aceite não conta consumo e uncertain com aceite confirmado conta uma unidade',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const failed=createTestNotificationItem('um@example.org','preaccept-failed',now),uncertain=createTestNotificationItem('dois@example.org','accepted-uncertain',now);await outbox.enqueue(failed);await outbox.enqueue(uncertain);const claims=await outbox.claimEligible(2,'owner',now,60_000);const f=claims.find(x=>x.id===failed.id)!,u=claims.find(x=>x.id===uncertain.id)!;await outbox.markFailure(f.id,'owner',{status:'RETRY_PENDING',nextAttemptAt:new Date(now.getTime()+60_000),code:'timeout',summary:'Falha transitória.',category:'TRANSIENT'},now,f.currentAttemptId);await outbox.markDeliveryUncertain(u.id,'owner','PU',now,u.currentAttemptId);const metrics=await outbox.metrics(new Date(now.getTime()+1_000));expect(metrics.acceptedTotal).toBe(1);expect(outbox.attempts().find(a=>a.id===f.currentAttemptId)?.providerAcceptedAt).toBeUndefined();expect(outbox.attempts().find(a=>a.id===u.currentAttemptId)?.providerAcceptedAt).toBeDefined();
  });

  it('documento legado 0.7.2 sem attempts e webhook sem attempt_id/provider legado continuam compatíveis',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const fresh=createTestNotificationItem('um@example.org','legacy-072',now);const legacy={...fresh,schemaVersion:1 as const,currentAttemptId:undefined,status:'SENT' as const,attemptCount:1,providerMessageId:'LEGACY-P',providerAcceptedAt:now,sentAt:now};await outbox.enqueue(legacy);expect(await outbox.applyWebhook(event(undefined,undefined,'LEGACY-P','email.delivered','evt-legacy-073'))).toBe('applied');expect(outbox.all()[0]?.status).toBe('DELIVERED');expect(outbox.attempts()).toHaveLength(0);
  });

  it('erro de transporte sem resposta conclusiva deixa a mesma attempt UNCERTAIN sem contar aceite nem criar retry automático',async()=>{
    class TransportFailureProvider extends CapturingProvider { public override send(request:EmailSendRequest):Promise<EmailSendResult>{this.requests.push(structuredClone(request));return Promise.reject(new Error('socket reset'));} }
    const outbox=new InMemoryNotificationOutboxRepository();const provider=new TransportFailureProvider();const item=createTestNotificationItem('um@example.org','transport-uncertain',now);await outbox.enqueue(item);const result=await service(outbox,provider).processPending();
    expect(result.uncertain).toBe(1);expect(outbox.attempts()).toHaveLength(1);expect(outbox.attempts()[0]).toMatchObject({status:'UNCERTAIN'});expect(outbox.attempts()[0]?.providerAcceptedAt).toBeUndefined();expect(outbox.all()[0]?.status).toBe('DELIVERY_UNCERTAIN');expect((await outbox.metrics(new Date(now.getTime()+1_000))).acceptedTotal).toBe(0);expect((await outbox.claimEligible(1,'other',new Date(now.getTime()+60_000),1_000))).toHaveLength(0);
  });

  it('aceite legado 0.7.2 é preservado ao materializar lazy a tentativa histórica antes de um retry 0.7.3',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const base=createTestNotificationItem('um@example.org','legacy-retry-073',now);const legacy={...base,schemaVersion:1 as const,status:'RETRY_PENDING' as const,attemptCount:1,providerMessageId:'LEGACY-P1',providerAcceptedAt:now,sentAt:now,nextAttemptAt:new Date(now.getTime()+1_000),lastAttemptAt:now,lastFailureCategory:'TRANSIENT' as const,lastErrorCode:'temporary',lastErrorSummary:'Falha transitória.'};await outbox.enqueue(legacy);
    expect((await outbox.metrics(now)).acceptedTotal).toBe(1);const [claim]=await outbox.claimEligible(1,'worker-new',new Date(now.getTime()+1_001),60_000);expect(claim?.schemaVersion).toBe(2);const attempts=outbox.attempts().sort((a,b)=>a.attemptNumber-b.attemptNumber);expect(attempts).toHaveLength(2);expect(attempts[0]).toMatchObject({attemptNumber:1,providerMessageId:'LEGACY-P1'});expect(attempts[0]?.providerAcceptedAt).toBeDefined();expect(attempts[1]?.attemptNumber).toBe(2);expect((await outbox.metrics(new Date(now.getTime()+1_002))).acceptedTotal).toBe(1);
  });

});
