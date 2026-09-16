import { describe, expect, it } from 'vitest';
import { createInput, makeOccurrenceServiceFixture } from './helpers/occurrenceServiceFixture';

describe('permissões operacionais da 0.6.0',()=>{
 it('Gestor e Administrador podem executar atos operacionais da ocorrência',async()=>{const {service,manager,administrator}=makeOccurrenceServiceFixture();await service.create(createInput,'c');let item=(await service.list({},manager)).items[0]!;item=await service.update(item.id,{expectedVersion:item.version,status:'Em triagem'},manager,'m1');item=await service.update(item.id,{expectedVersion:item.version,priority:'Alta'},administrator,'a1');expect(item.priority).toBe('Alta');expect(item.status).toBe('Em triagem');});
 it('Gestor pode registrar observação com audiência administrativa',async()=>{const {service,manager}=makeOccurrenceServiceFixture();await service.create(createInput,'c');const item=(await service.list({},manager)).items[0]!;const updated=await service.update(item.id,{expectedVersion:item.version,newInternalNote:'Providência registrada.',internalNoteAudience:'ADMINS_AND_MANAGERS'},manager,'n');expect(updated.internalNotes.at(-1)).toMatchObject({audience:'ADMINS_AND_MANAGERS',authorRole:'Gestor'});});
});
