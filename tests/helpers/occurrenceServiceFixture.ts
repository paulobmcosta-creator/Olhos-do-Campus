import type { AuthorizedAdminProfile, AdminUser } from '../../src/models/admin';
import type { OperationalTeam } from '../../src/models/operations';
import { InMemoryAdminUserRepository } from '../../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../../server/repositories/auditLogRepository';
import { DEFAULT_OPERATIONAL_CONFIG, REFERENCE_LOCATIONS, REFERENCE_CATEGORIES } from '../../server/repositories/referenceSeedData';
import { OccurrenceService } from '../../server/services/occurrenceService';
import { hashNormalizedEmail } from '../../server/utils/email';
import { FakeCategoryRepository, FakeLocationRepository, FakeOccurrenceEventRepository, FakeOccurrenceRepository, FakeOperationalTeamRepository, FakeSlaConfigRepository, FakeSystemConfigRepository } from './fakeRepositories';
import { makeTestPhotoService } from './fakePhotoInfrastructure';

export function profile(role: AuthorizedAdminProfile['role'], email = `${role.toLowerCase()}@ifes.edu.br`, teamIds:string[]=[]): AuthorizedAdminProfile {
  return { id: hashNormalizedEmail(email), uid: `${role}-${hashNormalizedEmail(email).slice(0,8)}`, email, displayName: role, role, teamIds, active: true };
}
function adminUser(p:AuthorizedAdminProfile):AdminUser{return{id:p.id,uid:p.uid,email:p.email,normalizedEmail:p.email,displayName:p.displayName,role:p.role,teamIds:p.teamIds,active:true,legacyRole:false,createdAt:'2026-08-10T00:00:00.000Z',createdBy:'test',updatedAt:'2026-08-10T00:00:00.000Z',updatedBy:'test'};}
export function makeOccurrenceServiceFixture(){
 const events=new FakeOccurrenceEventRepository();const photo=makeTestPhotoService();const occurrences=new FakeOccurrenceRepository(events,photo.metadata);
 const administrator=profile('Administrador','admin@ifes.edu.br',['team-admin']);const manager=profile('Gestor','gestor@ifes.edu.br',['team-admin']);const secondManager=profile('Gestor','gestor2@ifes.edu.br',[]);
 const adminUsers=new InMemoryAdminUserRepository([adminUser(administrator),adminUser(manager),adminUser(secondManager)]);const auditLogs=new InMemoryAuditLogRepository();
 const team:OperationalTeam={id:'team-admin',schemaVersion:1,name:'Coordenação Geral de Administração / Engenharia',active:true,sortOrder:1,memberAdminUserIds:[administrator.id,manager.id],createdAt:'2026-08-10T00:00:00.000Z',createdBy:'test',updatedAt:'2026-08-10T00:00:00.000Z',updatedBy:'test'};
 const teams=new FakeOperationalTeamRepository([team]);const sla=new FakeSlaConfigRepository();
 const service=new OccurrenceService(occurrences,events,new FakeCategoryRepository(REFERENCE_CATEGORIES),new FakeLocationRepository(REFERENCE_LOCATIONS),new FakeSystemConfigRepository(DEFAULT_OPERATIONAL_CONFIG),adminUsers,teams,sla,auditLogs,photo.service);
 return{service,occurrences,events,adminUsers,auditLogs,teams,sla,administrator,manager,secondManager};
}
export const createInput={location:{campusId:'ifes-bsf',buildingId:'bloco-01',floorId:'sem-pavimento',roomId:'sala-de-aula-1'},categoryId:'cat-iluminacao',description:'A luminária do ambiente não está funcionando durante o período de uso.',immediateRisk:false} as const;
