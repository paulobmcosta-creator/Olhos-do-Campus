import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/serverTestHarness';
import { createTestHarness, headers, multipartHeaders, occurrenceFormData, validOccurrenceBody } from './helpers/serverTestHarness';

let harness:TestHarness;
beforeAll(async()=>{harness=await createTestHarness();});afterAll(async()=>harness.close());
async function json(r:Response):Promise<Record<string,unknown>>{return await r.json() as Record<string,unknown>;}
async function createOccurrence(){const r=await fetch(`${harness.baseUrl}/api/occurrences`,{method:'POST',headers:multipartHeaders('anonymous-token'),body:occurrenceFormData()});expect(r.status).toBe(201);return await json(r);}
async function firstAdminOccurrence(){const r=await fetch(`${harness.baseUrl}/api/admin/occurrences`,{headers:headers('manager-token')});expect(r.status).toBe(200);const b=await json(r);return (b.items as Array<Record<string,unknown>>)[0]!;}

describe('API pública e segurança',()=>{
 it('exige App Check e autenticação anônima para criar',async()=>{const cases:Array<[Record<string,string>,number]>=[[headers('anonymous-token',''),401],[headers('anonymous-token','invalid'),403],[headers(),401],[headers('invalid-token'),401],[headers('admin-token'),403]];for(const [h,status] of cases){const r=await fetch(`${harness.baseUrl}/api/occurrences`,{method:'POST',headers:h,body:JSON.stringify(validOccurrenceBody)});expect(r.status).toBe(status);}});
 it('cria e acompanha sem expor segredos ou dados administrativos',async()=>{const created=await createOccurrence();expect(Object.keys(created).sort()).toEqual(['createdAt','protocol','trackingKey']);const r=await fetch(`${harness.baseUrl}/api/occurrences/track`,{method:'POST',headers:headers('anonymous-token'),body:JSON.stringify({protocol:created.protocol,trackingKey:created.trackingKey})});expect(r.status).toBe(200);const body=await json(r);for(const f of ['trackingKeyHash','trackingKeySalt','assignedToAdminUserId','internalNotes','version'])expect(body).not.toHaveProperty(f);});
});

describe('papéis administrativos 0.6.0',()=>{
 it('autoriza somente Administrador e Gestor',async()=>{for(const [token,role] of [['admin-token','Administrador'],['manager-token','Gestor']] as const){const r=await fetch(`${harness.baseUrl}/api/auth/admin-session`,{headers:headers(token)});expect(r.status).toBe(200);expect(await json(r)).toMatchObject({user:{role}});}const legacy=await fetch(`${harness.baseUrl}/api/auth/admin-session`,{headers:headers('legacy-token')});expect(legacy.status).toBe(403);expect((await json(legacy)).error).toMatchObject({code:'LEGACY_ROLE_REQUIRES_RESOLUTION'});});
 it('mantém gestão estrutural restrita ao Administrador',async()=>{expect((await fetch(`${harness.baseUrl}/api/admin/users`,{headers:headers('admin-token')})).status).toBe(200);expect((await fetch(`${harness.baseUrl}/api/admin/users`,{headers:headers('manager-token')})).status).toBe(403);expect((await fetch(`${harness.baseUrl}/api/admin/config`,{headers:headers('manager-token')})).status).toBe(403);});
 it('Administrador e Gestor administram ocorrências',async()=>{await createOccurrence();expect((await fetch(`${harness.baseUrl}/api/admin/occurrences`,{headers:headers('admin-token')})).status).toBe(200);expect((await fetch(`${harness.baseUrl}/api/admin/occurrences`,{headers:headers('manager-token')})).status).toBe(200);});
});

describe('locking e autoria',()=>{
 it('exige expectedVersion, rejeita conflito e deriva autoria do token',async()=>{await createOccurrence();const target=await firstAdminOccurrence();const id=String(target.id);expect((await fetch(`${harness.baseUrl}/api/admin/occurrences/${id}`,{method:'PATCH',headers:headers('manager-token'),body:JSON.stringify({priority:'Alta'})})).status).toBe(400);const first=await fetch(`${harness.baseUrl}/api/admin/occurrences/${id}`,{method:'PATCH',headers:headers('manager-token'),body:JSON.stringify({expectedVersion:target.version,priority:'Alta'})});expect(first.status).toBe(200);const conflict=await fetch(`${harness.baseUrl}/api/admin/occurrences/${id}`,{method:'PATCH',headers:headers('manager-token'),body:JSON.stringify({expectedVersion:target.version,newInternalNote:'Conflito'})});expect(conflict.status).toBe(409);const current=await firstAdminOccurrence();const note=await fetch(`${harness.baseUrl}/api/admin/occurrences/${id}`,{method:'PATCH',headers:headers('manager-token'),body:JSON.stringify({expectedVersion:current.version,newInternalNote:'Providência registrada.',internalNoteAudience:'ADMINS_AND_MANAGERS'})});expect(note.status).toBe(200);expect((await json(note)).internalNotes).toEqual(expect.arrayContaining([expect.objectContaining({authorRole:'Gestor'})]));});
});
