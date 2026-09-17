// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Occurrence } from '../src/models/occurrence';
import type { TestHarness } from './helpers/serverTestHarness';
import { createTestHarness, headers, multipartHeaders, occurrenceFormData } from './helpers/serverTestHarness';

let harness: TestHarness;
const jpegBytes = new Uint8Array(readFileSync('tests/fixtures/photo-with-exif-gps.jpg'));

beforeEach(async () => { harness = await createTestHarness(); });
afterEach(async () => { await harness.close(); });

async function createWith(photos: Array<{ bytes: Uint8Array; type: string; name?: string }> = []): Promise<{ protocol: string; trackingKey: string }> {
  const response = await fetch(`${harness.baseUrl}/api/occurrences`, {
    method: 'POST', headers: multipartHeaders('anonymous-token'), body: occurrenceFormData(undefined, photos),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ protocol: string; trackingKey: string }>;
}

async function firstOccurrence(token = 'manager-token'): Promise<Occurrence> {
  const response = await fetch(`${harness.baseUrl}/api/admin/occurrences`, { headers: headers(token) });
  expect(response.status).toBe(200);
  const body = await response.json() as { items: Occurrence[] };
  return body.items[0]!;
}

async function addResolution(id: string, version: number, token = 'manager-token'): Promise<Occurrence> {
  const response = await fetch(`${harness.baseUrl}/api/admin/occurrences/${id}/photos`, {
    method: 'POST', headers: multipartHeaders(token), body: occurrenceFormData({ expectedVersion: version }, [{ bytes: jpegBytes, type: 'image/jpeg', name: 'nome-que-nao-sera-persistido.jpg' }]),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<Occurrence>;
}

describe('API pública de upload fotográfico multipart', () => {
  it('aceita 0, 1 e 3 fotografias e rejeita a quarta', async () => {
    await createWith();
    await createWith([{ bytes: jpegBytes, type: 'image/jpeg' }]);
    await createWith(Array.from({ length: 3 }, () => ({ bytes: jpegBytes, type: 'image/jpeg' })));

    const four = await fetch(`${harness.baseUrl}/api/occurrences`, {
      method: 'POST', headers: multipartHeaders('anonymous-token'), body: occurrenceFormData(undefined, Array.from({ length: 4 }, () => ({ bytes: jpegBytes, type: 'image/jpeg' }))),
    });
    expect(four.status).toBe(400);
    expect((await four.json() as { error: { code: string } }).error.code).toBe('PHOTO_COUNT_EXCEEDED');
  });

  it('rejeita MIME divergente, conteúdo corrompido e arquivo acima de 8 MB', async () => {
    const mismatch = await fetch(`${harness.baseUrl}/api/occurrences`, {
      method: 'POST', headers: multipartHeaders('anonymous-token'), body: occurrenceFormData(undefined, [{ bytes: jpegBytes, type: 'image/png' }]),
    });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json() as { error: { code: string } }).error.code).toBe('PHOTO_TYPE_NOT_ALLOWED');

    const corrupted = await fetch(`${harness.baseUrl}/api/occurrences`, {
      method: 'POST', headers: multipartHeaders('anonymous-token'), body: occurrenceFormData(undefined, [{ bytes: new Uint8Array([1, 2, 3, 4]), type: 'image/jpeg' }]),
    });
    expect(corrupted.status).toBe(400);
    expect((await corrupted.json() as { error: { code: string } }).error.code).toBe('PHOTO_CORRUPTED');

    const tooLarge = await fetch(`${harness.baseUrl}/api/occurrences`, {
      method: 'POST', headers: multipartHeaders('anonymous-token'), body: occurrenceFormData(undefined, [{ bytes: new Uint8Array(8 * 1024 * 1024 + 1), type: 'image/jpeg' }]),
    });
    expect(tooLarge.status).toBe(413);
    expect((await tooLarge.json() as { error: { code: string } }).error.code).toBe('PHOTO_TOO_LARGE');
  });

  it('exige App Check e autenticação anônima antes de processar o multipart', async () => {
    const noAuth = await fetch(`${harness.baseUrl}/api/occurrences`, { method: 'POST', headers: multipartHeaders(), body: occurrenceFormData() });
    expect(noAuth.status).toBe(401);
    const noAppCheck = await fetch(`${harness.baseUrl}/api/occurrences`, { method: 'POST', headers: multipartHeaders('anonymous-token', ''), body: occurrenceFormData() });
    expect(noAppCheck.status).toBe(401);
  });
});

describe('API protegida de fotografias administrativas e públicas', () => {
  it('mantém fotografia inicial interna e não a serve pelo acompanhamento público', async () => {
    const created = await createWith([{ bytes: jpegBytes, type: 'image/jpeg' }]);
    const occurrence = await firstOccurrence();
    const detail = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}`, { headers: headers('manager-token') });
    const adminOccurrence = await detail.json() as Occurrence;
    expect(adminOccurrence.photos).toHaveLength(1);
    expect(adminOccurrence.photos[0]).toMatchObject({ kind: 'INITIAL', visibility: 'INTERNAL', status: 'READY' });
    expect(JSON.stringify(adminOccurrence.photos[0])).not.toContain('storagePath');
    expect(JSON.stringify(adminOccurrence.photos[0])).not.toContain('sha256');

    const internal = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, {
      method: 'POST', headers: headers('anonymous-token'), body: JSON.stringify({ protocol: created.protocol, trackingKey: created.trackingKey, photoId: adminOccurrence.photos[0]!.id, variant: 'thumbnail' }),
    });
    expect(internal.status).toBe(404);
    const internalBody = await internal.json() as { error: { code: string; message: string } };
    expect(internalBody.error.code).toBe('PHOTO_NOT_FOUND');

    const nonexistent = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, {
      method: 'POST', headers: headers('anonymous-token'), body: JSON.stringify({ protocol: created.protocol, trackingKey: created.trackingKey, photoId: '00000000-0000-4000-8000-000000000000', variant: 'thumbnail' }),
    });
    expect(nonexistent.status).toBe(404);
    const nonexistentBody = await nonexistent.json() as { error: { code: string; message: string } };
    expect(nonexistentBody.error).toMatchObject({ code: internalBody.error.code, message: internalBody.error.message });
  });

  it('publica conscientemente fotografia de solução e a serve sem chave na URL', async () => {
    const created = await createWith();
    const occurrence = await firstOccurrence();
    const withPhoto = await addResolution(occurrence.id, occurrence.version);
    const photo = withPhoto.photos.find((item) => item.kind === 'RESOLUTION')!;
    expect(photo.visibility).toBe('INTERNAL');

    const visibility = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos/${photo.id}/visibility`, {
      method: 'PATCH', headers: headers('manager-token'), body: JSON.stringify({ expectedVersion: withPhoto.version, visibility: 'PUBLIC' }),
    });
    expect(visibility.status).toBe(200);
    const published = await visibility.json() as Occurrence;
    expect(published.photos.find((item) => item.id === photo.id)?.visibility).toBe('PUBLIC');

    const tracking = await fetch(`${harness.baseUrl}/api/occurrences/track`, {
      method: 'POST', headers: headers('anonymous-token'), body: JSON.stringify({ protocol: created.protocol, trackingKey: created.trackingKey }),
    });
    const publicOccurrence = await tracking.json() as { photos: Array<Record<string, unknown>> };
    expect(publicOccurrence.photos).toHaveLength(1);
    expect(publicOccurrence.photos[0]).toMatchObject({ id: photo.id, kind: 'RESOLUTION' });
    expect(JSON.stringify(publicOccurrence.photos[0])).not.toMatch(/storagePath|sha256|bucket|admin/iu);

    const image = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, {
      method: 'POST', headers: headers('anonymous-token'), body: JSON.stringify({ protocol: created.protocol, trackingKey: created.trackingKey, photoId: photo.id, variant: 'thumbnail' }),
    });
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toContain('image/webp');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect(image.headers.get('cache-control')).toContain('no-store');
    expect(image.url).not.toContain(created.trackingKey);
  });

  it('protege o download público por App Check, autenticação anônima e protocolo/chave', async () => {
    const created = await createWith();
    const occurrence = await firstOccurrence();
    const withPhoto = await addResolution(occurrence.id, occurrence.version);
    const photo = withPhoto.photos.find((item) => item.kind === 'RESOLUTION')!;
    const visibility = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos/${photo.id}/visibility`, {
      method: 'PATCH', headers: headers('manager-token'), body: JSON.stringify({ expectedVersion: withPhoto.version, visibility: 'PUBLIC' }),
    });
    expect(visibility.status).toBe(200);

    const body = { protocol: created.protocol, trackingKey: created.trackingKey, photoId: photo.id, variant: 'thumbnail' as const };
    const noAuth = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    expect(noAuth.status).toBe(401);
    const noAppCheck = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, { method: 'POST', headers: headers('anonymous-token', ''), body: JSON.stringify(body) });
    expect(noAppCheck.status).toBe(401);

    const wrongKey = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, {
      method: 'POST', headers: headers('anonymous-token'), body: JSON.stringify({ ...body, trackingKey: 'AAAA-BBBB-CCCC' }),
    });
    expect(wrongKey.status).toBe(404);
    const missingProtocol = await fetch(`${harness.baseUrl}/api/occurrences/track/photo`, {
      method: 'POST', headers: headers('anonymous-token'), body: JSON.stringify({ ...body, protocol: 'INF-2026-999999' }),
    });
    expect(missingProtocol.status).toBe(404);
    const wrongError = (await wrongKey.json() as { error: { code: string; message: string } }).error;
    const missingError = (await missingProtocol.json() as { error: { code: string; message: string } }).error;
    expect(wrongError).toMatchObject({ code: missingError.code, message: missingError.message });
  });

  it('bloqueia cadastro com papel legado antes de alcançar as operações de fotografia', async () => {
    await createWith();
    const occurrence = await firstOccurrence();
    const view = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos/00000000-0000-4000-8000-000000000000?variant=thumbnail`, {
      headers: headers('legacy-token'),
    });
    expect(view.status).toBe(403);
    const upload = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos`, {
      method: 'POST', headers: multipartHeaders('legacy-token'), body: occurrenceFormData({ expectedVersion: occurrence.version }, [{ bytes: jpegBytes, type: 'image/jpeg' }]),
    });
    expect(upload.status).toBe(403);
  });

  it('permite a Administrador e Gestor adicionar, publicar e excluir fotografia de solução', async () => {
    for (const token of ['admin-token', 'manager-token'] as const) {
      await createWith();
      const occurrence = await firstOccurrence(token);
      const withPhoto = await addResolution(occurrence.id, occurrence.version, token);
      const photo = withPhoto.photos.find((item) => item.kind === 'RESOLUTION' && item.status === 'READY')!;
      const publish = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos/${photo.id}/visibility`, {
        method: 'PATCH', headers: headers(token), body: JSON.stringify({ expectedVersion: withPhoto.version, visibility: 'PUBLIC' }),
      });
      expect(publish.status).toBe(200);
      const published = await publish.json() as Occurrence;
      const remove = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos/${photo.id}`, {
        method: 'DELETE', headers: headers(token), body: JSON.stringify({ expectedVersion: published.version }),
      });
      expect(remove.status).toBe(200);
    }
  });

  it('mantém optimistic locking nas mutações de fotografia', async () => {
    await createWith();
    const occurrence = await firstOccurrence();
    const added = await addResolution(occurrence.id, occurrence.version);
    const photo = added.photos.find((item) => item.kind === 'RESOLUTION')!;
    const conflict = await fetch(`${harness.baseUrl}/api/admin/occurrences/${occurrence.id}/photos/${photo.id}/visibility`, {
      method: 'PATCH', headers: headers('manager-token'), body: JSON.stringify({ expectedVersion: added.version - 1, visibility: 'PUBLIC' }),
    });
    expect(conflict.status).toBe(409);
  });

});
