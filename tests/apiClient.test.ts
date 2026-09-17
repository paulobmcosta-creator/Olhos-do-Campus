import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { requestBlob, requestJson } from '../src/services/apiClient';
import { getAdminIdToken } from '../src/auth/adminAuth';
import { getPublicIdToken } from '../src/auth/publicAuth';
import { getAppCheckToken } from '../src/services/firebase/appCheckTokenService';

vi.mock('../src/auth/adminAuth', () => ({ getAdminIdToken: vi.fn(() => Promise.resolve('admin-id-token')) }));
vi.mock('../src/auth/publicAuth', () => ({ getPublicIdToken: vi.fn(() => Promise.resolve('public-id-token')) }));
vi.mock('../src/services/firebase/appCheckTokenService', () => ({ getAppCheckToken: vi.fn(() => Promise.resolve('app-check-token')) }));

const responseSchema = z.object({ ok: z.literal(true) });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function expectApiError(status: number, code: string): Promise<void> {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(status, {
    error: { code, message: `Erro ${status}` },
  }))));
  await expect(requestJson('/api/test', responseSchema)).rejects.toMatchObject({ status, code, message: `Erro ${status}` });
}

describe('cliente HTTP autenticado', () => {
  it('anexa ID Token administrativo e App Check sem armazená-los manualmente', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer admin-id-token');
      expect(headers.get('X-Firebase-AppCheck')).toBe('app-check-token');
      return Promise.resolve(jsonResponse(200, { ok: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestJson('/api/test', responseSchema, { authentication: 'admin' })).resolves.toEqual({ ok: true });
    expect(getAdminIdToken).toHaveBeenCalledOnce();
    expect(getAppCheckToken).toHaveBeenCalledOnce();
  });

  it('usa a identidade anônima no fluxo público, separada da administrativa', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer public-id-token');
      return Promise.resolve(jsonResponse(200, { ok: true }));
    }));
    await requestJson('/api/test', responseSchema, { authentication: 'public' });
    expect(getPublicIdToken).toHaveBeenCalledOnce();
  });



  it('não define Content-Type manualmente para FormData multipart e preserva autenticação', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const requestHeaders = new Headers(init?.headers);
      expect(requestHeaders.has('Content-Type')).toBe(false);
      expect(requestHeaders.get('Authorization')).toBe('Bearer public-id-token');
      expect(init?.body).toBeInstanceOf(FormData);
      return Promise.resolve(jsonResponse(200, { ok: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('payload', '{}');
    await requestJson('/api/test', responseSchema, { authentication: 'public', method: 'POST', body: form });
  });

  it('aceita somente image/webp nas respostas binárias protegidas', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/webp' } }))));
    const webp = await requestBlob('/api/photo', { authentication: 'public' });
    expect(webp.type).toBe('image/webp');
    expect(webp.size).toBe(3);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/png' } }))));
    await expect(requestBlob('/api/photo', { authentication: 'public' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('preserva erros 401, 403 e 500 sem fallback local', async () => {
    await expectApiError(401, 'UNAUTHENTICATED');
    await expectApiError(403, 'FORBIDDEN');
    await expectApiError(500, 'INTERNAL_ERROR');
  });

  it('distingue falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network unavailable'))));
    await expect(requestJson('/api/test', responseSchema)).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('rejeita resposta incompatível com o contrato', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { ok: false }))));
    await expect(requestJson('/api/test', responseSchema)).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
