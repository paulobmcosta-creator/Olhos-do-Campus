// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ResendEmailProvider } from '../server/providers/resendEmailProvider';

const enabled=process.env.RUN_RESEND_INTEGRATION==='true';
describe.skipIf(!enabled)('integração Resend opt-in',()=>{
  it('envia uma mensagem explicitamente autorizada',async()=>{const required=(name:string):string=>{const value=process.env[name];if(value===undefined||value==='')throw new Error(`${name} ausente.`);return value;};const provider=new ResendEmailProvider(required('RESEND_API_KEY'));const recipient=required('RESEND_INTEGRATION_RECIPIENT');const marker=randomUUID();const result=await provider.send({message:{from:required('RESEND_FROM'),to:recipient,subject:`Teste opt-in Olhos do Campus ${marker}`,text:`Teste de integração opt-in ${marker}.`,html:`<p>Teste de integração opt-in ${marker}.</p>`},idempotencyKey:`integration/${marker}`,notificationId:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',attemptId:'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'});expect(result.providerMessageId).toBeTruthy();});
});
