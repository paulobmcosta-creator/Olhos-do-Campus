import type { AuthorizedAdminProfile, AuditLogFilters, AuditLogPage } from '../../src/models/admin';
import type { BuildingLocation, CategoryItem, CampusLocation, RoomLocation } from '../../src/models/config';
import type { AnalyticsFilters, AnalyticsStats, ExportFormat, OperationalTeam, ServiceCalendar, ServiceCalendarException, SlaConfiguration, TeamCreateInput, TeamUpdateInput } from '../../src/models/operations';
import type { OccurrenceFilterOptions, OccurrencePriority, OccurrenceStatus } from '../../src/models/occurrence';
import { businessMinutesBetween } from '../domain/businessTime';
import { effectiveResolutionMinutes, policyForSla } from '../domain/sla';
import type { StoredOccurrence } from '../models/occurrenceDomain';
import type { AdminUserRepository } from '../repositories/adminUserRepository';
import type { AuditLogRepository } from '../repositories/auditLogRepository';
import { CategoryVersionConflictError, type CategoryMutation, type CategoryRepository } from '../repositories/categoryRepository';
import { LocationVersionConflictError, type LocationRepository } from '../repositories/locationRepository';
import type { OccurrenceRepository } from '../repositories/occurrenceRepository';
import type { OperationalTeamRepository } from '../repositories/operationalTeamRepository';
import { SlaConfigVersionConflictError, type SlaConfigRepository } from '../repositories/slaConfigRepository';
import { HttpError } from '../types/errors';
import { createId } from '../utils/ids';
import { createCsv, createPdf, createXlsx, EXPORT_LIMIT } from '../utils/reportExport';
import type { PhotoService } from './photoService';

const ANALYTICS_LIMIT = 5000;

function normalizeId(value:string):string{return value.normalize('NFD').replace(/[\u0300-\u036f]/gu,'').toLowerCase().replace(/[^a-z0-9]+/gu,'-').replace(/^-|-$/gu,'').slice(0,100);}
function mean(values:number[]):number|null{return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}
function median(values:number[]):number|null{if(!values.length)return null;const v=[...values].sort((a,b)=>a-b);const m=Math.floor(v.length/2);return v.length%2?v[m]??null:((v[m-1]??0)+(v[m]??0))/2;}
function percent(n:number,d:number):number|null{return d===0?null:(n/d)*100;}
function distribution(items:StoredOccurrence[],name:(o:StoredOccurrence)=>string|undefined){const map=new Map<string,number>();for(const item of items){const key=name(item)??'Não informado';map.set(key,(map.get(key)??0)+1);}return[...map.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'pt-BR'));}
function analyticsFilterToOccurrence(input:AnalyticsFilters,includePeriod=true):OccurrenceFilterOptions{return{...(includePeriod&&input.startDate?{startDate:input.startDate}:{}),...(includePeriod&&input.endDate?{endDate:input.endDate}:{}),...(input.categoryId?{category:input.categoryId}:{}),...(input.areaId?{areaId:input.areaId}:{}),...(input.environmentId?{environmentId:input.environmentId}:{}),...(input.priority?{priority:input.priority}:{}),...(input.status?{status:input.status}:{}),...(input.teamId?{assignedTeamId:input.teamId}:{}),...(input.responsibleId?{assignedToAdminUserId:input.responsibleId}:{})};}
function defaultPeriod(filters:AnalyticsFilters):Required<Pick<AnalyticsFilters,'startDate'|'endDate'>>{const now=new Date();const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});const end=fmt.format(now);const start=fmt.format(new Date(now.getTime()-29*86400000));return{startDate:filters.startDate??start,endDate:filters.endDate??end};}

export interface ExportResult{buffer:Buffer;contentType:string;fileName:string;count:number;}

export class OperationalAdminService {
  public constructor(
    private readonly categories:CategoryRepository,
    private readonly locations:LocationRepository,
    private readonly teams:OperationalTeamRepository,
    private readonly sla:SlaConfigRepository,
    private readonly users:AdminUserRepository,
    private readonly occurrences:OccurrenceRepository,
    private readonly audit:AuditLogRepository,
    private readonly photos:PhotoService,
  ){}

  private assertAdmin(actor:AuthorizedAdminProfile):void{if(actor.role!=='Administrador')throw new HttpError(403,'FORBIDDEN','Esta operação é exclusiva de Administradores.');}
  private assertAdminOrManager(actor:AuthorizedAdminProfile):void{if(actor.role!=='Administrador'&&actor.role!=='Gestor')throw new HttpError(403,'FORBIDDEN','Esta operação é restrita a Administradores e Gestores.');}
  private auditBase(actor:AuthorizedAdminProfile,targetType:'category'|'location'|'team'|'sla'|'calendar'|'occurrence'|'report',targetId:string|undefined,correlationId:string){return{actorUid:actor.uid,actorEmail:actor.email,actorRole:actor.role,targetType,...(targetId?{targetId}:{}),requestCorrelationId:correlationId};}

  public listCategories():Promise<CategoryItem[]>{return this.categories.listAll();}
  public async createCategory(input:Omit<CategoryItem,'id'|'version'> & {id?:string},actor:AuthorizedAdminProfile,c:string):Promise<CategoryItem>{this.assertAdmin(actor);const id=input.id?.trim()||`cat-${normalizeId(input.name)}`;if(!id||id==='cat-')throw new HttpError(400,'VALIDATION_ERROR','Não foi possível gerar identificador estável para a categoria.');try{const out=await this.categories.create({...input,id},actor.id);await this.audit.write({...this.auditBase(actor,'category',id,c),eventType:'CATEGORY_CREATED',summary:`Categoria institucional criada: ${out.name}.`});return out;}catch(e){if(e instanceof Error&&e.message==='CATEGORY_EXISTS')throw new HttpError(409,'CONFLICT','Já existe categoria com esse identificador.');throw e;}}
  public async updateCategory(id:string,input:CategoryMutation,actor:AuthorizedAdminProfile,c:string):Promise<CategoryItem>{this.assertAdmin(actor);try{const before=await this.categories.getById(id);if(!before)throw new HttpError(404,'NOT_FOUND','Categoria não encontrada.');const out=await this.categories.update(id,input,actor.id);await this.audit.write({...this.auditBase(actor,'category',id,c),eventType:before.active&&!out.active?'CATEGORY_DEACTIVATED':'CATEGORY_UPDATED',summary:before.active&&!out.active?`Categoria desativada: ${before.name}.`:`Categoria atualizada: ${out.name}.`});return out;}catch(e){if(e instanceof CategoryVersionConflictError)throw new HttpError(409,'CONFLICT','A categoria foi atualizada por outro usuário.');throw e;}}

  public listLocations():Promise<CampusLocation[]>{return this.locations.list();}
  public async addArea(campusId:string,input:{name:string;sortOrder:number;expectedVersion:number},actor:AuthorizedAdminProfile,c:string):Promise<CampusLocation>{this.assertAdmin(actor);const area:BuildingLocation={id:`area-${normalizeId(input.name)}-${createId('x').slice(-8)}`,name:input.name,active:true,sortOrder:input.sortOrder,floors:[{id:'sem-pavimento',name:'',rooms:[]}]};try{const out=await this.locations.addArea(campusId,area,input.expectedVersion,actor.id);await this.audit.write({...this.auditBase(actor,'location',`${campusId}/${area.id}`,c),eventType:'LOCATION_CREATED',summary:`Bloco/Área criado: ${area.name}.`});return out;}catch(e){if(e instanceof LocationVersionConflictError)throw new HttpError(409,'CONFLICT','O cadastro de locais foi atualizado por outro usuário.');throw e;}}
  public async updateArea(campusId:string,areaId:string,input:{name?:string;active?:boolean;sortOrder?:number;expectedVersion:number},actor:AuthorizedAdminProfile,c:string):Promise<CampusLocation>{this.assertAdmin(actor);try{const before=await this.locations.getCampus(campusId);const old=before?.buildings.find(x=>x.id===areaId);const out=await this.locations.updateArea(campusId,areaId,input,actor.id);const updated=out.buildings.find(x=>x.id===areaId);const eventType=old?.active===false&&updated?.active===true?'LOCATION_REACTIVATED':old?.active!==false&&updated?.active===false?'LOCATION_DEACTIVATED':'LOCATION_UPDATED';await this.audit.write({...this.auditBase(actor,'location',`${campusId}/${areaId}`,c),eventType,summary:`Bloco/Área ${eventType==='LOCATION_REACTIVATED'?'reativado':eventType==='LOCATION_DEACTIVATED'?'desativado':'atualizado'}: ${updated?.name??areaId}.`});return out;}catch(e){if(e instanceof LocationVersionConflictError)throw new HttpError(409,'CONFLICT','O cadastro de locais foi atualizado por outro usuário.');throw e;}}
  public async deleteArea(campusId:string,areaId:string,expectedVersion:number,actor:AuthorizedAdminProfile,c:string):Promise<CampusLocation>{
    this.assertAdmin(actor);
    const inUse=await this.occurrences.isLocationReferenced(areaId);
    if(inUse)throw new HttpError(409,'CONFLICT','Este local já foi utilizado em ocorrências e não pode ser excluído definitivamente. Desative-o para impedir novos registros.');
    try{
      const out=await this.locations.deleteArea(campusId,areaId,expectedVersion,actor.id);
      await this.audit.write({...this.auditBase(actor,'location',`${campusId}/${areaId}`,c),eventType:'LOCATION_DELETED',summary:`Bloco/Área excluído definitivamente: ${areaId}.`});
      return out;
    }catch(e){if(e instanceof LocationVersionConflictError)throw new HttpError(409,'CONFLICT','O cadastro de locais foi atualizado por outro usuário.');throw e;}
  }
  public async addEnvironment(campusId:string,areaId:string,input:{name:string;sortOrder:number;expectedVersion:number},actor:AuthorizedAdminProfile,c:string):Promise<CampusLocation>{this.assertAdmin(actor);const room:RoomLocation={id:`amb-${normalizeId(input.name)}-${createId('x').slice(-8)}`,name:input.name,active:true,sortOrder:input.sortOrder};try{const out=await this.locations.addEnvironment(campusId,areaId,room,input.expectedVersion,actor.id);await this.audit.write({...this.auditBase(actor,'location',`${campusId}/${areaId}/${room.id}`,c),eventType:'LOCATION_CREATED',summary:`Ambiente criado: ${room.name}.`});return out;}catch(e){if(e instanceof LocationVersionConflictError)throw new HttpError(409,'CONFLICT','O cadastro de locais foi atualizado por outro usuário.');throw e;}}
  public async updateEnvironment(campusId:string,areaId:string,roomId:string,input:{name?:string;active?:boolean;sortOrder?:number;expectedVersion:number},actor:AuthorizedAdminProfile,c:string):Promise<CampusLocation>{this.assertAdmin(actor);try{const before=await this.locations.getCampus(campusId);const old=before?.buildings.find(x=>x.id===areaId)?.floors[0]?.rooms.find(x=>x.id===roomId);const out=await this.locations.updateEnvironment(campusId,areaId,roomId,input,actor.id);const updated=out.buildings.find(x=>x.id===areaId)?.floors[0]?.rooms.find(x=>x.id===roomId);const eventType=old?.active===false&&updated?.active===true?'LOCATION_REACTIVATED':old?.active!==false&&updated?.active===false?'LOCATION_DEACTIVATED':'LOCATION_UPDATED';await this.audit.write({...this.auditBase(actor,'location',`${campusId}/${areaId}/${roomId}`,c),eventType,summary:`Ambiente ${eventType==='LOCATION_REACTIVATED'?'reativado':eventType==='LOCATION_DEACTIVATED'?'desativado':'atualizado'}: ${updated?.name??roomId}.`});return out;}catch(e){if(e instanceof LocationVersionConflictError)throw new HttpError(409,'CONFLICT','O cadastro de locais foi atualizado por outro usuário.');throw e;}}

  public async deleteEnvironment(campusId:string,areaId:string,roomId:string,expectedVersion:number,actor:AuthorizedAdminProfile,c:string):Promise<CampusLocation>{
    this.assertAdmin(actor);
    const inUse=await this.occurrences.isLocationReferenced(areaId,roomId);
    if(inUse)throw new HttpError(409,'CONFLICT','Este local já foi utilizado em ocorrências e não pode ser excluído definitivamente. Desative-o para impedir novos registros.');
    try{
      const out=await this.locations.deleteEnvironment(campusId,areaId,roomId,expectedVersion,actor.id);
      await this.audit.write({...this.auditBase(actor,'location',`${campusId}/${areaId}/${roomId}`,c),eventType:'LOCATION_DELETED',summary:`Ambiente excluído definitivamente: ${roomId}.`});
      return out;
    }catch(e){if(e instanceof LocationVersionConflictError)throw new HttpError(409,'CONFLICT','O cadastro de locais foi atualizado por outro usuário.');throw e;}
  }

  public listTeams(includeInactive=true):Promise<OperationalTeam[]>{return this.teams.list(includeInactive);}
  private async validateMembers(ids:string[]):Promise<void>{for(const id of ids){const u=await this.users.getById(id);if(!u?.active||u.legacyRole)throw new HttpError(400,'VALIDATION_ERROR','Toda equipe deve conter somente usuários administrativos ativos.');}}
  private async syncMembership(teamId:string,members:string[],actorId:string):Promise<void>{const users=await this.users.list(500);for(const user of users){if(user.legacyRole)continue;const has=user.teamIds.includes(teamId);const should=members.includes(user.id);if(has===should)continue;const teamIds=should?[...new Set([...user.teamIds,teamId])]:user.teamIds.filter(id=>id!==teamId);await this.users.update(user.id,{teamIds},actorId);}}
  public async createTeam(input:TeamCreateInput,actor:AuthorizedAdminProfile,c:string):Promise<OperationalTeam>{
    this.assertAdmin(actor);
    const members=input.memberAdminUserIds??[];
    await this.validateMembers(members);
    if(input.isInitialIntakeTeam&&!input.notificationEmail)throw new HttpError(400,'VALIDATION_ERROR','A equipe inicial de acolhimento exige e-mail institucional de notificação.');
    const id=`team-${normalizeId(input.name)}-${createId('x').slice(-8)}`;
    try{
      const out=await this.teams.create(id,input,actor.id);
      await this.syncMembership(id,out.memberAdminUserIds,actor.id);
      await this.audit.write({...this.auditBase(actor,'team',id,c),eventType:'TEAM_CREATED',summary:`Equipe/Setor criado: ${out.name}.`});
      if(out.isInitialIntakeTeam){
        await this.audit.write({...this.auditBase(actor,'team',id,c),eventType:'TEAM_INITIAL_INTAKE_CHANGED',summary:`Equipe ${out.name} definida como equipe inicial de acolhimento.`});
      }
      return out;
    }catch(e){if(e instanceof Error&&e.message==='TEAM_EXISTS')throw new HttpError(409,'CONFLICT','Já existe equipe com esse identificador.');throw e;}
  }
  public async updateTeam(id:string,input:TeamUpdateInput,actor:AuthorizedAdminProfile,c:string):Promise<OperationalTeam>{
    this.assertAdmin(actor);
    if(input.memberAdminUserIds)await this.validateMembers(input.memberAdminUserIds);
    const before=await this.teams.getById(id);
    if(!before)throw new HttpError(404,'NOT_FOUND','Equipe/Setor não encontrado.');
    if(before.isInitialIntakeTeam){
      if(input.active===false)throw new HttpError(400,'VALIDATION_ERROR','Não é permitido desativar a única equipe inicial de acolhimento ativa.');
      if(input.isInitialIntakeTeam===false)throw new HttpError(400,'VALIDATION_ERROR','Não é permitido remover o papel de acolhimento inicial sem designar outra equipe ativa.');
      if(input.notificationEmail!==undefined&&input.notificationEmail!==null&&!input.notificationEmail.trim())throw new HttpError(400,'VALIDATION_ERROR','A equipe inicial de acolhimento ativa exige e-mail institucional de notificação.');
    }
    if(input.isInitialIntakeTeam&&input.notificationEmail!==undefined&&input.notificationEmail!==null&&!input.notificationEmail.trim()){
      throw new HttpError(400,'VALIDATION_ERROR','A equipe inicial de acolhimento ativa exige e-mail institucional de notificação.');
    }
    try{
      const out=await this.teams.update(id,input,actor.id);
      if(input.memberAdminUserIds)await this.syncMembership(id,out.memberAdminUserIds,actor.id);
      await this.audit.write({...this.auditBase(actor,'team',id,c),eventType:before.active&&!out.active?'TEAM_DEACTIVATED':'TEAM_UPDATED',summary:before.active&&!out.active?`Equipe/Setor desativado: ${before.name}.`:`Equipe/Setor atualizado: ${out.name}.`});
      if(!before.isInitialIntakeTeam&&out.isInitialIntakeTeam){
        await this.audit.write({...this.auditBase(actor,'team',id,c),eventType:'TEAM_INITIAL_INTAKE_CHANGED',summary:`Equipe ${out.name} definida como equipe inicial de acolhimento.`});
      }
      return out;
    }catch(e){
      if(e instanceof Error&&e.message==='INITIAL_TEAM_CANNOT_BE_DEACTIVATED')throw new HttpError(400,'VALIDATION_ERROR','A equipe inicial de acolhimento não pode ser desativada.');
      if(e instanceof Error&&e.message==='INITIAL_TEAM_REQUIRES_EMAIL')throw new HttpError(400,'VALIDATION_ERROR','A equipe inicial de acolhimento exige e-mail institucional de notificação.');
      throw e;
    }
  }

  public async getSlaSettings(){const [config,calendar,exceptions]=await Promise.all([this.sla.getSlaConfig(),this.sla.getCalendar(),this.sla.listExceptions()]);return{config,calendar,exceptions};}
  public async updateSlaConfig(input:SlaConfiguration,expectedVersion:number,actor:AuthorizedAdminProfile,c:string):Promise<SlaConfiguration>{this.assertAdmin(actor);try{const out=await this.sla.updateSlaConfig(input,expectedVersion,actor.id);await this.audit.write({...this.auditBase(actor,'sla','default',c),eventType:'SLA_CONFIG_UPDATED',summary:`Matriz de SLA atualizada para a versão ${out.version}.`});return out;}catch(e){if(e instanceof SlaConfigVersionConflictError)throw new HttpError(409,'CONFLICT','A configuração de SLA foi atualizada por outro usuário.');throw e;}}
  public async updateCalendar(input:ServiceCalendar,expectedVersion:number,actor:AuthorizedAdminProfile,c:string):Promise<ServiceCalendar>{this.assertAdmin(actor);try{const out=await this.sla.updateCalendar(input,expectedVersion,actor.id);await this.audit.write({...this.auditBase(actor,'calendar','default',c),eventType:'SERVICE_CALENDAR_UPDATED',summary:`Calendário de atendimento atualizado para a versão ${out.version}.`});return out;}catch(e){if(e instanceof SlaConfigVersionConflictError)throw new HttpError(409,'CONFLICT','O calendário foi atualizado por outro usuário.');throw e;}}
  public async upsertCalendarException(input:Omit<ServiceCalendarException,'createdAt'|'createdBy'|'updatedAt'|'updatedBy'>,actor:AuthorizedAdminProfile,c:string):Promise<ServiceCalendarException>{this.assertAdmin(actor);const before=await this.sla.getException(input.id);const out=await this.sla.upsertException(input,actor.id);await this.audit.write({...this.auditBase(actor,'calendar',out.id,c),eventType:before?'SERVICE_CALENDAR_EXCEPTION_UPDATED':'SERVICE_CALENDAR_EXCEPTION_CREATED',summary:`Exceção de calendário ${before?'atualizada':'criada'}: ${out.label} (${out.date}).`});return out;}
  public async deleteCalendarException(id:string,actor:AuthorizedAdminProfile,c:string):Promise<void>{this.assertAdmin(actor);const before=await this.sla.getException(id);if(!before)throw new HttpError(404,'NOT_FOUND','Exceção de calendário não encontrada.');await this.sla.deleteException(id);await this.audit.write({...this.auditBase(actor,'calendar',id,c),eventType:'SERVICE_CALENDAR_EXCEPTION_DELETED',summary:`Exceção de calendário removida: ${before.label} (${before.date}).`});}

  public async analytics(input:AnalyticsFilters,actor?:AuthorizedAdminProfile):Promise<AnalyticsStats>{
    if(actor)this.assertAdminOrManager(actor);
    const period=defaultPeriod(input);
    const filters:{[K in keyof AnalyticsFilters]?:AnalyticsFilters[K]}={...input,startDate:period.startDate,endDate:period.endDate};
    const dimensions=analyticsFilterToOccurrence(filters,false);
    const createdBase:OccurrenceFilterOptions={...dimensions,startDate:period.startDate,endDate:period.endDate};
    const closedBase:OccurrenceFilterOptions={...dimensions,closedStartDate:period.startDate,closedEndDate:period.endDate};
    const reopenedBase:OccurrenceFilterOptions={...dimensions,reopenedStartDate:period.startDate,reopenedEndDate:period.endDate};
    const countStatus=(base:OccurrenceFilterOptions,status:OccurrenceStatus):Promise<number>=>base.status&&base.status!=='TODAS'&&base.status!==status?Promise.resolve(0):this.occurrences.countFiltered({...base,status});
    const countPriority=(base:OccurrenceFilterOptions,priority:OccurrencePriority):Promise<number>=>base.priority&&base.priority!=='TODAS'&&base.priority!==priority?Promise.resolve(0):this.occurrences.countFiltered({...base,priority});
    const [total,urgent,emergency,slaBreached,withoutTeam,withoutResponsible,resolved,notProceeding,duplicated,cancelled,reopened,currentTotal,currentResolved,currentNotProceeding,currentDuplicated,currentCancelled,createdSample,closedSample,fallbackCalendar,exceptions]=await Promise.all([
      this.occurrences.countFiltered(createdBase),countPriority(createdBase,'Urgente'),countPriority(createdBase,'Emergencial'),
      this.occurrences.countFiltered({...createdBase,slaStatus:'BREACHED'}),this.occurrences.countFiltered({...createdBase,withoutTeam:true}),this.occurrences.countFiltered({...createdBase,withoutResponsible:true}),
      countStatus(closedBase,'Resolvida'),countStatus(closedBase,'Não procedente'),countStatus(closedBase,'Duplicada'),countStatus(closedBase,'Cancelada'),
      this.occurrences.countFiltered(reopenedBase),this.occurrences.countFiltered(dimensions),countStatus(dimensions,'Resolvida'),countStatus(dimensions,'Não procedente'),countStatus(dimensions,'Duplicada'),countStatus(dimensions,'Cancelada'),
      this.occurrences.listForAnalytics(createdBase,ANALYTICS_LIMIT),this.occurrences.listForAnalytics(closedBase,ANALYTICS_LIMIT),this.sla.getCalendar(),this.sla.listExceptions(),
    ]);
    const openNow=Math.max(0,currentTotal-(currentResolved+currentNotProceeding+currentDuplicated+currentCancelled));
    const unavailable:string[]=[];
    if(createdSample.truncated)unavailable.push(`Métricas de primeira resposta e distribuições indisponíveis porque a coorte de aberturas contém mais de ${ANALYTICS_LIMIT} ocorrências; aplique filtros adicionais.`);
    if(closedSample.truncated)unavailable.push(`Métricas de encerramento indisponíveis porque a coorte de encerramentos contém mais de ${ANALYTICS_LIMIT} ocorrências; aplique filtros adicionais.`);
    const first:number[]=[];const totalClosure:number[]=[];const effective:number[]=[];const firstOutcomes:string[]=[];const resolutionOutcomes:string[]=[];
    const fallback={calendar:fallbackCalendar,exceptions};
    if(!createdSample.truncated){for(const o of createdSample.items){if(o.sla&&o.firstPublicResponseAt){const p=policyForSla(o.sla,fallback);first.push(businessMinutesBetween(o.createdAt,o.firstPublicResponseAt,p)/60);}if(o.sla?.firstResponseOutcome)firstOutcomes.push(o.sla.firstResponseOutcome);}}
    if(!closedSample.truncated){for(const o of closedSample.items){if(!o.closedAt)continue;totalClosure.push((o.closedAt.getTime()-o.createdAt.getTime())/3600000);if(o.sla){const p=policyForSla(o.sla,fallback);effective.push(effectiveResolutionMinutes(o.createdAt,o.closedAt,o.sla,p)/60);if(o.sla.resolutionOutcome)resolutionOutcomes.push(o.sla.resolutionOutcome);}}}
    const distributionItems=createdSample.truncated?[]:createdSample.items;
    return{period:{start:period.startDate,end:period.endDate},openNow,createdInPeriod:total,urgentOrEmergency:urgent+emergency,slaBreached,withoutTeam,withoutResponsible,resolvedInPeriod:resolved,closedInPeriod:resolved+notProceeding+duplicated+cancelled,reopenedInPeriod:reopened,averageFirstResponseBusinessHours:createdSample.truncated?null:mean(first),medianFirstResponseBusinessHours:createdSample.truncated?null:median(first),averageTotalClosureHours:closedSample.truncated?null:mean(totalClosure),medianTotalClosureHours:closedSample.truncated?null:median(totalClosure),averageEffectiveBusinessHours:closedSample.truncated?null:mean(effective),medianEffectiveBusinessHours:closedSample.truncated?null:median(effective),firstResponseOnTimePercent:createdSample.truncated?null:percent(firstOutcomes.filter(x=>x==='ON_TIME').length,firstOutcomes.length),resolutionOnTimePercent:closedSample.truncated?null:percent(resolutionOutcomes.filter(x=>x==='ON_TIME').length,resolutionOutcomes.length),byCategory:distribution(distributionItems,o=>o.categoryNameSnapshot),byStatus:distribution(distributionItems,o=>o.status),byPriority:distribution(distributionItems,o=>o.priority),byArea:distribution(distributionItems,o=>o.location.buildingName),byTeam:distribution(distributionItems,o=>o.assignedTeamNameSnapshot),byResponsible:distribution(distributionItems,o=>o.assignedToDisplayNameSnapshot),unavailableMetrics:unavailable};
  }

  public auditLogs(filters:AuditLogFilters,actor:AuthorizedAdminProfile):Promise<AuditLogPage>{this.assertAdmin(actor);return this.audit.page(filters);}

  public async exportOccurrences(format:ExportFormat,filters:OccurrenceFilterOptions,actor:AuthorizedAdminProfile,c:string):Promise<ExportResult>{
    this.assertAdminOrManager(actor);
    const result=await this.occurrences.listForExport(filters,EXPORT_LIMIT);
    if(result.truncated)throw new HttpError(400,'VALIDATION_ERROR',`A exportação excede o limite seguro de ${EXPORT_LIMIT} registros. Restrinja os filtros ou o período.`);
    let buffer:Buffer;let contentType:string;let extension:string;
    if(format==='csv'){buffer=createCsv(result.items);contentType='text/csv; charset=utf-8';extension='csv';}
    else if(format==='xlsx'){buffer=createXlsx(result.items);contentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';extension='xlsx';}
    else{buffer=createPdf(result.items,'Olhos do Campus — Relatório de ocorrências');contentType='application/pdf';extension='pdf';}
    await this.audit.write({...this.auditBase(actor,'report',undefined,c),eventType:'REPORT_EXPORTED',summary:`Relatório operacional exportado em ${format.toUpperCase()} com ${result.items.length} registros.`,metadata:{format,count:result.items.length,filters:JSON.stringify(filters).slice(0,1000)}});
    return{buffer,contentType,fileName:`olhos-do-campus-ocorrencias-${new Date().toISOString().slice(0,10)}.${extension}`,count:result.items.length};
  }

  public async purgeTestOccurrence(id:string,actor:AuthorizedAdminProfile,c:string):Promise<void>{this.assertAdmin(actor);const occurrence=await this.occurrences.getById(id);if(!occurrence)throw new HttpError(404,'NOT_FOUND','Ocorrência não encontrada.');if(occurrence.dataClassification!=='TEST')throw new HttpError(403,'FORBIDDEN','Ocorrências institucionais REAL não podem ser excluídas fisicamente.');const photos=await this.photos.listMetadata(id);for(const photo of photos)await this.photos.deleteObjectsOrQueue(photo,'Expurgo administrativo de ocorrência TEST',c);await this.occurrences.deleteOccurrenceTree(id);await this.audit.write({...this.auditBase(actor,'occurrence',id,c),eventType:'TEST_OCCURRENCE_DELETED',summary:`Ocorrência TEST excluída definitivamente. Protocolo histórico: ${occurrence.protocol}.`,metadata:{protocol:occurrence.protocol,photos:photos.length}});}
}
