import { randomUUID } from 'node:crypto';
import type { AuthorizedAdminProfile } from '../../src/models/admin';
import { isAdminRole } from '../../src/models/admin';
import type { CategoryItem } from '../../src/models/config';
import { zonedLocalToDate, type BusinessTimePolicy } from '../domain/businessTime';
import { createResponsibleAssignedNotificationItem, createTeamRoutedNotificationItem } from '../domain/notificationOutbox';
import type {
  AddResolutionPhotosInput, CreateOccurrenceInput, CreateOccurrenceResponse, DashboardStats, DeletePhotoInput,
  InternalNoteAudience, Occurrence, OccurrenceFilterOptions, OccurrenceListResponse, PublicOccurrence,
  UpdateOccurrenceInput, UpdatePhotoVisibilityInput,
} from '../../src/models/occurrence';
import { PRIORITY_RANK } from '../../src/models/occurrence';
import { normalizeProtocolPrefix } from '../../src/utils/protocol';
import { extractSearchTokens } from '../../src/utils/textNormalization';
import { assertOccurrenceTransition, isReopeningTransition } from '../domain/occurrenceStateMachine';
import { completeSla, createSlaSnapshot, isSlaPaused, isTerminalStatus, markFirstPublicResponse, pauseSla, policyForSla, recalculateFirstResponseBeforeResponse, recalculateResolutionSla, reopenSla, resumeSla } from '../domain/sla';
import type { NotificationOutboxItem } from '../models/notificationDomain';
import type { NewOccurrenceEvent, StoredOccurrence } from '../models/occurrenceDomain';
import type { IncomingPhoto, StoredPhotoMetadata } from '../models/photoDomain';
import type { AdminUserRepository } from '../repositories/adminUserRepository';
import type { AuditLogRepository } from '../repositories/auditLogRepository';
import type { CategoryRepository } from '../repositories/categoryRepository';
import type { LocationRepository } from '../repositories/locationRepository';
import type { OccurrenceEventRepository } from '../repositories/occurrenceEventRepository';
import type { OccurrenceRepository } from '../repositories/occurrenceRepository';
import { DuplicateCycleError, DuplicateTargetNotFoundError, OccurrenceVersionConflictError } from '../repositories/occurrenceRepository';
import type { OperationalTeamRepository } from '../repositories/operationalTeamRepository';
import type { SlaConfigRepository } from '../repositories/slaConfigRepository';
import type { SystemConfigRepository } from '../repositories/systemConfigRepository';
import { toAdminOccurrence, toPublicOccurrence } from '../serializers/occurrenceDto';
import { HttpError } from '../types/errors';
import { generateTrackingKey, hashTrackingKey, verifyTrackingKey, verifyTrackingKeyDummy } from '../utils/trackingKey';
import type { PhotoBinary, PhotoService } from './photoService';
import { MAX_RESOLUTION_PHOTOS } from './photoService';

function systemEvent(eventType:NewOccurrenceEvent['eventType'],visibility:NewOccurrenceEvent['visibility'],now:Date,correlationId:string,descriptions:{publicDescription?:string;internalDescription?:string;audience?:InternalNoteAudience;newValue?:string}={}):NewOccurrenceEvent{return{schemaVersion:2,eventType,visibility,createdAt:now,actorType:'SYSTEM',actorRoleSnapshot:'Sistema',correlationId,...descriptions};}
function adminEvent(eventType:NewOccurrenceEvent['eventType'],visibility:NewOccurrenceEvent['visibility'],now:Date,author:AuthorizedAdminProfile,correlationId:string,values:{publicDescription?:string;internalDescription?:string;previousValue?:string;newValue?:string;reason?:string;audience?:InternalNoteAudience;audienceTeamIdSnapshot?:string}={}):NewOccurrenceEvent{return{schemaVersion:2,eventType,visibility,createdAt:now,actorType:'ADMIN',actorAdminUserId:author.id,actorUid:author.uid,actorRoleSnapshot:author.role,actorDisplayNameSnapshot:author.displayName,correlationId,...values};}
function tokens(...values:string[]):string[]{return extractSearchTokens(...values);}

export class OccurrenceService{
 public constructor(private readonly occurrences:OccurrenceRepository,private readonly events:OccurrenceEventRepository,private readonly categories:CategoryRepository,private readonly locations:LocationRepository,private readonly configs:SystemConfigRepository,private readonly adminUsers:AdminUserRepository,private readonly teams:OperationalTeamRepository,private readonly slaConfigs:SlaConfigRepository,private readonly auditLogs:AuditLogRepository,private readonly photos:PhotoService,private readonly defaultEmailProvider: 'ews' | 'resend' = 'ews'){}
 private async policy():Promise<{policy:BusinessTimePolicy;slaConfig:Awaited<ReturnType<SlaConfigRepository['getSlaConfig']>>}>{const [calendar,exceptions,slaConfig]=await Promise.all([this.slaConfigs.getCalendar(),this.slaConfigs.listExceptions(),this.slaConfigs.getSlaConfig()]);return{policy:{calendar,exceptions},slaConfig};}
 private async dto(o:StoredOccurrence,user:AuthorizedAdminProfile,events?:NewOccurrenceEvent[]):Promise<Occurrence>{const [storedEvents,photos,{policy}]=await Promise.all([events===undefined?this.events.listByOccurrenceId(o.id):this.events.listByOccurrenceId(o.id),this.photos.listMetadata(o.id),this.policy()]);void events;return toAdminOccurrence(o,storedEvents,photos,user,policy);}
 public async create(input:CreateOccurrenceInput,correlationId:string):Promise<CreateOccurrenceResponse>;
 public async create(input:CreateOccurrenceInput,photos:IncomingPhoto[],correlationId:string):Promise<CreateOccurrenceResponse>;
 public async create(input:CreateOccurrenceInput,photosOrCorrelationId:IncomingPhoto[]|string,maybeCorrelationId?:string):Promise<CreateOccurrenceResponse>{
   const incoming=typeof photosOrCorrelationId==='string'?[]:photosOrCorrelationId;
   const correlationId=typeof photosOrCorrelationId==='string'?photosOrCorrelationId:(maybeCorrelationId??randomUUID());
   const [config,category,location,initialTeam,{policy,slaConfig}]=await Promise.all([this.configs.get(),this.categories.getById(input.categoryId),this.locations.resolveSnapshot(input.location),this.teams.getInitialIntakeTeam(),this.policy()]);
   if(!config)throw new HttpError(503,'REFERENCE_DATA_NOT_INITIALIZED','A configuração operacional ainda não foi inicializada.');
   if(!category?.active)throw new HttpError(400,'VALIDATION_ERROR','A categoria informada não está disponível.');
   if(!location)throw new HttpError(400,'VALIDATION_ERROR','A localização informada não pertence ao cadastro vigente.');
   const trackingKey=generateTrackingKey();
   const derived=await hashTrackingKey(trackingKey);
   const now=new Date();
   const priority=input.immediateRisk?'Urgente':'Normal';
   const sla=createSlaSnapshot(now,priority,category,slaConfig,policy);
   const occurrenceId=randomUUID();
   const initial:NewOccurrenceEvent[]=[systemEvent('OCCURRENCE_CREATED','PUBLIC',now,correlationId,{publicDescription:'Registro recebido pelo canal público sem identificação pessoal obrigatória.'})];
   if(initialTeam){
     initial.push(systemEvent('TEAM_ASSIGNED','INTERNAL',now,correlationId,{internalDescription:`Ocorrência atribuída inicialmente à equipe ${initialTeam.name}.`,newValue:initialTeam.id}));
   }
   if(input.immediateRisk)initial.push(systemEvent('INTERNAL_NOTE_ADDED','INTERNAL',now,correlationId,{internalDescription:'O comunicante indicou risco imediato. A ocorrência foi classificada inicialmente como Urgente e permanece sujeita à triagem administrativa.',audience:'ADMINS_AND_MANAGERS'}));
   const prepared=await this.photos.prepareAndUpload(occurrenceId,'INITIAL',incoming,{type:'PUBLIC'},correlationId);
   for(let i=0;i<prepared.metadata.length;i++)initial.push(systemEvent('PHOTO_ADDED','INTERNAL',now,correlationId,{internalDescription:'Fotografia do registro adicionada com metadados técnicos protegidos.'}));
   const notificationRecipients:string[]=[];
   if(initialTeam?.notificationEmail)notificationRecipients.push(initialTeam.notificationEmail);
   else if(config.emailNotificationsEnabled&&config.notificationEmails?.length)notificationRecipients.push(...config.notificationEmails);
   try{
     const created=await this.occurrences.createWithProtocol({
       categoryId:category.id,
       categoryNameSnapshot:category.name,
       location,
       description:input.description,
       immediateRisk:input.immediateRisk,
       priority,
       trackingKeyHash:derived.trackingKeyHash,
       trackingKeySalt:derived.trackingKeySalt,
       dataClassification:'REAL',
       sla,
       searchTokens:tokens(input.description,category.name,location.buildingName,location.room),
       ...(initialTeam?{assignedTeamId:initialTeam.id,assignedTeamNameSnapshot:initialTeam.name}:{})
     },normalizeProtocolPrefix(config.protocolPrefix),initial,{occurrenceId,photos:prepared.metadata,notificationRecipients,notificationProvider:this.defaultEmailProvider});
     return{protocol:created.protocol,trackingKey,createdAt:created.createdAt.toISOString()};
   }catch(error){
     await this.photos.compensate(prepared.uploadedPaths,'Falha na transação Firestore de criação da ocorrência',correlationId);
     throw error;
   }
 }
 public async track(protocol:string,trackingKey:string):Promise<PublicOccurrence>{const o=await this.getTrackedOccurrence(protocol,trackingKey);const [e,p]=await Promise.all([this.events.listByOccurrenceId(o.id),this.photos.listMetadata(o.id)]);return toPublicOccurrence(o,e,p);}
 public async list(filters:OccurrenceFilterOptions,user:AuthorizedAdminProfile):Promise<OccurrenceListResponse>{
   const effectiveFilters:OccurrenceFilterOptions=user.role==='Atendente'?{...filters,assignedToAdminUserId:user.id}:filters;
   const [result,{policy}]=await Promise.all([this.occurrences.list(effectiveFilters,user),this.policy()]);
   return{limit:result.limit,loadedCount:result.items.length,hasMore:result.hasMore,...(result.nextCursor?{nextCursor:result.nextCursor}:{}),items:result.items.map(o=>toAdminOccurrence(o,[],[],user,policy))};
 }
 public async getById(id:string,user:AuthorizedAdminProfile):Promise<Occurrence>{
   const o=await this.getStoredById(id);
   if(user.role==='Atendente'&&o.assignedToAdminUserId!==user.id){
     throw new HttpError(403,'FORBIDDEN','O perfil Atendente somente pode visualizar ocorrências sob sua responsabilidade direta.');
   }
   return this.dto(o,user);
 }
 private ensureSla(o:StoredOccurrence,category:CategoryItem,policy:BusinessTimePolicy,slaConfig:Awaited<ReturnType<SlaConfigRepository['getSlaConfig']>>):StoredOccurrence{return o.sla?o:{...o,sla:{...createSlaSnapshot(o.createdAt,o.priority,category,slaConfig,policy),legacyAssessment:'ESTIMATED'}};}
 public async update(id:string,input:UpdateOccurrenceInput,author:AuthorizedAdminProfile,correlationId:string):Promise<Occurrence>{
   let current=await this.getStoredById(id);
   if(author.role==='Atendente'){
     if(current.assignedToAdminUserId!==author.id){
       throw new HttpError(403,'FORBIDDEN','O perfil Atendente somente pode alterar ocorrências sob sua responsabilidade direta.');
     }
     if(input.priority!==undefined&&input.priority!==current.priority)throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para alterar a prioridade.');
     if(input.categoryId!==undefined&&input.categoryId!==current.categoryId)throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para recategorizar ocorrências.');
     if(input.location!==undefined)throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para alterar o local da ocorrência.');
     if(input.assignedTeamId!==undefined&&input.assignedTeamId!==current.assignedTeamId)throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para alterar a equipe responsável.');
     if(input.assignedToAdminUserId!==undefined&&input.assignedToAdminUserId!==current.assignedToAdminUserId)throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para reatribuir o responsável.');
     if(input.duplicateOfProtocol!==undefined)throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para vincular ou desvincular duplicidades.');
     if(input.internalNoteAudience!==undefined&&input.internalNoteAudience!=='RESPONSIBLE_TEAM'){
       throw new HttpError(403,'FORBIDDEN','O perfil Atendente somente pode registrar observações direcionadas à equipe responsável.');
     }
   }
   if(input.expectedVersion!==current.version)throw new HttpError(409,'CONFLICT','A ocorrência foi atualizada por outro usuário. Recarregue os dados antes de continuar.');
   const now=new Date();
   const [{policy,slaConfig},currentCategory]=await Promise.all([this.policy(),this.categories.getById(current.categoryId)]);
   if(!currentCategory)throw new HttpError(409,'CONFLICT','A categoria atual não existe mais no catálogo.');
   current=this.ensureSla(current,currentCategory,policy,slaConfig);
   const occurrencePolicy=policyForSla(current.sla,policy);
   let next:StoredOccurrence={...current,updatedAt:now,version:current.version+1};
   const eventList:NewOccurrenceEvent[]=[];
   const notificationItems:NotificationOutboxItem[]=[];
   let changed=false;
   let teamRoutedEvent=false;
   let responsibleAssignedEvent=false;

   if(input.categoryId!==undefined&&input.categoryId!==current.categoryId){if(!input.categoryChangeReason?.trim())throw new HttpError(400,'VALIDATION_ERROR','A justificativa da alteração de categoria é obrigatória.');const category=await this.categories.getById(input.categoryId);if(!category?.active)throw new HttpError(400,'VALIDATION_ERROR','A nova categoria precisa estar ativa.');next={...next,categoryId:category.id,categoryNameSnapshot:category.name,searchTokens:tokens(next.description,category.name,next.location.buildingName,next.location.room),sla:recalculateResolutionSla(next.sla!,next.createdAt,now,next.priority,category,slaConfig,occurrencePolicy)};changed=true;eventList.push(adminEvent('CATEGORY_CHANGED','PUBLIC',now,author,correlationId,{publicDescription:'A categoria foi ajustada pela equipe responsável após a triagem.',internalDescription:`Categoria alterada de ${current.categoryNameSnapshot} para ${category.name}. Justificativa: ${input.categoryChangeReason.trim()}`,previousValue:current.categoryId,newValue:category.id,reason:input.categoryChangeReason.trim()}));}
   if(input.location!==undefined){if(!input.locationChangeReason?.trim())throw new HttpError(400,'VALIDATION_ERROR','A justificativa da alteração de localização é obrigatória.');const loc=await this.locations.resolveSnapshot(input.location);if(!loc)throw new HttpError(400,'VALIDATION_ERROR','O novo local não pertence ao cadastro institucional ativo.');if(JSON.stringify(loc)!==JSON.stringify(current.location)){next={...next,location:loc,searchTokens:tokens(next.description,next.categoryNameSnapshot,loc.buildingName,loc.room)};changed=true;eventList.push(adminEvent('LOCATION_CHANGED','PUBLIC',now,author,correlationId,{publicDescription:'A localização foi ajustada pela equipe responsável após a triagem.',internalDescription:`Local alterado para ${loc.buildingName} — ${loc.room}. Justificativa: ${input.locationChangeReason.trim()}`,previousValue:`${current.location.buildingName}|${current.location.room}`,newValue:`${loc.buildingName}|${loc.room}`,reason:input.locationChangeReason.trim()}));}}
   if(input.priority!==undefined&&input.priority!==current.priority){const category=await this.categories.getById(next.categoryId);if(!category)throw new HttpError(409,'CONFLICT','Categoria atual inválida.');let sla=recalculateResolutionSla(next.sla!,next.createdAt,now,input.priority,category,slaConfig,occurrencePolicy);sla=recalculateFirstResponseBeforeResponse(sla,next.createdAt,input.priority,slaConfig,occurrencePolicy);next={...next,priority:input.priority,priorityRank:PRIORITY_RANK[input.priority],sla};changed=true;eventList.push(adminEvent('PRIORITY_CHANGED','INTERNAL',now,author,correlationId,{internalDescription:`Prioridade alterada de ${current.priority} para ${input.priority}.`,previousValue:current.priority,newValue:input.priority}));}
   let selectedTeam=input.assignedTeamId===undefined?(next.assignedTeamId?await this.teams.getById(next.assignedTeamId):undefined):input.assignedTeamId===null?undefined:await this.teams.getById(input.assignedTeamId);
   if(input.assignedTeamId!==undefined&&input.assignedTeamId!==current.assignedTeamId){
     if(input.assignedTeamId!==null&&(!selectedTeam||!selectedTeam.active))throw new HttpError(400,'VALIDATION_ERROR','A equipe selecionada não existe ou está inativa.');
     changed=true;
     if(!selectedTeam){
       delete next.assignedTeamId;delete next.assignedTeamNameSnapshot;
       eventList.push(adminEvent('TEAM_CHANGED','INTERNAL',now,author,correlationId,{internalDescription:'Equipe responsável removida.',previousValue:current.assignedTeamId}));
     }else{
       next={...next,assignedTeamId:selectedTeam.id,assignedTeamNameSnapshot:selectedTeam.name};
       eventList.push(adminEvent(current.assignedTeamId?'TEAM_CHANGED':'TEAM_ASSIGNED','INTERNAL',now,author,correlationId,{internalDescription:`Equipe responsável definida como ${selectedTeam.name}.`,previousValue:current.assignedTeamId,newValue:selectedTeam.id}));
       teamRoutedEvent=true;
       if(selectedTeam.notificationEmail){
         const item=createTeamRoutedNotificationItem(next,selectedTeam.notificationEmail,selectedTeam.name,now,this.defaultEmailProvider);
         if(item)notificationItems.push(item);
       }
       if(next.assignedToAdminUserId&&!selectedTeam.memberAdminUserIds.includes(next.assignedToAdminUserId)){
         eventList.push(adminEvent('RESPONSIBLE_CHANGED','INTERNAL',now,author,correlationId,{internalDescription:'Responsável individual removido porque não integra a nova equipe.',previousValue:next.assignedToAdminUserId}));
         delete next.assignedToAdminUserId;delete next.assignedToDisplayNameSnapshot;
       }
     }
   }
   if(input.assignedToAdminUserId!==undefined&&input.assignedToAdminUserId!==(current.assignedToAdminUserId??null)){
     changed=true;
     if(input.assignedToAdminUserId===null){
       delete next.assignedToAdminUserId;delete next.assignedToDisplayNameSnapshot;
       eventList.push(adminEvent('RESPONSIBLE_CHANGED','INTERNAL',now,author,correlationId,{internalDescription:'Responsável individual removido.',previousValue:current.assignedToAdminUserId}));
     }else{
       const assignee=await this.adminUsers.getById(input.assignedToAdminUserId);
       if(!assignee?.active||assignee.legacyRole||!isAdminRole(assignee.role))throw new HttpError(400,'VALIDATION_ERROR','O responsável precisa ser um usuário administrativo ativo.');
       selectedTeam=next.assignedTeamId?await this.teams.getById(next.assignedTeamId):undefined;
       if(selectedTeam&&!selectedTeam.memberAdminUserIds.includes(assignee.id))throw new HttpError(400,'VALIDATION_ERROR','O responsável individual deve integrar a equipe selecionada.');
       next={...next,assignedToAdminUserId:assignee.id,assignedToDisplayNameSnapshot:assignee.displayName};
       eventList.push(adminEvent('RESPONSIBLE_CHANGED','INTERNAL',now,author,correlationId,{internalDescription:`Responsável individual definido como ${assignee.displayName}.`,previousValue:current.assignedToAdminUserId,newValue:assignee.id}));
       responsibleAssignedEvent=true;
       if(assignee.email){
         const item=createResponsibleAssignedNotificationItem(next,assignee.email,assignee.displayName,now,this.defaultEmailProvider);
         if(item)notificationItems.push(item);
       }
     }
   }
   if(input.status!==undefined&&input.status!==current.status){assertOccurrenceTransition(current.status,input.status,author.role);changed=true;const reopening=isReopeningTransition(current.status,input.status);const wasPaused=isSlaPaused(current.status);const willPause=isSlaPaused(input.status);let sla=next.sla!;if(wasPaused&&!willPause){sla=resumeSla(sla,now,occurrencePolicy);eventList.push(adminEvent('SLA_RESUMED','INTERNAL',now,author,correlationId,{internalDescription:'Contagem efetiva do SLA retomada.'}));}if(!wasPaused&&willPause){sla=pauseSla(sla,now);eventList.push(adminEvent('SLA_PAUSED','INTERNAL',now,author,correlationId,{internalDescription:'Contagem efetiva do SLA pausada pela situação operacional.'}));}next={...next,status:input.status,sla};if(current.firstPublicResponseAt===undefined){next.firstPublicResponseAt=now;next.sla=markFirstPublicResponse(next.sla!,now);}if(isTerminalStatus(input.status)){next.closedAt=now;next.sla=completeSla(next.sla!,next.createdAt,now,occurrencePolicy);if(input.status==='Resolvida')next.resolvedAt=now;else delete next.resolvedAt;if(input.status==='Resolvida')eventList.push(adminEvent('OCCURRENCE_RESOLVED','PUBLIC',now,author,correlationId,{publicDescription:'A ocorrência foi registrada como resolvida pela equipe responsável.',previousValue:current.status,newValue:input.status}));else eventList.push(adminEvent('OCCURRENCE_CLOSED','PUBLIC',now,author,correlationId,{publicDescription:`A ocorrência foi encerrada com a situação ${input.status}.`,previousValue:current.status,newValue:input.status}));}else if(reopening){delete next.closedAt;delete next.resolvedAt;next.reopenedCount=current.reopenedCount+1;next.lastReopenedAt=now;next.sla=reopenSla(next.sla!,now,occurrencePolicy);if(current.status==='Duplicada'){delete next.duplicateOfOccurrenceId;delete next.duplicateOfProtocol;eventList.push(adminEvent('DUPLICATE_UNLINKED','PUBLIC',now,author,correlationId,{publicDescription:'O vínculo de duplicidade foi removido durante a reabertura.'}));}eventList.push(adminEvent('OCCURRENCE_REOPENED','PUBLIC',now,author,correlationId,{publicDescription:'A ocorrência foi reaberta para nova análise.',previousValue:current.status,newValue:input.status}));}else eventList.push(adminEvent('STATUS_CHANGED','PUBLIC',now,author,correlationId,{publicDescription:`Situação atualizada para ${input.status}.`,previousValue:current.status,newValue:input.status}));}
   if(input.duplicateOfProtocol!==undefined){if(input.duplicateOfProtocol===null){if((input.status??next.status)==='Duplicada')throw new HttpError(409,'CONFLICT','Uma ocorrência Duplicada deve manter referência para a ocorrência principal.');if(next.duplicateOfOccurrenceId){changed=true;delete next.duplicateOfOccurrenceId;delete next.duplicateOfProtocol;eventList.push(adminEvent('DUPLICATE_UNLINKED','PUBLIC',now,author,correlationId,{publicDescription:'O vínculo de duplicidade foi removido.'}));}}else{const target=await this.occurrences.findByProtocol(input.duplicateOfProtocol.trim().toUpperCase());if(!target||target.id===current.id)throw new HttpError(409,'CONFLICT','A ocorrência principal informada é inválida.');if(await this.occurrences.wouldCreateDuplicateCycle(current.id,target.id))throw new HttpError(409,'CONFLICT','O vínculo de duplicidade criaria uma cadeia circular.');if((input.status??next.status)!=='Duplicada')throw new HttpError(409,'CONFLICT','O vínculo de duplicidade somente pode existir quando a situação é Duplicada.');if(target.id!==current.duplicateOfOccurrenceId){changed=true;next={...next,duplicateOfOccurrenceId:target.id,duplicateOfProtocol:target.protocol};eventList.push(adminEvent('DUPLICATE_LINKED','PUBLIC',now,author,correlationId,{publicDescription:`Esta ocorrência foi vinculada ao protocolo principal ${target.protocol}.`,previousValue:current.duplicateOfProtocol,newValue:target.protocol}));}}}
   if(next.status==='Duplicada'&&!next.duplicateOfOccurrenceId)throw new HttpError(409,'CONFLICT','A situação Duplicada exige referência válida para a ocorrência principal.');if(next.status!=='Duplicada'&&next.duplicateOfOccurrenceId)throw new HttpError(409,'CONFLICT','O vínculo de duplicidade não pode permanecer fora da situação Duplicada.');
   if(input.newPublicMessage!==undefined){changed=true;eventList.push(adminEvent('PUBLIC_MESSAGE_ADDED','PUBLIC',now,author,correlationId,{publicDescription:input.newPublicMessage}));}
   if(input.newInternalNote!==undefined){
     const audience=author.role==='Atendente'?'RESPONSIBLE_TEAM':(input.internalNoteAudience??'ADMINS_AND_MANAGERS');
     if(audience==='ADMIN_ONLY'&&author.role!=='Administrador')throw new HttpError(403,'FORBIDDEN','Somente Administradores podem registrar observação com audiência restrita a administradores.');
     if(audience==='RESPONSIBLE_TEAM'){
       if(!next.assignedTeamId)throw new HttpError(400,'VALIDATION_ERROR','Selecione uma equipe responsável antes de restringir a observação à equipe.');
       if(author.role!=='Administrador'&&!author.teamIds.includes(next.assignedTeamId))throw new HttpError(403,'FORBIDDEN','O usuário somente pode registrar observação para a equipe responsável quando integrar essa equipe.');
     }
     changed=true;
     eventList.push(adminEvent('INTERNAL_NOTE_ADDED','INTERNAL',now,author,correlationId,{internalDescription:input.newInternalNote,audience,...(audience==='RESPONSIBLE_TEAM'&&next.assignedTeamId?{audienceTeamIdSnapshot:next.assignedTeamId}:{})}));
   }
   if(!changed)throw new HttpError(400,'VALIDATION_ERROR','Informe ao menos uma alteração efetiva.');
   let saved:StoredOccurrence;
   try{
     saved=await this.occurrences.updateWithEvents(next,input.expectedVersion,eventList,{},notificationItems);
   }catch(error){
     if(error instanceof OccurrenceVersionConflictError)throw new HttpError(409,'CONFLICT','Esta ocorrência foi atualizada por outra operação. Recarregue os dados e tente novamente.');
     if(error instanceof DuplicateCycleError||error instanceof DuplicateTargetNotFoundError)throw new HttpError(409,'CONFLICT','O vínculo de duplicidade informado é inválido.');
     throw error;
   }
   await this.auditChanges(current,saved,input,author,correlationId,teamRoutedEvent,responsibleAssignedEvent);
   return this.dto(saved,author);
 }
 private async auditChanges(before:StoredOccurrence,after:StoredOccurrence,input:UpdateOccurrenceInput,author:AuthorizedAdminProfile,c:string,teamRouted=false,responsibleAssigned=false):Promise<void>{
   const base={actorUid:author.uid,actorEmail:author.email,actorRole:author.role,targetType:'occurrence' as const,targetId:after.id,requestCorrelationId:c};
   const writes:Array<ReturnType<AuditLogRepository['write']>>=[];
   if(before.status!==after.status)writes.push(this.auditLogs.write({...base,eventType:isReopeningTransition(before.status,after.status)?'OCCURRENCE_REOPENED':after.status==='Resolvida'?'OCCURRENCE_RESOLVED':isTerminalStatus(after.status)?'OCCURRENCE_CLOSED':'OCCURRENCE_STATUS_CHANGED',summary:`Situação alterada de ${before.status} para ${after.status}.`}));
   if(before.categoryId!==after.categoryId)writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_CATEGORY_CHANGED',summary:'Categoria da ocorrência corrigida após triagem.'}));
   if(JSON.stringify(before.location)!==JSON.stringify(after.location))writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_LOCATION_CHANGED',summary:'Local da ocorrência corrigido após triagem.'}));
   if(before.priority!==after.priority)writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_PRIORITY_CHANGED',summary:`Prioridade alterada para ${after.priority}.`}));
   if(before.assignedTeamId!==after.assignedTeamId)writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_TEAM_CHANGED',summary:'Equipe responsável atualizada.'}));
   if(teamRouted)writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_TEAM_ROUTED',summary:`Ocorrência encaminhada para a equipe ${after.assignedTeamNameSnapshot}.`}));
   if(before.assignedToAdminUserId!==after.assignedToAdminUserId)writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_RESPONSIBLE_CHANGED',summary:'Responsável individual atualizado.'}));
   if(responsibleAssigned)writes.push(this.auditLogs.write({...base,eventType:'OCCURRENCE_RESPONSIBLE_ASSIGNED',summary:`Responsável individual atribuído: ${after.assignedToDisplayNameSnapshot}.`}));
   if(input.newPublicMessage)writes.push(this.auditLogs.write({...base,eventType:'PUBLIC_MESSAGE_ADDED',summary:'Mensagem pública adicionada.'}));
   if(input.newInternalNote)writes.push(this.auditLogs.write({...base,eventType:'INTERNAL_NOTE_ADDED',summary:`Observação interna adicionada com audiência ${author.role==='Atendente'?'RESPONSIBLE_TEAM':(input.internalNoteAudience??'ADMINS_AND_MANAGERS')}.`}));
   await Promise.all(writes);
 }
 public async getPublicPhoto(protocol:string,trackingKey:string,photoId:string,variant:'thumbnail'|'full'):Promise<PhotoBinary>{const o=await this.getTrackedOccurrence(protocol,trackingKey);const p=await this.photos.getMetadata(o.id,photoId);if(!p||p.status!=='READY'||p.visibility!=='PUBLIC'||p.kind!=='RESOLUTION')throw new HttpError(404,'PHOTO_NOT_FOUND','Fotografia não encontrada.');return this.photos.readVariant(p,variant);}
 public async getAdminPhoto(id:string,photoId:string,variant:'thumbnail'|'full',author:AuthorizedAdminProfile):Promise<PhotoBinary>{
   const o=await this.getStoredById(id);
   if(author.role==='Atendente'&&o.assignedToAdminUserId!==author.id){
     throw new HttpError(403,'FORBIDDEN','O perfil Atendente somente pode visualizar fotografias de ocorrências sob sua responsabilidade.');
   }
   const p=await this.photos.getMetadata(id,photoId);
   if(!p||p.status!=='READY')throw new HttpError(404,'PHOTO_NOT_FOUND','Fotografia não encontrada.');
   return this.photos.readVariant(p,variant);
 }
 public async addResolutionPhotos(id:string,input:AddResolutionPhotosInput,incoming:IncomingPhoto[],author:AuthorizedAdminProfile,c:string):Promise<Occurrence>{
   if(!incoming.length)throw new HttpError(400,'VALIDATION_ERROR','Selecione ao menos uma fotografia da solução.');
   const current=await this.getStoredById(id);
   if(author.role==='Atendente'&&current.assignedToAdminUserId!==author.id){
     throw new HttpError(403,'FORBIDDEN','O perfil Atendente somente pode adicionar fotos em ocorrências sob sua responsabilidade.');
   }
   this.assertVersion(current,input.expectedVersion);
   const existing=await this.photos.countReady(id,'RESOLUTION');
   if(existing+incoming.length>MAX_RESOLUTION_PHOTOS)throw new HttpError(400,'PHOTO_COUNT_EXCEEDED',`É permitido manter no máximo ${MAX_RESOLUTION_PHOTOS} fotografias de solução por ocorrência.`);
   const prepared=await this.photos.prepareAndUpload(id,'RESOLUTION',incoming,{type:'ADMIN',user:author},c);
   const now=new Date();
   const next={...current,hasPhoto:true,updatedAt:now,version:current.version+1};
   const ev=prepared.metadata.map(()=>adminEvent('PHOTO_ADDED','INTERNAL',now,author,c,{internalDescription:'Fotografia da solução adicionada; permanece interna até publicação explícita.'}));
   try{
     const saved=await this.occurrences.updateWithEvents(next,input.expectedVersion,ev,{create:prepared.metadata});
     return this.dto(saved,author);
   }catch(error){
     await this.photos.compensate(prepared.uploadedPaths,'Falha Firestore após upload de solução',c);
     this.rethrow(error);
   }
 }
 public async updatePhotoVisibility(id:string,photoId:string,input:UpdatePhotoVisibilityInput,author:AuthorizedAdminProfile,c:string):Promise<Occurrence>{
   if(author.role==='Atendente')throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para alterar a visibilidade de fotografias.');
   const current=await this.getStoredById(id);
   this.assertVersion(current,input.expectedVersion);
   const p=await this.photos.getMetadata(id,photoId);
   if(!p||p.status!=='READY')throw new HttpError(404,'PHOTO_NOT_FOUND','Fotografia não encontrada.');
   if(p.kind!=='RESOLUTION')throw new HttpError(403,'FORBIDDEN','Fotografias iniciais não podem ser públicas.');
   if(p.visibility===input.visibility)throw new HttpError(400,'VALIDATION_ERROR','A fotografia já possui essa visibilidade.');
   const now=new Date();
   const updated:StoredPhotoMetadata={...p,visibility:input.visibility};
   const next={...current,updatedAt:now,version:current.version+1};
   const ev=adminEvent('PHOTO_VISIBILITY_CHANGED','PUBLIC',now,author,c,{publicDescription:input.visibility==='PUBLIC'?'Um registro fotográfico da solução foi disponibilizado para consulta.':'Um registro fotográfico da solução deixou de estar disponível para consulta.',previousValue:p.visibility,newValue:input.visibility});
   try{
     return this.dto(await this.occurrences.updateWithEvents(next,input.expectedVersion,[ev],{update:[updated]}),author);
   }catch(error){
     this.rethrow(error);
   }
 }
 public async deletePhoto(id:string,photoId:string,input:DeletePhotoInput,author:AuthorizedAdminProfile,c:string):Promise<Occurrence>{
   if(author.role==='Atendente')throw new HttpError(403,'FORBIDDEN','O perfil Atendente não possui permissão para excluir fotografias.');
   const current=await this.getStoredById(id);
   this.assertVersion(current,input.expectedVersion);
   const p=await this.photos.getMetadata(id,photoId);
   if(!p||p.status!=='READY')throw new HttpError(404,'PHOTO_NOT_FOUND','Fotografia não encontrada.');
   const now=new Date();
   const deleted:StoredPhotoMetadata={...p,status:'DELETED',deletedAt:now,deletedByAdminUserId:author.id};
   const next={...current,updatedAt:now,version:current.version+1};
   const ev=adminEvent('PHOTO_DELETED',p.visibility==='PUBLIC'?'PUBLIC':'INTERNAL',now,author,c,{...(p.visibility==='PUBLIC'?{publicDescription:'Um registro fotográfico deixou de estar disponível para consulta.'}:{}),internalDescription:'Fotografia removida logicamente e encaminhada para exclusão física idempotente.'});
   let saved:StoredOccurrence;
   try{
     saved=await this.occurrences.updateWithEvents(next,input.expectedVersion,[ev],{update:[deleted]});
   }catch(error){
     this.rethrow(error);
   }
   await this.photos.deleteObjectsOrQueue(p,'Exclusão física após exclusão lógica',c);
   return this.dto(saved,author);
 }
 public async getStats(user:AuthorizedAdminProfile):Promise<DashboardStats>{
   const now=new Date();
   const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
   const start=zonedLocalToDate(date,'00:00','America/Sao_Paulo');
   const end=new Date(zonedLocalToDate(date,'23:59','America/Sao_Paulo').getTime()+59_999);
   const thirty=new Date(now.getTime()-30*86400000);

   if(user.role==='Atendente'){
     const [urgentOrEmergency,slaBreached,inService,awaitingAction,resolvedRecently]=await Promise.all([
       this.occurrences.count({priorities:['Urgente','Emergencial'],isClosed:false,assignedToAdminUserId:user.id}),
       this.occurrences.count({slaBreachedAt:now,assignedToAdminUserId:user.id}),
       this.occurrences.count({status:'Em atendimento',assignedToAdminUserId:user.id}),
       this.occurrences.count({statuses:['Aguardando material','Aguardando contratação ou serviço externo'],assignedToAdminUserId:user.id}),
       this.occurrences.count({status:'Resolvida',resolvedAtFrom:thirty,resolvedAtTo:now,assignedToAdminUserId:user.id}),
     ]);
     return{urgentOrEmergency,slaBreached,withoutRouting:0,inService,awaitingAction,resolvedRecently,receivedToday:0};
   }

   const [urgentOrEmergency,slaBreached,withoutTeam,withoutResponsible,inService,awaitingAction,resolvedRecently,receivedToday]=await Promise.all([
     this.occurrences.count({priorities:['Urgente','Emergencial'],isClosed:false}),
     this.occurrences.count({slaBreachedAt:now}),
     this.occurrences.count({hasTeam:false,isClosed:false}),
     this.occurrences.count({hasResponsible:false,isClosed:false}),
     this.occurrences.count({status:'Em atendimento'}),
     this.occurrences.count({statuses:['Aguardando material','Aguardando contratação ou serviço externo']}),
     this.occurrences.count({status:'Resolvida',resolvedAtFrom:thirty,resolvedAtTo:now}),
     this.occurrences.count({createdAtFrom:start,createdAtTo:end})
   ]);
   const withoutBoth=await this.occurrences.count({hasTeam:false,hasResponsible:false,isClosed:false});
   return{urgentOrEmergency,slaBreached,withoutRouting:withoutTeam+withoutResponsible-withoutBoth,inService,awaitingAction,resolvedRecently,receivedToday};
 }
  private async getTrackedOccurrence(protocol: string, key: string): Promise<StoredOccurrence> {
    const o = await this.occurrences.findByProtocol(protocol.trim().toUpperCase());
    if (!o) {
      await verifyTrackingKeyDummy(key);
      throw new HttpError(404, 'NOT_FOUND', 'Ocorrência não encontrada para a combinação de protocolo e chave informada.');
    }
    if (!(await verifyTrackingKey(key, o.trackingKeyHash, o.trackingKeySalt))) {
      throw new HttpError(404, 'NOT_FOUND', 'Ocorrência não encontrada para a combinação de protocolo e chave informada.');
    }
    return o;
  }
 private async getStoredById(id:string):Promise<StoredOccurrence>{const o=await this.occurrences.getById(id);if(!o)throw new HttpError(404,'NOT_FOUND','Ocorrência administrativa não encontrada.');return o;}
 private assertVersion(o:StoredOccurrence,v:number):void{if(o.version!==v)throw new HttpError(409,'PHOTO_VERSION_CONFLICT','A ocorrência foi atualizada por outro usuário. Recarregue os dados.');}
 private rethrow(error:unknown):never{if(error instanceof OccurrenceVersionConflictError)throw new HttpError(409,'PHOTO_VERSION_CONFLICT','A ocorrência foi atualizada por outro usuário. Recarregue os dados.');throw error;}
}
