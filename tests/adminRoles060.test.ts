import { describe, expect, it } from 'vitest';
import { AdminUserService } from '../server/services/adminUserService';
import { InMemoryAdminUserRepository } from '../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import type { AdminUser, AuthorizedAdminProfile } from '../src/models/admin';
import { ADMIN_ROLES } from '../src/models/admin';

const now='2026-08-16T00:00:00.000Z';
const actor=(role:'Administrador'|'Gestor',id=role.toLowerCase()):AuthorizedAdminProfile=>({id,uid:`uid-${id}`,email:`${id}@ifes.edu.br`,displayName:role,role,teamIds:[],active:true});
const legacy:AdminUser={id:'legacy',email:'legacy@ifes.edu.br',normalizedEmail:'legacy@ifes.edu.br',displayName:'Legado',role:'Atendente',teamIds:[],active:true,legacyRole:true,createdAt:now,createdBy:'test',updatedAt:now,updatedBy:'test'};

describe('papéis administrativos 0.8.0',()=>{
  it('mantém Administrador, Gestor e Atendente como papéis ativos no 0.8.0',()=>{expect(ADMIN_ROLES).toEqual(['Administrador','Gestor','Atendente']);});
  it('Gestor não cria usuário nem resolve papel legado',async()=>{const users=new InMemoryAdminUserRepository([legacy]);const service=new AdminUserService(users,new InMemoryAuditLogRepository(),['ifes.edu.br']);const manager=actor('Gestor');await expect(service.create({email:'novo@ifes.edu.br',displayName:'Novo',role:'Gestor'},manager,'c')).rejects.toMatchObject({status:403});await expect(service.resolveLegacy(legacy.id,{action:'CONVERT_TO_MANAGER'},manager,'c')).rejects.toMatchObject({status:403});expect(await users.getById(legacy.id)).toMatchObject({role:'Atendente',active:true,legacyRole:true});});
  it('Administrador escolhe explicitamente ativar como atendente, converter ou inativar usuário legado',async()=>{const users=new InMemoryAdminUserRepository([legacy,{...legacy,id:'legacy-2',email:'legacy2@ifes.edu.br',normalizedEmail:'legacy2@ifes.edu.br'},{...legacy,id:'legacy-3',email:'legacy3@ifes.edu.br',normalizedEmail:'legacy3@ifes.edu.br'}]);const service=new AdminUserService(users,new InMemoryAuditLogRepository(),['ifes.edu.br']);const admin=actor('Administrador');expect(await service.resolveLegacy('legacy',{action:'ACTIVATE_AS_ATTENDANT'},admin,'c1')).toMatchObject({role:'Atendente',legacyRole:false,active:true});expect(await service.resolveLegacy('legacy-2',{action:'CONVERT_TO_MANAGER'},admin,'c2')).toMatchObject({role:'Gestor',legacyRole:false,active:true});expect(await service.resolveLegacy('legacy-3',{action:'DEACTIVATE'},admin,'c3')).toMatchObject({role:'Atendente',legacyRole:true,active:false});});
});
