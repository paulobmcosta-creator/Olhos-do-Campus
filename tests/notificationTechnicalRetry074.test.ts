// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SystemConfig } from '../src/models/config';
import { createTestNotificationItem } from '../server/domain/notificationOutbox';
import type { NotificationWebhookEvent } from '../server/models/notificationDomain';
import type { EmailProvider, EmailSendRequest, EmailSendResult } from '../server/providers/emailProvider';
import { EmailProviderError } from '../server/providers/emailProvider';
import { classifyResendError } from '../server/providers/resendEmailProvider';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { MAX_TECHNICAL_RETRIES, InMemoryNotificationOutboxRepository } from '../server/repositories/notificationOutboxRepository';
import { NotificationService } from '../server/services/notificationService';
import { FakeSystemConfigRepository } from './helpers/fakeRepositories';

const base = new Date('2026-08-19T03:00:00.000Z');
const config: SystemConfig = { institutionDisplayName:'IFES',protocolPrefix:'INF',notificationEmails:['um@example.org'],emailNotificationsEnabled:true,autoAssignRisk:true,serviceNotice:'' };

type FailureKind = 'concurrent' | 'server500' | 'quota' | 'confirmedRetryable' | 'timeout' | 'success';

class RetryFakeProvider implements EmailProvider {
  public readonly name = 'resend' as const;
  public readonly requests: EmailSendRequest[] = [];
  public constructor(private readonly failures: FailureKind[]) {}
  public send(request: EmailSendRequest): Promise<EmailSendResult> {
    this.requests.push(structuredClone(request));
    const kind = this.failures.shift() ?? 'success';
    if (kind === 'concurrent') return Promise.reject(classifyResendError({ name:'concurrent_idempotent_requests',statusCode:409,message:'Same idempotency key is still in progress.' }));
    if (kind === 'server500') return Promise.reject(classifyResendError({ name:'internal_server_error',statusCode:500,message:'Unexpected provider error.' }));
    if (kind === 'quota') return Promise.reject(classifyResendError({ name:'rate_limit_exceeded',statusCode:429,message:'Too many requests.' }));
    if (kind === 'confirmedRetryable') return Promise.reject(new EmailProviderError('TRANSIENT','confirmed_retryable','O provedor confirmou falha retryable sem aceite.','NEW_ATTEMPT','PROVIDER_REJECTED'));
    if (kind === 'timeout') return Promise.reject(new Error('socket timeout'));
    return Promise.resolve({ providerMessageId:`P${this.requests.length}` });
  }
  public verifyWebhook(payload:string,_headers:{id:string;timestamp:string;signature:string},_secret:string):unknown { void _headers; void _secret; return JSON.parse(payload) as unknown; }
}

function service(outbox:InMemoryNotificationOutboxRepository,provider:EmailProvider):NotificationService {
  return new NotificationService(outbox,new FakeSystemConfigRepository(config),new InMemoryAuditLogRepository(),provider,{enabled:true,from:'Sistema <sistema@example.org>',webhookSecret:'placeholder'});
}

function delivered(notificationId:string,attemptId:string,providerMessageId='P1'):NotificationWebhookEvent {
  return { eventId:`evt-${attemptId}`,eventType:'email.delivered',providerMessageId,notificationId,attemptId,occurredAt:new Date(base.getTime()+60_000) };
}

async function seed(outbox:InMemoryNotificationOutboxRepository,key:string) {
  const item=createTestNotificationItem('um@example.org',key,base); await outbox.enqueue(item); return item;
}

describe('retry técnico da mesma DeliveryAttempt — 0.7.4',()=>{
  it('classifica concurrent_idempotent_requests, 5xx e quota sem promover nova tentativa',()=>{
    const concurrent=classifyResendError({name:'concurrent_idempotent_requests',statusCode:409,message:'still processing'});
    const server=classifyResendError({name:'internal_server_error',statusCode:500,message:'unexpected'});
    const quota=classifyResendError({name:'rate_limit_exceeded',statusCode:429,message:'too many requests'});
    expect(concurrent).toMatchObject({category:'TRANSIENT',retryMode:'SAME_ATTEMPT',retrySafety:'IDEMPOTENCY_WINDOW'});
    expect(server).toMatchObject({category:'TRANSIENT',retryMode:'SAME_ATTEMPT',retrySafety:'IDEMPOTENCY_WINDOW'});
    expect(quota).toMatchObject({category:'QUOTA',retryMode:'SAME_ATTEMPT',retrySafety:'PROVIDER_REJECTED'});
  });

  it('concurrent_idempotent_requests preserva A1/K1 e attemptCount durante o backoff',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository(),provider=new RetryFakeProvider(['concurrent']);const item=await seed(outbox,'concurrent-074');
    const result=await service(outbox,provider).processPending();expect(result.deferred).toBe(1);
    const pending=outbox.all()[0]!;const attempt=outbox.attempts()[0]!;
    expect(pending).toMatchObject({id:item.id,status:'RETRY_PENDING',attemptCount:1,currentAttemptId:attempt.id,retryMode:'SAME_ATTEMPT'});
    expect(attempt).toMatchObject({status:'RETRY_PENDING',attemptNumber:1,technicalRetryCount:1,retryMode:'SAME_ATTEMPT'});
    const k1=attempt.idempotencyKey,a1=attempt.id;
    const [[winner],[loser]]=await Promise.all([outbox.claimEligible(1,'w1',new Date(pending.nextAttemptAt.getTime()+1),60_000),outbox.claimEligible(1,'w2',new Date(pending.nextAttemptAt.getTime()+1),60_000)]);
    expect([winner,loser].filter(Boolean)).toHaveLength(1);const resumed=winner??loser!;
    expect(resumed.currentAttemptId).toBe(a1);expect(resumed.idempotencyKey).toBe(k1);expect(resumed.attemptCount).toBe(1);expect(outbox.attempts()).toHaveLength(1);
  });

  it('HTTP 500 ambíguo reutiliza A1/K1; timeout de transporte permanece UNCERTAIN sem A2',async()=>{
    const first=new InMemoryNotificationOutboxRepository(),p500=new RetryFakeProvider(['server500']);await seed(first,'500-074');await service(first,p500).processPending();
    const pending=first.all()[0]!,a1=first.attempts()[0]!;const [resume]=await first.claimEligible(1,'again',new Date(pending.nextAttemptAt.getTime()+1),60_000);
    expect(resume).toMatchObject({currentAttemptId:a1.id,idempotencyKey:a1.idempotencyKey,attemptCount:1});expect(first.attempts()).toHaveLength(1);

    const second=new InMemoryNotificationOutboxRepository(),timeout=new RetryFakeProvider(['timeout']);await seed(second,'timeout-074');const result=await service(second,timeout).processPending();
    expect(result.uncertain).toBe(1);expect(second.all()[0]?.status).toBe('DELIVERY_UNCERTAIN');expect(second.attempts()).toHaveLength(1);expect(second.attempts()[0]?.status).toBe('UNCERTAIN');
  });

  it('falha confirmada retryable encerra A1 e autoriza nova A2/K2',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository(),provider=new RetryFakeProvider(['confirmedRetryable']);await seed(outbox,'new-attempt-074');await service(outbox,provider).processPending();
    const retry=outbox.all()[0]!,a1=outbox.attempts()[0]!;expect(retry).toMatchObject({status:'RETRY_PENDING',attemptCount:1,retryMode:'NEW_ATTEMPT'});expect(a1.status).toBe('FAILED');
    const [a2Claim]=await outbox.claimEligible(1,'next',new Date(retry.nextAttemptAt.getTime()+1),60_000);const attempts=outbox.attempts().sort((a,b)=>a.attemptNumber-b.attemptNumber);
    expect(attempts).toHaveLength(2);expect(a2Claim?.attemptCount).toBe(2);expect(attempts[1]?.id).not.toBe(attempts[0]?.id);expect(attempts[1]?.idempotencyKey).not.toBe(attempts[0]?.idempotencyKey);
  });

  it('technicalRetryCount cresce sem alterar attemptNumber/attemptCount e possui limite seguro',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository();const item=await seed(outbox,'counter-074');let [claim]=await outbox.claimEligible(1,'owner-0',base,60_000);const a1=claim!.currentAttemptId!,k1=claim!.idempotencyKey;
    for(let n=1;n<=MAX_TECHNICAL_RETRIES;n+=1){
      const at=new Date(base.getTime()+n*1_000);const status=await outbox.markFailure(item.id,`owner-${n-1}`,{status:'RETRY_PENDING',nextAttemptAt:at,code:'concurrent_idempotent_requests',summary:'Ainda em processamento.',category:'TRANSIENT',retryMode:'SAME_ATTEMPT',retrySafety:'IDEMPOTENCY_WINDOW'},at,a1);
      expect(status).toBe('RETRY_PENDING');const pending=outbox.all()[0]!;expect(pending.attemptCount).toBe(1);expect(outbox.attempts()[0]).toMatchObject({id:a1,idempotencyKey:k1,attemptNumber:1,technicalRetryCount:n});
      [claim]=await outbox.claimEligible(1,`owner-${n}`,new Date(pending.nextAttemptAt.getTime()+1),60_000);expect(claim?.currentAttemptId).toBe(a1);
    }
    const lastAt=new Date(base.getTime()+100_000);expect(await outbox.markFailure(item.id,`owner-${MAX_TECHNICAL_RETRIES}`,{status:'RETRY_PENDING',nextAttemptAt:lastAt,code:'concurrent_idempotent_requests',summary:'Ainda em processamento.',category:'TRANSIENT',retryMode:'SAME_ATTEMPT',retrySafety:'IDEMPOTENCY_WINDOW'},lastAt,a1)).toBe('DELIVERY_UNCERTAIN');
    expect(outbox.all()[0]?.status).toBe('DELIVERY_UNCERTAIN');expect(outbox.attempts()).toHaveLength(1);
  });

  it('webhook durante backoff resolve A1 e cancela o retry técnico sem inflar consumo',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository(),provider=new RetryFakeProvider(['concurrent']);const item=await seed(outbox,'webhook-backoff-074');await service(outbox,provider).processPending();
    const pending=outbox.all()[0]!,a1=outbox.attempts()[0]!;expect(await outbox.applyWebhook(delivered(item.id,a1.id,'P1'),new Date(base.getTime()+60_000))).toBe('applied');
    expect(outbox.all()[0]?.status).toBe('DELIVERED');expect(outbox.attempts()[0]).toMatchObject({status:'DELIVERED',providerMessageId:'P1'});
    expect((await outbox.claimEligible(1,'late',new Date(pending.nextAttemptAt.getTime()+1),60_000))).toHaveLength(0);const metrics=await outbox.metrics(new Date(base.getTime()+120_000));expect(metrics.acceptedTotal).toBe(1);expect(metrics.attemptsStarted).toBe(1);expect(metrics.retries).toBe(0);
  });

  it('duas chamadas técnicas A1/K1 contam uma única tentativa aceita quando a repetição idempotente sucede',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository(),provider=new RetryFakeProvider(['concurrent','success']);const item=await seed(outbox,'consumption-074');
    const first=await service(outbox,provider).processPending();expect(first.deferred).toBe(1);const a1=outbox.attempts()[0]!;
    await outbox.requeue(1,new Date(0));const second=await service(outbox,provider).processPending();expect(second.sent).toBe(1);
    expect(provider.requests).toHaveLength(2);expect(provider.requests[0]?.attemptId).toBe(a1.id);expect(provider.requests[1]?.attemptId).toBe(a1.id);
    expect(provider.requests[0]?.idempotencyKey).toBe(a1.idempotencyKey);expect(provider.requests[1]?.idempotencyKey).toBe(a1.idempotencyKey);
    expect(outbox.attempts()).toHaveLength(1);expect(outbox.all()[0]).toMatchObject({id:item.id,attemptCount:1,status:'SENT'});
    const metrics=await outbox.metrics(new Date());expect(metrics.attemptsStarted).toBe(1);expect(metrics.acceptedTotal).toBe(1);expect(metrics.retries).toBe(0);
  });

  it('rate limit/quota diferido reutiliza A1 e não incrementa tentativas enquanto indisponível',async()=>{
    const outbox=new InMemoryNotificationOutboxRepository(),provider=new RetryFakeProvider(['quota']);await seed(outbox,'quota-074');await service(outbox,provider).processPending();const pending=outbox.all()[0]!,a1=outbox.attempts()[0]!;
    expect(pending).toMatchObject({status:'DEFERRED',attemptCount:1,currentAttemptId:a1.id,retryMode:'SAME_ATTEMPT',retrySafety:'PROVIDER_REJECTED'});
    const [resume]=await outbox.claimEligible(1,'quota-retry',new Date(pending.nextAttemptAt.getTime()+1),60_000);expect(resume).toMatchObject({attemptCount:1,currentAttemptId:a1.id,idempotencyKey:a1.idempotencyKey});expect(outbox.attempts()).toHaveLength(1);
  });
});
