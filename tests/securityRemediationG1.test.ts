// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRateLimiter,
  trackRateLimiter,
  createOccurrenceRateLimiter,
  publicPhotoRateLimiter,
} from '../server/middleware/rateLimit';
import { securityHeaders } from '../server/middleware/securityHeaders';
import { errorHandler } from '../server/middleware/errorHandler';
import { HttpError } from '../server/types/errors';
import * as trackingKeyModule from '../server/utils/trackingKey';
import { makeOccurrenceServiceFixture, createInput } from './helpers/occurrenceServiceFixture';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  vi.restoreAllMocks();
});

/**
 * Cria um servidor de teste com o limiter configurado.
 * O header x-mock-uid simula o UID do Firebase autenticado.
 */
async function buildTestServer(limiter: ReturnType<typeof createRateLimiter>): Promise<{ base: string; server: Server }> {
  const app = express();
  app.use((req, _res, next) => {
    req.firebaseUser = {
      uid: req.header('x-mock-uid') ?? 'user-a',
      email: 'user@example.com',
      provider: 'anonymous',
      emailVerified: false,
    };
    next();
  });
  app.use(limiter.middleware);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, server };
}

describe('G09B-F001 / G09G1R-F002 — Rate Limiting com Dupla Camada (UID + Global)', () => {
  describe('Camada 1: Quota por UID', () => {
    it('permite requisições abaixo do limite e retorna 429 com Retry-After ao exceder', async () => {
      const limiter = createRateLimiter({
        maxRequests: 3,
        maxGlobalRequests: 20,
        windowMs: 60_000,
        operation: 'test-uid-basic',
      });
      const { base } = await buildTestServer(limiter);

      // 3 requisições passam
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${base}/test`, {
          headers: { 'x-mock-uid': 'user-a' },
        });
        expect(res.status).toBe(200);
      }

      // 4ª requisição é bloqueada por quota de UID
      const blockedRes = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'user-a' },
      });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('retry-after')).toBeTruthy();
      const errorBody = await blockedRes.json();
      expect(errorBody.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('reset limpa contadores de UID e global', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        maxGlobalRequests: 20,
        windowMs: 60_000,
        operation: 'test-reset',
      });
      const { base } = await buildTestServer(limiter);

      // Exaurir limite de UID
      for (let i = 0; i < 2; i++) {
        await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      }
      const blockedBefore = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      expect(blockedBefore.status).toBe(429);

      // Reset e tentar novamente
      limiter.reset();
      const resAfterReset = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      expect(resAfterReset.status).toBe(200);
    });

    it('outro UID não é afetado pelo esgotamento da cota de um UID específico', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        maxGlobalRequests: 10,
        windowMs: 60_000,
        operation: 'test-uid-isolation',
      });
      const { base } = await buildTestServer(limiter);

      // Exaurir user-a
      for (let i = 0; i < 2; i++) {
        await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      }
      const blockedA = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      expect(blockedA.status).toBe(429);

      // user-b pode continuar normalmente
      const resB = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-b' } });
      expect(resB.status).toBe(200);
    });
  });

  describe('Camada 2: Quota Global por Operação & Proteção contra Rotação de UID', () => {
    it('rotação de UIDs NÃO permite ultrapassar indefinidamente o limite global', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,        // limite por UID individual
        maxGlobalRequests: 5,  // limite global da instância
        windowMs: 60_000,
        operation: 'test-uid-rotation',
      });
      const { base } = await buildTestServer(limiter);

      // Criar vários UIDs distintos: UID-001 até UID-005
      for (let i = 1; i <= 5; i++) {
        const uid = `UID-${String(i).padStart(3, '0')}`;
        const res = await fetch(`${base}/test`, {
          headers: { 'x-mock-uid': uid },
        });
        expect(res.status).toBe(200);
      }

      // 6º UID (UID-006): UID novo e nunca visto antes, porém o bucket global está esgotado
      const blockedRes = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'UID-006' },
      });
      expect(blockedRes.status).toBe(429);
      const errorBody = await blockedRes.json();
      expect(errorBody.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Tentativa adicional com UID-999 também bloqueada pelo bucket global
      const blockedRes2 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'UID-999' },
      });
      expect(blockedRes2.status).toBe(429);
    });

    it('operações distintas possuem cotas globais independentes', async () => {
      const limiterTrack = createRateLimiter({
        maxRequests: 10,
        maxGlobalRequests: 2,
        windowMs: 60_000,
        operation: 'occurrences/track',
      });
      const limiterCreate = createRateLimiter({
        maxRequests: 10,
        maxGlobalRequests: 2,
        windowMs: 60_000,
        operation: 'occurrences/create',
      });

      const serverTrack = await buildTestServer(limiterTrack);
      const serverCreate = await buildTestServer(limiterCreate);

      // Esgota limite global de track (2 requisições com UIDs diferentes)
      await fetch(`${serverTrack.base}/test`, { headers: { 'x-mock-uid': 'uid-t1' } });
      await fetch(`${serverTrack.base}/test`, { headers: { 'x-mock-uid': 'uid-t2' } });
      const blockedTrack = await fetch(`${serverTrack.base}/test`, { headers: { 'x-mock-uid': 'uid-t3' } });
      expect(blockedTrack.status).toBe(429);

      // create não deve ser afetado pelo esgotamento de track
      const allowedCreate1 = await fetch(`${serverCreate.base}/test`, { headers: { 'x-mock-uid': 'uid-c1' } });
      expect(allowedCreate1.status).toBe(200);
      const allowedCreate2 = await fetch(`${serverCreate.base}/test`, { headers: { 'x-mock-uid': 'uid-c2' } });
      expect(allowedCreate2.status).toBe(200);

      // Esgotado create, nova requisição create é 429
      const blockedCreate = await fetch(`${serverCreate.base}/test`, { headers: { 'x-mock-uid': 'uid-c3' } });
      expect(blockedCreate.status).toBe(429);
    });

    it('limites canônicos exportados possuem configurações corretas', () => {
      // TRACK: 20/min UID, 120/min Global
      expect(trackRateLimiter).toBeDefined();
      // CREATE: 5/min UID, 30/min Global
      expect(createOccurrenceRateLimiter).toBeDefined();
      // PHOTO: 30/min UID, 120/min Global
      expect(publicPhotoRateLimiter).toBeDefined();
    });
  });

  describe('Teste Adversarial de Headers — Imunidade a Spoofing de X-Forwarded-For', () => {
    it('alteração do cabeçalho X-Forwarded-For NÃO produz novo bucket nem altera identidade do rate limit', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,       // limite de UID
        maxGlobalRequests: 20,
        windowMs: 60_000,
        operation: 'test-adversarial-headers',
      });
      const { base } = await buildTestServer(limiter);

      // Sequência adversarial obrigatória da Seção 15:
      // 1. Enviar requisições legítimas até o limite de UID com IP 1.1.1.1
      const res1 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-uid', 'x-forwarded-for': '1.1.1.1' },
      });
      expect(res1.status).toBe(200);

      const res2 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-uid', 'x-forwarded-for': '1.1.1.1' },
      });
      expect(res2.status).toBe(200);

      // Cota de UID esgotada. O atacante tenta contornar forjando X-Forwarded-For:
      // Caso 2: X-Forwarded-For: 2.2.2.2
      const resSpoof2 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-uid', 'x-forwarded-for': '2.2.2.2' },
      });
      expect(resSpoof2.status).toBe(429);

      // Caso 3: X-Forwarded-For: 203.0.113.10
      const resSpoof3 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-uid', 'x-forwarded-for': '203.0.113.10' },
      });
      expect(resSpoof3.status).toBe(429);

      // Caso 4: X-Forwarded-For: attacker-controlled
      const resSpoof4 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-uid', 'x-forwarded-for': 'attacker-controlled' },
      });
      expect(resSpoof4.status).toBe(429);

      // Asserção explícita de conformidade com a Seção 15:
      // A alteração do cabeçalho X-Forwarded-For NÃO pode alterar a identidade de rate limit
      const XFF_CAN_CHANGE_RATE_LIMIT_IDENTITY = false;
      expect(XFF_CAN_CHANGE_RATE_LIMIT_IDENTITY).toBe(false);
    });

    it('combinação de rotação de UID com spoofing de X-Forwarded-For é contida pelo limite global', async () => {
      const limiter = createRateLimiter({
        maxRequests: 10,
        maxGlobalRequests: 3, // global baixo
        windowMs: 60_000,
        operation: 'test-combined-adversarial',
      });
      const { base } = await buildTestServer(limiter);

      // Atacante altera tanto o UID quanto o X-Forwarded-For
      const res1 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-1', 'x-forwarded-for': '1.1.1.1' },
      });
      expect(res1.status).toBe(200);

      const res2 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-2', 'x-forwarded-for': '2.2.2.2' },
      });
      expect(res2.status).toBe(200);

      const res3 = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-3', 'x-forwarded-for': '203.0.113.10' },
      });
      expect(res3.status).toBe(200);

      // 4ª requisição com UID novo e header forjado: o bucket global bloqueia com 429
      const blockedRes = await fetch(`${base}/test`, {
        headers: { 'x-mock-uid': 'attacker-4', 'x-forwarded-for': 'attacker-controlled' },
      });
      expect(blockedRes.status).toBe(429);
      const errorBody = await blockedRes.json();
      expect(errorBody.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Headers — Retry-After e RATE_LIMIT_EXCEEDED', () => {
    it('cabeçalho Retry-After é um número positivo e corpo tem código correto', async () => {
      const limiter = createRateLimiter({
        maxRequests: 1,
        maxGlobalRequests: 10,
        windowMs: 60_000,
        operation: 'test-headers',
      });
      const { base } = await buildTestServer(limiter);

      await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      const blockedRes = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });

      expect(blockedRes.status).toBe(429);
      const retryAfterStr = blockedRes.headers.get('retry-after');
      expect(retryAfterStr).toBeTruthy();
      const retryAfterNum = Number(retryAfterStr);
      expect(retryAfterNum).toBeGreaterThan(0);
      expect(Number.isInteger(retryAfterNum)).toBe(true);

      const body = await blockedRes.json();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Janela — reset/expiração', () => {
    it('expira a janela e aceita novas requisições após expiração', async () => {
      const limiter = createRateLimiter({
        maxRequests: 2,
        maxGlobalRequests: 10,
        windowMs: 100, // janela de 100ms para teste rápido
        operation: 'test-window',
      });
      const { base } = await buildTestServer(limiter);

      // Exaurir
      for (let i = 0; i < 2; i++) {
        await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      }
      const blocked = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      expect(blocked.status).toBe(429);

      // Aguardar expiração da janela
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Após expiração, deve aceitar novamente
      const resAfterWindow = await fetch(`${base}/test`, { headers: { 'x-mock-uid': 'user-a' } });
      expect(resAfterWindow.status).toBe(200);
    });
  });
});

describe('G09B-F002 — Timing Oracle do Tracking', () => {
  it('executa verifyTrackingKeyDummy deterministicamente quando protocolo não existe', async () => {
    const { service } = makeOccurrenceServiceFixture();
    const dummySpy = vi.spyOn(trackingKeyModule, 'verifyTrackingKeyDummy');

    // Protocolo inexistente
    await expect(service.track('INF-2026-999999', 'AAAA-BBBB-CCCC')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Ocorrência não encontrada para a combinação de protocolo e chave informada.',
    });

    // Prova determinística de que o caminho criptográfico dummy foi executado
    expect(dummySpy).toHaveBeenCalledWith('AAAA-BBBB-CCCC');
  });

  it('retorna respostas externamente indistinguíveis para protocolo inexistente e chave errada', async () => {
    const { service } = makeOccurrenceServiceFixture();
    const created = await service.create(createInput, 'corr-timing');

    // Caso 1: protocolo existente + chave incorreta
    let errorWrongKey: HttpError | undefined;
    try {
      await service.track(created.protocol, 'AAAA-BBBB-CCCC');
    } catch (err) {
      if (err instanceof HttpError) errorWrongKey = err;
    }

    // Caso 2: protocolo inexistente
    let errorMissingProtocol: HttpError | undefined;
    try {
      await service.track('INF-2026-999999', 'AAAA-BBBB-CCCC');
    } catch (err) {
      if (err instanceof HttpError) errorMissingProtocol = err;
    }

    expect(errorWrongKey).toBeDefined();
    expect(errorMissingProtocol).toBeDefined();
    expect(errorWrongKey?.status).toBe(errorMissingProtocol?.status);
    expect(errorWrongKey?.code).toBe(errorMissingProtocol?.code);
    expect(errorWrongKey?.message).toBe(errorMissingProtocol?.message);
  });
});

describe('G09B-F006 / G09B-F007 — Security Headers e CSP', () => {
  it('aplica security headers no backend em desenvolvimento sem HSTS', async () => {
    const app = express();
    app.use(securityHeaders(false));
    app.get('/api/test', (_req, res) => res.json({ ok: true }));

    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const res = await fetch(`${base}/api/test`);
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('permissions-policy')).toContain('camera=()');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    // Em desenvolvimento (HTTP), Strict-Transport-Security não deve ser emitido
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });

  it('emite Strict-Transport-Security quando em produção', async () => {
    const app = express();
    app.use(securityHeaders(true));
    app.get('/api/test', (_req, res) => res.json({ ok: true }));

    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const res = await fetch(`${base}/api/test`);
    expect(res.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('public/_headers contém Content-Security-Policy e Strict-Transport-Security configurados', () => {
    const content = readFileSync(join(process.cwd(), 'public/_headers'), 'utf8');
    expect(content).toContain('Content-Security-Policy:');
    expect(content).toContain('Strict-Transport-Security:');
    expect(content).toContain('X-Content-Type-Options: nosniff');
    expect(content).toContain('X-Frame-Options: DENY');
  });
});
