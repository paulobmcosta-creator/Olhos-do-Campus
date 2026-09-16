import { describe, expect, it } from 'vitest';
import type { AdminUser } from '../src/models/admin';
import { InMemoryAdminUserRepository } from '../server/repositories/adminUserRepository';
import { InMemoryAuditLogRepository } from '../server/repositories/auditLogRepository';
import { AdminAuthorizationService } from '../server/services/adminAuthorizationService';
import type { VerifiedFirebaseUser } from '../server/types/firebase';
import { hashNormalizedEmail, normalizeEmail } from '../server/utils/email';

const now='2026-08-16T00:00:00.000Z';
function user(role:AdminUser['role'],email:string,uid='firebase-uid'):AdminUser{return{id:hashNormalizedEmail(email),email,normalizedEmail:email,uid,displayName:role,role,teamIds:[],active:true,legacyRole:role==='Atendente',createdAt:now,createdBy:'test',updatedAt:now,updatedBy:'test'};}
const google:VerifiedFirebaseUser={uid:'firebase-uid',email:'ADMIN@IFES.EDU.BR',emailVerified:true,displayName:'Google',provider:'google.com'};
function service(users:AdminUser[]){return new AdminAuthorizationService(new InMemoryAdminUserRepository(users),new InMemoryAuditLogRepository(),['ifes.edu.br']);}

describe('autorização administrativa 0.6.0',()=>{
 it('normaliza e produz hash determinístico',()=>{expect(normalizeEmail(' ADMIN@IFES.EDU.BR ')).toBe('admin@ifes.edu.br');expect(hashNormalizedEmail('admin@ifes.edu.br')).toMatch(/^[a-f0-9]{64}$/u);});
 it('autoriza exclusivamente Administrador e Gestor ativos',async()=>{for(const role of ['Administrador','Gestor'] as const){const email='admin@ifes.edu.br';expect((await service([user(role,email)]).authorize(google,'c')).role).toBe(role);}});
 it('rejeita papel legado sem promovê-lo automaticamente',async()=>{const legacy=user('Atendente','admin@ifes.edu.br');await expect(service([legacy]).authorize(google,'c')).rejects.toMatchObject({code:'LEGACY_ROLE_REQUIRES_RESOLUTION'});expect(legacy.role).toBe('Atendente');});
 it('rejeita provedor, verificação, domínio e ausência de cadastro',async()=>{await expect(service([]).authorize({...google,provider:'password'},'c')).rejects.toMatchObject({code:'PROVIDER_NOT_ALLOWED'});await expect(service([]).authorize({...google,emailVerified:false},'c')).rejects.toMatchObject({code:'EMAIL_NOT_VERIFIED'});await expect(service([]).authorize({...google,email:'admin@example.org'},'c')).rejects.toMatchObject({code:'DOMAIN_NOT_ALLOWED'});await expect(service([]).authorize(google,'c')).rejects.toMatchObject({code:'ADMIN_NOT_AUTHORIZED'});});
});
