// @vitest-environment node
import express from 'express';
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { computeBodyDigest, maintenanceSignature, requireMaintenanceSignature } from '../server/middleware/requireMaintenanceSignature';
import { errorHandler } from '../server/middleware/errorHandler';

const servers: Server[] = [];

async function endpoint(secret: string | undefined): Promise<string> {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.post('/api/internal/maintenance/notifications', requireMaintenanceSignature(secret), (_request, response) => response.json({ ok: true }));
  app.use(errorHandler);
  const server = await new Promise<Server>((resolve) => {
    const value = app.listen(0, '127.0.0.1', () => resolve(value));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe('assinatura HMAC dos endpoints internos (G09B-F005)', () => {
  it('aceita assinatura válida vinculando method, path, timestamp e bodyDigest', async () => {
    const secret = 's'.repeat(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const body = JSON.stringify({ limit: 20 });
    const digest = computeBodyDigest(body);
    const sig = maintenanceSignature(secret, 'POST', path, timestamp, digest);
    const headers = {
      'X-Maintenance-Timestamp': timestamp,
      'X-Maintenance-Signature': sig,
      'Content-Type': 'application/json',
    };
    const res = await fetch(`${base}${path}`, { method: 'POST', headers, body });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejeita assinatura com body alterado (tampering)', async () => {
    const secret = 's'.repeat(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const originalBody = JSON.stringify({ limit: 20 });
    const digest = computeBodyDigest(originalBody);
    const sig = maintenanceSignature(secret, 'POST', path, timestamp, digest);
    const headers = {
      'X-Maintenance-Timestamp': timestamp,
      'X-Maintenance-Signature': sig,
      'Content-Type': 'application/json',
    };
    const tamperedBody = JSON.stringify({ limit: 999 });
    const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: tamperedBody });
    expect(res.status).toBe(401);
  });

  it('aceita body vazio quando assinado com digest de corpo vazio', async () => {
    const secret = 's'.repeat(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const body = '';
    const digest = computeBodyDigest(body);
    const sig = maintenanceSignature(secret, 'POST', path, timestamp, digest);
    const headers = {
      'X-Maintenance-Timestamp': timestamp,
      'X-Maintenance-Signature': sig,
      'Content-Type': 'application/json',
    };
    const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: undefined });
    expect(res.status).toBe(200);
  });

  it('rejeita assinatura inválida ou método alterado', async () => {
    const secret = 's'.repeat(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const body = JSON.stringify({ limit: 20 });
    const digest = computeBodyDigest(body);
    const sigGet = maintenanceSignature(secret, 'GET', path, timestamp, digest);
    const headers = {
      'X-Maintenance-Timestamp': timestamp,
      'X-Maintenance-Signature': sigGet,
      'Content-Type': 'application/json',
    };
    expect((await fetch(`${base}${path}`, { method: 'POST', headers, body })).status).toBe(401);
    expect((await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, 'X-Maintenance-Signature': '0'.repeat(64) }, body })).status).toBe(401);
  });

  it('rejeita assinatura para path incorreto', async () => {
    const secret = 's'.repeat(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const body = JSON.stringify({ limit: 20 });
    const digest = computeBodyDigest(body);
    const sigWrongPath = maintenanceSignature(secret, 'POST', '/outro-path', timestamp, digest);
    const headers = {
      'X-Maintenance-Timestamp': timestamp,
      'X-Maintenance-Signature': sigWrongPath,
      'Content-Type': 'application/json',
    };
    expect((await fetch(`${base}${path}`, { method: 'POST', headers, body })).status).toBe(401);
  });

  it('rejeita replay fora da janela (timestamp expirado) e formato de timestamp inválido', async () => {
    const secret = 's'.repeat(32);
    const now = Math.floor(Date.now() / 1000);
    const old = String(now - 301);
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const body = JSON.stringify({ limit: 20 });
    const digest = computeBodyDigest(body);
    const sigOld = maintenanceSignature(secret, 'POST', path, old, digest);
    const headers = {
      'X-Maintenance-Timestamp': old,
      'X-Maintenance-Signature': sigOld,
      'Content-Type': 'application/json',
    };
    expect((await fetch(`${base}${path}`, { method: 'POST', headers, body })).status).toBe(401);
    expect((await fetch(`${base}${path}`, { method: 'POST', headers: { ...headers, 'X-Maintenance-Timestamp': 'abc' }, body })).status).toBe(401);
  });

  it('rejeita assinatura no esquema legado sem digest de corpo', async () => {
    const secret = 's'.repeat(32);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const base = await endpoint(secret);
    const path = '/api/internal/maintenance/notifications';
    const body = JSON.stringify({ limit: 20 });
    const legacySig = createHmac('sha256', secret).update(`POST\n${path}\n${timestamp}`, 'utf8').digest('hex');
    const headers = {
      'X-Maintenance-Timestamp': timestamp,
      'X-Maintenance-Signature': legacySig,
      'Content-Type': 'application/json',
    };
    expect((await fetch(`${base}${path}`, { method: 'POST', headers, body })).status).toBe(401);
  });

  it('retorna 503 quando o segredo não está configurado', async () => {
    const unconfigured = await endpoint(undefined);
    const path = '/api/internal/maintenance/notifications';
    expect((await fetch(`${unconfigured}${path}`, { method: 'POST' })).status).toBe(503);
  });
});
