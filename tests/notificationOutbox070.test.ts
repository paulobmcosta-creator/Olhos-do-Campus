// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AuthorizedAdminProfile } from '../src/models/admin';
import type { SystemConfig } from '../src/models/config';
import { createOccurrenceNotificationItems, createTestNotificationItem } from '../server/domain/notificationOutbox';
import type { StoredOccurrence } from '../server/models/occurrenceDomain';
import type { EmailMessage, EmailProvider, EmailSendRequest, EmailSendResult } from '../server/providers/emailProvider';
import { EmailProviderError } from '../server/providers/emailProvider';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { InMemoryNotificationOutboxRepository } from '../server/repositories/notificationOutboxRepository';
import { NotificationService } from '../server/services/notificationService';
import { FakeSystemConfigRepository } from './helpers/fakeRepositories';

const now = new Date('2026-08-18T12:00:00.000Z');
const config: SystemConfig = { institutionDisplayName:'IFES',protocolPrefix:'INF',notificationEmails:['um@example.org','dois@example.org'],emailNotificationsEnabled:true,autoAssignRisk:true,serviceNotice:'' };
const actor:AuthorizedAdminProfile={id:'admin-id',uid:'admin-uid',email:'admin@ifes.edu.br',displayName:'Admin',role:'Administrador',teamIds:[],active:true};
const occurrence:StoredOccurrence={id:'occ-1',schemaVersion:2,protocol:'INF-2026-000001',trackingKeyHash:'hash-ultrassecreto',trackingKeySalt:'salt-ultrassecreto',reportedCategoryId:'cat',reportedCategoryNameSnapshot:'Iluminação',categoryId:'cat',categoryNameSnapshot:'Iluminação',reportedLocation:{campusName:'IFES',buildingName:'Bloco 1',floor:'',room:'Sala 1'},location:{campusName:'IFES',buildingName:'Bloco 1',floor:'',room:'Sala 1'},description:'Descrição completa que não deve ir por e-mail.',immediateRisk:false,status:'Recebida',priority:'Normal',priorityRank:4,createdAt:now,updatedAt:now,version:1,dataClassification:'REAL',reopenedCount:0,hasPhoto:false,searchTokens:[]};

class FakeEmailProvider implements EmailProvider {
  public readonly name='resend' as const;
  public readonly deliveries:Array<{message:EmailMessage;key:string;notificationId:string}>=[];
  public failure:unknown;
  public send(request:EmailSendRequest):Promise<EmailSendResult>{if(this.failure!==undefined)return Promise.reject(this.failure instanceof Error?this.failure:new Error('provider failure'));this.deliveries.push({message:structuredClone(request.message),key:request.idempotencyKey,notificationId:request.notificationId});return Promise.resolve({providerMessageId:`provider-${this.deliveries.length}`});}
  public verifyWebhook(payload:string,headers:{id:string;timestamp:string;signature:string},_secret:string):unknown{void _secret;if(headers.signature!=='valid')throw new Error('invalid');return JSON.parse(payload) as unknown;}
}

function service(outbox:InMemoryNotificationOutboxRepository,provider:FakeEmailProvider|undefined,systemConfig:SystemConfig=config):NotificationService{return new NotificationService(outbox,new FakeSystemConfigRepository(systemConfig),new InMemoryAuditLogRepository(),provider,{enabled:true,from:'Sistema <sistema@example.org>',webhookSecret:'whsec-placeholder'});}

describe('outbox transacional e Resend 0.7.0',()=>{
  it('gera identidade determinística, hash e idempotency key sem duplicidade',async()=>{const outbox=new InMemoryNotificationOutboxRepository();const [first]=createOccurrenceNotificationItems(occurrence,['UM@example.org'],now);const [again]=createOccurrenceNotificationItems(occurrence,['um@example.org'],now);expect(first?.id).toBe(again?.id);expect(first?.idempotencyKey).toBe(again?.idempotencyKey);expect(first?.id).not.toContain('um@example.org');await outbox.enqueue(first!);await outbox.enqueue(again!);expect(outbox.all()).toHaveLength(1);});

  it('cria uma entrega independente por destinatário sem expor a lista',async()=>{const outbox=new InMemoryNotificationOutboxRepository(),provider=new FakeEmailProvider();for(const item of createOccurrenceNotificationItems(occurrence,config.notificationEmails,now))await outbox.enqueue(item);await service(outbox,provider).processPending(20);expect(provider.deliveries).toHaveLength(2);expect(provider.deliveries.map(x=>x.message.to).sort()).toEqual([...config.notificationEmails].sort());for(const delivery of provider.deliveries){const other=delivery.message.to==='um@example.org'?'dois@example.org':'um@example.org';expect(JSON.stringify(delivery.message)).not.toContain(other);}});

  it('minimiza payload e não inclui tracking key, hash, salt, descrição, foto ou IP',async()=>{const outbox=new InMemoryNotificationOutboxRepository(),provider=new FakeEmailProvider();await outbox.enqueue(createOccurrenceNotificationItems(occurrence,['um@example.org'],now)[0]!);await service(outbox,provider).processPending();const payload=JSON.stringify(provider.deliveries[0]);for(const forbidden of ['hash-ultrassecreto','salt-ultrassecreto',occurrence.description,'trackingKey','fotografia','127.0.0.1'])expect(payload).not.toContain(forbidden);});

  it('não gera notificação para TEST e gera para REAL quando há destinatários habilitados',()=>{expect(createOccurrenceNotificationItems({...occurrence,dataClassification:'TEST'},config.notificationEmails,now)).toEqual([]);expect(createOccurrenceNotificationItems(occurrence,config.notificationEmails,now)).toHaveLength(2);});

  it('impede claim concorrente e recupera lease expirado',async()=>{const outbox=new InMemoryNotificationOutboxRepository();await outbox.enqueue(createOccurrenceNotificationItems(occurrence,['um@example.org'],now)[0]!);expect(await outbox.claimEligible(1,'worker-a',now,1_000)).toHaveLength(1);expect(await outbox.claimEligible(1,'worker-b',now,1_000)).toHaveLength(0);expect(await outbox.claimEligible(1,'worker-b',new Date(now.getTime()+1_001),1_000)).toHaveLength(1);});

  it.each([
    ['transitório',new EmailProviderError('TRANSIENT','timeout','Falha transitória.'),'RETRY_PENDING'],
    ['quota',new EmailProviderError('QUOTA','rate_limit','Cota excedida.'),'DEFERRED'],
    ['permanente',new EmailProviderError('PERMANENT','invalid','Destinatário inválido.'),'FAILED'],
    ['suprimido',new EmailProviderError('SUPPRESSED','bounce','Destinatário suprimido.'),'SUPPRESSED'],
  ] as const)('classifica erro %s e preserva a entrega',async(_label,error,status)=>{const outbox=new InMemoryNotificationOutboxRepository(),provider=new FakeEmailProvider();provider.failure=error;await outbox.enqueue(createOccurrenceNotificationItems(occurrence,['um@example.org'],new Date())[0]!);await service(outbox,provider).processPending();expect(outbox.all()[0]).toMatchObject({status,attemptCount:1});expect(outbox.all()[0]?.lastErrorSummary).not.toContain(' at ');});

  it('ausência de configuração posterga com erro seguro',async()=>{const outbox=new InMemoryNotificationOutboxRepository();await outbox.enqueue(createOccurrenceNotificationItems(occurrence,['um@example.org'],new Date())[0]!);const result=await service(outbox,undefined).processPending();expect(result.failed).toBe(1);expect(outbox.all()[0]?.status).toBe('FAILED_CONFIGURATION');});

  it('emailNotificationsEnabled=false não reivindica nem envia itens',async()=>{const outbox=new InMemoryNotificationOutboxRepository(),provider=new FakeEmailProvider();await outbox.enqueue(createOccurrenceNotificationItems(occurrence,['um@example.org'],new Date())[0]!);const result=await service(outbox,provider,{...config,emailNotificationsEnabled:false}).processPending();expect(result.claimed).toBe(0);expect(provider.deliveries).toHaveLength(0);expect(outbox.all()[0]?.status).toBe('PENDING');});

  it('teste administrativo usa a mesma outbox, é determinístico por solicitação e auditável',async()=>{const outbox=new InMemoryNotificationOutboxRepository();const notifications=service(outbox,new FakeEmailProvider());const first=await notifications.requestTest('um@example.org',actor,'request-1');const duplicate=await notifications.requestTest('UM@example.org',actor,'request-1');expect(first.id).toBe(duplicate.id);expect(outbox.all()).toHaveLength(1);expect(first.eventType).toBe('ADMIN_TEST');});

  it('requeue limitado não inclui delivered, bounced ou complained',async()=>{const outbox=new InMemoryNotificationOutboxRepository();const item=createTestNotificationItem('um@example.org','retry',now);await outbox.enqueue(item);const [claim]=await outbox.claimEligible(1,'owner',now,1_000);await outbox.markSent(item.id,'owner','provider-retry',now);await outbox.applyWebhook({eventId:'evt-delivered',eventType:'email.delivered',providerMessageId:'provider-retry',occurredAt:now});expect(await outbox.requeue(20,now)).toBe(0);expect(claim).toBeDefined();});

  it.each([['email.delivered','DELIVERED'],['email.bounced','BOUNCED'],['email.complained','COMPLAINED']] as const)('valida webhook %s, atualiza status e deduplica',async(eventType,status)=>{const outbox=new InMemoryNotificationOutboxRepository(),provider=new FakeEmailProvider(),notifications=service(outbox,provider);const item=createTestNotificationItem('um@example.org',eventType,now);await outbox.enqueue(item);await outbox.claimEligible(1,'owner',now,1_000);await outbox.markSent(item.id,'owner',`provider-${eventType}`,now);const body=Buffer.from(JSON.stringify({type:eventType,created_at:now.toISOString(),data:{email_id:`provider-${eventType}`}}));const headers={id:`event-${eventType}`,timestamp:'1755518400',signature:'valid'};expect(await notifications.processWebhook(body,headers)).toBe('applied');expect(outbox.all()[0]?.status).toBe(status);expect(await notifications.processWebhook(body,headers)).toBe('duplicate');});

  it('não reenvia automaticamente mensagem aceita quando o provider informa delivery_delayed',async()=>{const outbox=new InMemoryNotificationOutboxRepository(),provider=new FakeEmailProvider(),notifications=service(outbox,provider);const item=createTestNotificationItem('um@example.org','delayed',now);await outbox.enqueue(item);await outbox.claimEligible(1,'owner',now,1_000);await outbox.markSent(item.id,'owner','provider-delayed',now);const body=Buffer.from(JSON.stringify({type:'email.delivery_delayed',created_at:now.toISOString(),data:{email_id:'provider-delayed'}}));await notifications.processWebhook(body,{id:'event-delayed',timestamp:'1755518400',signature:'valid'});expect(outbox.all()[0]?.status).toBe('SENT');expect(await outbox.claimEligible(1,'retry',new Date(now.getTime()+86_400_000),1_000)).toHaveLength(0);});

  it('rejeita webhook com assinatura inválida sem persistir evento',async()=>{const notifications=service(new InMemoryNotificationOutboxRepository(),new FakeEmailProvider());await expect(notifications.processWebhook(Buffer.from('{}'),{id:'evt',timestamp:'1',signature:'invalid'})).rejects.toMatchObject({code:'WEBHOOK_SIGNATURE_INVALID'});});
});
