// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/serverTestHarness';
import { createTestHarness } from './helpers/serverTestHarness';

let harness:TestHarness;
beforeEach(async()=>{harness=await createTestHarness();});
afterEach(async()=>{await harness.close();});

describe('Cloudflare Pages, API base e CORS 0.7.0',()=>{
  it('autoriza origem explícita e envia Vary sem credentials',async()=>{const response=await fetch(`${harness.baseUrl}/api/health`,{headers:{Origin:'http://localhost:5173'}});expect(response.status).toBe(200);expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');expect(response.headers.get('vary')).toContain('Origin');expect(response.headers.get('access-control-allow-credentials')).toBeNull();});
  it('bloqueia origem não cadastrada',async()=>{const response=await fetch(`${harness.baseUrl}/api/health`,{headers:{Origin:'https://malicioso.example'}});expect(response.status).toBe(403);expect(response.headers.get('access-control-allow-origin')).toBeNull();});
  it('trata preflight com Authorization e X-Firebase-AppCheck',async()=>{const response=await fetch(`${harness.baseUrl}/api/occurrences`,{method:'OPTIONS',headers:{Origin:'http://localhost:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,x-firebase-appcheck'}});expect(response.status).toBe(204);expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');expect(response.headers.get('access-control-allow-headers')).toContain('X-Firebase-AppCheck');});
  it('usa VITE_API_BASE_URL, inclui fallback SPA e mantém Cloud Run API-only',()=>{const frontend=readFileSync(join(process.cwd(),'src/services/apiClient.ts'),'utf8');const environment=readFileSync(join(process.cwd(),'src/config/env.ts'),'utf8');const redirects=readFileSync(join(process.cwd(),'public/_redirects'),'utf8');const server=readFileSync(join(process.cwd(),'server/index.ts'),'utf8');expect(environment).toContain('VITE_API_BASE_URL');expect(frontend).toContain('FRONTEND_ENV.apiBaseUrl');expect(redirects.trim()).toBe('/* /index.html 200');expect(server).not.toContain('express.static');expect(server).not.toContain('sendFile');});
  it('restringe Infraestrutura e capacidade ao Administrador',async()=>{const manager=await fetch(`${harness.baseUrl}/api/admin/infrastructure`,{headers:{Authorization:'Bearer manager-token','X-Firebase-AppCheck':'valid-app-check'}});expect(manager.status).toBe(403);const admin=await fetch(`${harness.baseUrl}/api/admin/infrastructure`,{headers:{Authorization:'Bearer admin-token','X-Firebase-AppCheck':'valid-app-check'}});expect(admin.status).toBe(200);});
});
