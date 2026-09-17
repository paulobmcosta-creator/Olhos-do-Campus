import { computeBodyDigest, signMaintenanceRequest } from './signature';

export interface MaintenanceEnvironment { BACKEND_URL:string;MAINTENANCE_HMAC_SECRET:string; }
const NOTIFICATION_ENDPOINT='/api/internal/maintenance/notifications' as const;
const INFRASTRUCTURE_ENDPOINT='/api/internal/maintenance/infrastructure' as const;
function backendOrigin(value:string):string{const url=new URL(value);if(url.protocol!=='https:'||url.pathname!=='/'||url.search!==''||url.hash!=='')throw new Error('BACKEND_URL deve ser uma origem HTTPS sem caminho.');return url.origin;}
export function endpointsForCron(cron:string):readonly string[]{return cron==='15 3 * * *'?[INFRASTRUCTURE_ENDPOINT]:[NOTIFICATION_ENDPOINT];}
async function invoke(origin:string,path:string,secret:string):Promise<void>{
  const timestamp=String(Math.floor(Date.now()/1000));
  const body=JSON.stringify({limit:20});
  const bodyDigest=await computeBodyDigest(body);
  const signature=await signMaintenanceRequest(secret,'POST',path,timestamp,bodyDigest);
  const response=await fetch(`${origin}${path}`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Maintenance-Timestamp':timestamp,
      'X-Maintenance-Signature':signature,
    },
    body,
  });
  if(!response.ok)throw new Error(`Endpoint ${path} respondeu HTTP ${response.status}.`);
}
export async function runMaintenance(environment:MaintenanceEnvironment,endpoints:readonly string[]):Promise<void>{if(environment.MAINTENANCE_HMAC_SECRET.length<32)throw new Error('MAINTENANCE_HMAC_SECRET ausente ou curto demais.');const origin=backendOrigin(environment.BACKEND_URL);const results=await Promise.allSettled(endpoints.map(path=>invoke(origin,path,environment.MAINTENANCE_HMAC_SECRET)));const failures=results.filter((result):result is PromiseRejectedResult=>result.status==='rejected');if(failures.length>0)throw new Error(`${failures.length} endpoint(s) de manutenção falharam.`);}
