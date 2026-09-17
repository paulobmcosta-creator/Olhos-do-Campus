// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/serverTestHarness';
import { createTestHarness, headers } from './helpers/serverTestHarness';

let harness: TestHarness;

beforeAll(async () => {
  harness = await createTestHarness();
});

afterAll(async () => {
  await harness.close();
});

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('G09B-F004 — RBAC e Menor Privilégio na rota GET /api/admin/assignees', () => {
  it('Administrador acessa com sucesso o diretório global de responsáveis (HTTP 200)', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('admin-token'),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const first = body[0]!;
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('email');
    expect(first).toHaveProperty('displayName');
    expect(first).toHaveProperty('role');
    expect(first).toHaveProperty('teamIds');
  });

  it('Gestor acessa com sucesso o diretório global de responsáveis (HTTP 200)', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('manager-token'),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const first = body[0]!;
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('email');
    expect(first).toHaveProperty('displayName');
    expect(first).toHaveProperty('role');
    expect(first).toHaveProperty('teamIds');
  });

  it('Atendente é bloqueado com HTTP 403 Forbidden ao tentar acessar /api/admin/assignees', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('attendant-token'),
    });

    expect(response.status).toBe(403);
    const body = await json(response);
    expect(body.error).toMatchObject({
      code: 'FORBIDDEN',
      message: 'O papel administrativo autenticado não possui permissão para esta operação.',
    });
  });

  it('Teste Adversarial: chamada direta à API simulando Atendente recebe HTTP 403 sem dados parciais ou lista vazia', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      method: 'GET',
      headers: {
        'X-Firebase-AppCheck': 'valid-app-check',
        Authorization: 'Bearer attendant-token',
      },
    });

    expect(response.status).toBe(403);
    const body = await json(response);
    expect(body).not.toBeInstanceOf(Array);
    expect(body).toHaveProperty('error');
    expect(body.error).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('Requisição não autenticada é rejeitada com HTTP 401 UNAUTHENTICATED', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: {
        'X-Firebase-AppCheck': 'valid-app-check',
      },
    });

    expect(response.status).toBe(401);
    const body = await json(response);
    expect(body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('Token de usuário com domínio externo não autorizado é rejeitado com HTTP 403 DOMAIN_NOT_ALLOWED', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('other-domain-token'),
    });

    expect(response.status).toBe(403);
    const body = await json(response);
    expect(body.error).toMatchObject({ code: 'DOMAIN_NOT_ALLOWED' });
  });

  it('Token de usuário administrativo inativo é rejeitado com HTTP 403 ADMIN_INACTIVE', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('inactive-token'),
    });

    expect(response.status).toBe(403);
    const body = await json(response);
    expect(body.error).toMatchObject({ code: 'ADMIN_INACTIVE' });
  });

  it('Atendente com papel legado recebe HTTP 403 LEGACY_ROLE_REQUIRES_RESOLUTION', async () => {
    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('legacy-token'),
    });

    expect(response.status).toBe(403);
    const body = await json(response);
    expect(body.error).toMatchObject({ code: 'LEGACY_ROLE_REQUIRES_RESOLUTION' });
  });

  it('Comprova que o handler/repositório não é invocado quando Atendente recebe 403', async () => {
    const listSpy = vi.spyOn(harness.adminUsers, 'list');
    listSpy.mockClear();

    const response = await fetch(`${harness.baseUrl}/api/admin/assignees`, {
      headers: headers('attendant-token'),
    });

    expect(response.status).toBe(403);
    expect(listSpy).not.toHaveBeenCalled();
    listSpy.mockRestore();
  });
});
