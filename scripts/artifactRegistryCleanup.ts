import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function required(name: string): string { const value=process.env[name]?.trim();if(value===undefined||value==='')throw new Error(`${name} é obrigatório.`);return value; }
const apply = process.argv.includes('--apply');
if (apply && process.env.CONFIRM_ARTIFACT_REGISTRY_CLEANUP !== 'APPLY_REVIEWED_ARTIFACT_REGISTRY_POLICY') throw new Error('Apply recusado. Defina CONFIRM_ARTIFACT_REGISTRY_CLEANUP=APPLY_REVIEWED_ARTIFACT_REGISTRY_POLICY após revisar o dry-run.');
const project=required('ARTIFACT_REGISTRY_PROJECT_ID'),location=required('ARTIFACT_REGISTRY_LOCATION'),repository=required('ARTIFACT_REGISTRY_REPOSITORY');
const policy=resolve(process.cwd(),'infra/artifact-registry-cleanup-policy.json');
const argumentsList=['artifacts','repositories','set-cleanup-policies',repository,`--project=${project}`,`--location=${location}`,`--policy=${policy}`,apply?'--no-dry-run':'--dry-run','--quiet'];
console.log(`Configurando política revisável do Artifact Registry em modo ${apply?'APPLY':'DRY-RUN'}.`);
const result=spawnSync('gcloud',argumentsList,{stdio:'inherit',shell:false});
if(result.error!==undefined)throw result.error;
if(result.status!==0)process.exitCode=result.status??1;
