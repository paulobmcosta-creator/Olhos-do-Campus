import { describe, expect, it } from 'vitest';
import { OperationalAdminService } from '../server/services/operationalAdminService';
import { InMemoryAdminUserRepository } from '../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { DEFAULT_SERVICE_CALENDAR, DEFAULT_SLA_CONFIG, REFERENCE_CATEGORIES, REFERENCE_LOCATIONS } from '../server/repositories/referenceSeedData';
import { createSlaSnapshot } from '../server/domain/sla';
import { zonedLocalToDate } from '../server/domain/businessTime';
import type { AdminUser } from '../src/models/admin';
import { PRIORITY_RANK, type OccurrencePriority, type OccurrenceStatus } from '../src/models/occurrence';
import type { StoredOccurrence, StoredOccurrenceSla } from '../server/models/occurrenceDomain';
import { FakeCategoryRepository, FakeLocationRepository, FakeOccurrenceEventRepository, FakeOccurrenceRepository, FakeOperationalTeamRepository, FakeSlaConfigRepository } from './helpers/fakeRepositories';
import { makeTestPhotoService } from './helpers/fakePhotoInfrastructure';
import { profile } from './helpers/occurrenceServiceFixture';

const tz='America/Sao_Paulo';
const at=(date:string,time:string)=>zonedLocalToDate(date,time,tz);
const policy={calendar:structuredClone(DEFAULT_SERVICE_CALENDAR),exceptions:[]};
const illumination=REFERENCE_CATEGORIES.find(x=>x.id==='cat-iluminacao')!;
const cleaning=REFERENCE_CATEGORIES.find(x=>x.id==='cat-limpeza')!;
const structure=REFERENCE_CATEGORIES.find(x=>x.id==='cat-estrutura')!;
const other=REFERENCE_CATEGORIES.find(x=>x.id==='cat-outros')!;

const toUser=(p:ReturnType<typeof profile>):AdminUser=>({id:p.id,uid:p.uid,email:p.email,normalizedEmail:p.email,displayName:p.displayName,role:p.role,teamIds:p.teamIds,active:true,legacyRole:false,createdAt:'2026-08-01T00:00:00Z',createdBy:'test',updatedAt:'2026-08-01T00:00:00Z',updatedBy:'test'});

interface StoredInput {
  id:string;
  createdAt:Date;
  category:typeof illumination;
  priority:OccurrencePriority;
  status:OccurrenceStatus;
  closedAt?:Date;
  firstResponseAt?:Date;
  firstOutcome?:'ON_TIME'|'BREACHED';
  resolutionOutcome?:'ON_TIME'|'BREACHED';
  pausedMinutes?:number;
  reopenedAt?:Date;
  routed?:boolean;
  forceBreached?:boolean;
}

function occurrence(input:StoredInput):StoredOccurrence{
  let sla:StoredOccurrenceSla=createSlaSnapshot(input.createdAt,input.priority,input.category,DEFAULT_SLA_CONFIG,policy);
  if(input.firstResponseAt)sla={...sla,firstResponseAt:input.firstResponseAt,firstResponseOutcome:input.firstOutcome};
  if(input.closedAt)sla={...sla,completedAt:input.closedAt,resolutionOutcome:input.resolutionOutcome,accumulatedPausedBusinessMinutes:input.pausedMinutes??0};
  if(input.forceBreached)sla={...sla,resolutionDueAt:new Date('2020-01-01T12:00:00.000Z'),resolutionNearDueAt:new Date('2019-12-31T12:00:00.000Z')};
  const routed=input.routed!==false;
  return {
    id:input.id,schemaVersion:2,protocol:`INF-2026-${input.id.padStart(6,'0')}`,trackingKeyHash:'hash',trackingKeySalt:'salt',
    reportedCategoryId:input.category.id,reportedCategoryNameSnapshot:input.category.name,categoryId:input.category.id,categoryNameSnapshot:input.category.name,
    reportedLocation:{campusName:'IFES — Campus Barra de São Francisco',buildingId:'bloco-01',buildingName:'Bloco 01',floor:'',roomId:'sala-de-aula-1',room:'SALA DE AULA 1'},
    location:{campusName:'IFES — Campus Barra de São Francisco',buildingId:'bloco-01',buildingName:'Bloco 01',floor:'',roomId:'sala-de-aula-1',room:'SALA DE AULA 1'},
    description:'Fixture determinística do painel analítico.',immediateRisk:false,status:input.status,priority:input.priority,priorityRank:PRIORITY_RANK[input.priority],
    ...(routed?{assignedTeamId:'team-a',assignedTeamNameSnapshot:'Equipe A',assignedToAdminUserId:'admin-gestor',assignedToDisplayNameSnapshot:'Gestor A'}:{}),
    createdAt:input.createdAt,updatedAt:input.closedAt??input.createdAt,...(input.closedAt?{closedAt:input.closedAt}:{}),
    ...(input.status==='Resolvida'&&input.closedAt?{resolvedAt:input.closedAt}:{}),...(input.firstResponseAt?{firstPublicResponseAt:input.firstResponseAt}:{}),
    version:1,dataClassification:'REAL',reopenedCount:input.reopenedAt?1:0,...(input.reopenedAt?{lastReopenedAt:input.reopenedAt}:{}),hasPhoto:false,searchTokens:['fixture','analitica'],sla,
  };
}

function fixture(){
  const admin=profile('Administrador','admin@ifes.edu.br');
  const users=new InMemoryAdminUserRepository([toUser(admin)]);
  const occurrences=new FakeOccurrenceRepository(new FakeOccurrenceEventRepository());
  const service=new OperationalAdminService(new FakeCategoryRepository(structuredClone(REFERENCE_CATEGORIES)),new FakeLocationRepository(structuredClone(REFERENCE_LOCATIONS)),new FakeOperationalTeamRepository(),new FakeSlaConfigRepository(),users,occurrences,new InMemoryAuditLogRepository(),makeTestPhotoService().service);
  return{service,occurrences};
}

describe('indicadores determinísticos 0.6.0',()=>{
  it('calcula contagens, médias, medianas, percentuais e distribuições sem confundir abertura com encerramento',async()=>{
    const f=fixture();
    f.occurrences.setDirect(occurrence({id:'1',createdAt:at('2026-08-17','09:00'),category:illumination,priority:'Normal',status:'Resolvida',firstResponseAt:at('2026-08-17','11:00'),firstOutcome:'ON_TIME',closedAt:at('2026-08-18','11:00'),resolutionOutcome:'ON_TIME'}));
    f.occurrences.setDirect(occurrence({id:'2',createdAt:at('2026-08-17','09:00'),category:cleaning,priority:'Urgente',status:'Não procedente',firstResponseAt:at('2026-08-17','15:00'),firstOutcome:'BREACHED',closedAt:at('2026-08-19','09:00'),resolutionOutcome:'BREACHED'}));
    // Aberta antes do período, mas encerrada dentro dele: entra nas métricas de encerramento, não nas distribuições de aberturas.
    f.occurrences.setDirect(occurrence({id:'3',createdAt:at('2026-08-14','09:00'),category:structure,priority:'Normal',status:'Resolvida',closedAt:at('2026-08-17','09:00'),resolutionOutcome:'ON_TIME'}));
    f.occurrences.setDirect(occurrence({id:'4',createdAt:at('2026-08-18','09:00'),category:structure,priority:'Urgente',status:'Em atendimento',reopenedAt:at('2026-08-20','10:00'),routed:false,forceBreached:true}));
    f.occurrences.setDirect(occurrence({id:'5',createdAt:at('2026-08-21','09:00'),category:other,priority:'Normal',status:'Cancelada',closedAt:at('2026-08-21','13:00'),resolutionOutcome:'ON_TIME'}));

    const stats=await f.service.analytics({startDate:'2026-08-17',endDate:'2026-08-21'});
    expect(stats.openNow).toBe(1);
    expect(stats.createdInPeriod).toBe(4);
    expect(stats.urgentOrEmergency).toBe(2);
    expect(stats.slaBreached).toBe(1);
    expect(stats.withoutTeam).toBe(1);
    expect(stats.withoutResponsible).toBe(1);
    expect(stats.resolvedInPeriod).toBe(2);
    expect(stats.closedInPeriod).toBe(4);
    expect(stats.reopenedInPeriod).toBe(1);
    expect(stats.averageFirstResponseBusinessHours).toBe(4);
    expect(stats.medianFirstResponseBusinessHours).toBe(4);
    expect(stats.firstResponseOnTimePercent).toBe(50);
    expect(stats.averageTotalClosureHours).toBe(37.5);
    expect(stats.medianTotalClosureHours).toBe(37);
    expect(stats.averageEffectiveBusinessHours).toBe(11.5);
    expect(stats.medianEffectiveBusinessHours).toBe(11);
    expect(stats.resolutionOnTimePercent).toBe(75);
    expect(stats.byCategory).toEqual(expect.arrayContaining([{name:'Iluminação',value:1},{name:'Limpeza e conservação',value:1},{name:'Estrutura predial',value:1},{name:'Outros',value:1}]));
    expect(stats.byStatus.map(x=>[x.name,x.value])).toEqual(expect.arrayContaining([['Resolvida',1],['Não procedente',1],['Em atendimento',1],['Cancelada',1]]));
    expect(stats.byPriority).toEqual([{name:'Normal',value:2},{name:'Urgente',value:2}]);
    expect(stats.unavailableMetrics).toEqual([]);
  });
});
