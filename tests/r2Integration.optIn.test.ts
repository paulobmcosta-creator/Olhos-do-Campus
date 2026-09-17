// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { R2PhotoRepository } from '../server/repositories/r2PhotoRepository';

const enabled=process.env.RUN_R2_INTEGRATION==='true';
describe.skipIf(!enabled)('integração R2 opt-in',()=>{
  it('grava, lê, verifica e remove um objeto técnico isolado',async()=>{const required=(name:string):string=>{const value=process.env[name];if(value===undefined||value==='')throw new Error(`${name} ausente.`);return value;};const repository=new R2PhotoRepository({accountId:required('R2_ACCOUNT_ID'),accessKeyId:required('R2_ACCESS_KEY_ID'),secretAccessKey:required('R2_SECRET_ACCESS_KEY'),bucketName:required('R2_BUCKET_NAME'),...(process.env.R2_ENDPOINT===undefined?{}:{endpoint:process.env.R2_ENDPOINT})});const occurrenceId=randomUUID(),photoId=randomUUID(),path=`occurrences/${occurrenceId}/initial/${photoId}.webp`,bytes=Buffer.from('RIFF-opt-in-test-WEBP');try{await repository.save(path,bytes,{occurrenceId,photoId,kind:'INITIAL'});expect(await repository.read(path)).toEqual(bytes);expect(await repository.getMetadata(path)).toMatchObject({size:bytes.length,contentType:'image/webp'});}finally{await repository.delete(path);}});
});
