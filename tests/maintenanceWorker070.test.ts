// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { computeBodyDigest as backendComputeDigest, maintenanceSignature } from '../server/middleware/requireMaintenanceSignature';
import { endpointsForCron, runMaintenance } from '../infra/cloudflare/maintenance-worker/src/maintenance';
import { computeBodyDigest as workerComputeDigest, signMaintenanceRequest } from '../infra/cloudflare/maintenance-worker/src/signature';
import { APP_VERSION } from '../src/config/version';

describe('Cloudflare Maintenance Worker 1.0.1', () => {
  it('WORKER_RUNTIME_VERSION_TEST: runtime health reporta versão 1.0.1 e coincide com APP_VERSION', () => {
    const workerSource = readFileSync('infra/cloudflare/maintenance-worker/src/index.ts', 'utf-8');
    const statusMatch = workerSource.match(/status:\s*['"]([^'"]+)['"]/);
    const componentMatch = workerSource.match(/component:\s*['"]([^'"]+)['"]/);
    const versionMatch = workerSource.match(/version:\s*['"]([^'"]+)['"]/);

    expect(statusMatch).not.toBeNull();
    expect(componentMatch).not.toBeNull();
    expect(versionMatch).not.toBeNull();

    expect(statusMatch?.[1]).toBe('ok');
    expect(componentMatch?.[1]).toBe('maintenance-worker');
    expect(versionMatch?.[1]).toBe(APP_VERSION);
    expect(versionMatch?.[1]).toBe('1.0.1');
  });

  it('gera HMAC compatível com o backend para método, path, timestamp e bodyDigest', async () => {
    const secret='s'.repeat(32),timestamp='1755518400',path='/api/internal/maintenance/notifications';
    const body=JSON.stringify({limit:20});
    const bodyDigest=createHash('sha256').update(body).digest('hex');
    const expected=createHmac('sha256',secret).update(`POST\n${path}\n${timestamp}\n${bodyDigest}`,'utf8').digest('hex');
    expect(backendComputeDigest(body)).toBe(bodyDigest);
    expect(await workerComputeDigest(body)).toBe(bodyDigest);
    expect(maintenanceSignature(secret,'POST',path,timestamp,bodyDigest)).toBe(expected);
    expect(await signMaintenanceRequest(secret,'POST',path,timestamp,bodyDigest)).toBe(expected);
    expect(maintenanceSignature(secret,'POST','/outro',timestamp,bodyDigest)).not.toBe(expected);
    expect(maintenanceSignature(secret,'POST',path,timestamp,'digest-diferente')).not.toBe(expected);
  });
  it('separa a chamada frequente de notificações do snapshot diário',()=>{expect(endpointsForCron('*/10 * * * *')).toEqual(['/api/internal/maintenance/notifications']);expect(endpointsForCron('15 3 * * *')).toEqual(['/api/internal/maintenance/infrastructure']);});
  it('assina e chama somente os endpoints esperados',async()=>{const calls:Array<[RequestInfo|URL,RequestInit|undefined]>=[];const fetchMock=vi.fn((input:RequestInfo|URL,init?:RequestInit)=>{calls.push([input,init]);return Promise.resolve(new Response('{}',{status:200}));});vi.stubGlobal('fetch',fetchMock);await runMaintenance({BACKEND_URL:'https://api.example',MAINTENANCE_HMAC_SECRET:'x'.repeat(32)},endpointsForCron('15 3 * * *'));expect(fetchMock).toHaveBeenCalledTimes(1);const[url,request]=calls[0]!;expect(url).toBe('https://api.example/api/internal/maintenance/infrastructure');expect(request?.headers).toMatchObject({'X-Maintenance-Timestamp':expect.any(String),'X-Maintenance-Signature':expect.stringMatching(/^[a-f0-9]{64}$/u)});vi.unstubAllGlobals();});
  it('rejeita origem insegura e segredo ausente/curto',async()=>{await expect(runMaintenance({BACKEND_URL:'http://api.example',MAINTENANCE_HMAC_SECRET:'x'.repeat(32)},[])).rejects.toThrow('HTTPS');await expect(runMaintenance({BACKEND_URL:'https://api.example',MAINTENANCE_HMAC_SECRET:'curto'},[])).rejects.toThrow('curto');});

  it('WORKER_CONFIG_CRONS_TEST: wrangler.jsonc define exatamente os crons esperados', () => {
    const raw = readFileSync('infra/cloudflare/maintenance-worker/wrangler.jsonc', 'utf-8');
    const sanitized = raw.replace(/^\s*\/\/.*$/gm, '');
    const config = JSON.parse(sanitized);
    const crons = config.triggers?.crons;
    expect(crons).toBeDefined();
    expect(Array.isArray(crons)).toBe(true);
    expect(crons).toHaveLength(2);
    expect(crons).toEqual(['*/10 * * * *', '15 3 * * *']);
  });

  it('WORKER_CONFIG_NAME_TEST: wrangler.jsonc define o nome exato do Worker', () => {
    const raw = readFileSync('infra/cloudflare/maintenance-worker/wrangler.jsonc', 'utf-8');
    const sanitized = raw.replace(/^\s*\/\/.*$/gm, '');
    const config = JSON.parse(sanitized);
    expect(config.name).toBe('olhos-do-campus-maintenance');
  });
});

