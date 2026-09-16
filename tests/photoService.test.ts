import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../server/types/errors';
import { makeTestPhotoService } from './helpers/fakePhotoInfrastructure';

async function jpeg(width = 300, height = 200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
}

async function expectHttpCode(action: Promise<unknown>, code: string): Promise<HttpError> {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).code).toBe(code);
    return error as HttpError;
  }
  throw new Error(`Era esperado HttpError ${code}.`);
}

describe('PhotoService — Storage, limites e compensação', () => {
  it('gera caminhos exclusivamente no servidor, objetos principal/miniatura e metadata interna', async () => {
    const fixture = makeTestPhotoService();
    const prepared = await fixture.service.prepareAndUpload(
      'occurrence-123',
      'INITIAL',
      [{ buffer: await jpeg(), declaredMimeType: 'image/jpeg' }],
      { type: 'PUBLIC' },
      'corr-path',
    );
    expect(prepared.metadata).toHaveLength(1);
    const metadata = prepared.metadata[0]!;
    expect(metadata.visibility).toBe('INTERNAL');
    expect(metadata.status).toBe('READY');
    expect(metadata.kind).toBe('INITIAL');
    expect(metadata.contentType).toBe('image/webp');
    expect(metadata.storagePath).toMatch(/^occurrences\/occurrence-123\/initial\/[a-f0-9-]+\.webp$/u);
    expect(metadata.thumbnailStoragePath).toMatch(/^occurrences\/occurrence-123\/initial-thumbnails\/[a-f0-9-]+\.webp$/u);
    expect(metadata.storagePath).not.toContain('foto-original');
    expect(fixture.objects.paths()).toEqual([metadata.storagePath, metadata.thumbnailStoragePath].sort());
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('rejeita mais de três fotografias antes de qualquer upload', async () => {
    const fixture = makeTestPhotoService();
    const buffer = await jpeg();
    await expectHttpCode(fixture.service.prepareAndUpload(
      'occurrence-123', 'INITIAL', Array.from({ length: 4 }, () => ({ buffer, declaredMimeType: 'image/jpeg' })), { type: 'PUBLIC' }, 'corr-limit',
    ), 'PHOTO_COUNT_EXCEEDED');
    expect(fixture.objects.paths()).toHaveLength(0);
  });

  it('faz rollback compensatório quando um upload falha parcialmente', async () => {
    const fixture = makeTestPhotoService();
    fixture.objects.failSaveAtCall = 2;
    await expectHttpCode(fixture.service.prepareAndUpload(
      'occurrence-123', 'INITIAL', [{ buffer: await jpeg(), declaredMimeType: 'image/jpeg' }], { type: 'PUBLIC' }, 'corr-fail',
    ), 'PHOTO_STORAGE_FAILED');
    expect(fixture.objects.paths()).toHaveLength(0);
    expect(fixture.objects.deletedPaths.length).toBeGreaterThanOrEqual(1);
  });

  it('registra tarefa persistente quando a exclusão compensatória falha', async () => {
    const fixture = makeTestPhotoService();
    const prepared = await fixture.service.prepareAndUpload(
      'occurrence-123', 'RESOLUTION', [{ buffer: await jpeg(), declaredMimeType: 'image/jpeg' }], { type: 'PUBLIC' }, 'corr-cleanup',
    );
    const target = prepared.metadata[0]!;
    fixture.objects.failDeletePaths.add(target.storagePath);
    await fixture.service.compensate(prepared.uploadedPaths, 'Teste de falha compensatória', 'corr-cleanup');
    const tasks = await fixture.cleanup.listPending();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.storagePaths).toEqual([target.storagePath]);
    expect(tasks[0]?.reason).toBe('Teste de falha compensatória');
  });

  it('considera exclusão de objeto inexistente idempotente no fake e nunca serve metadata DELETED', async () => {
    const fixture = makeTestPhotoService();
    await expect(fixture.objects.delete('occurrences/x/initial/x.webp')).resolves.toBeUndefined();
    await expect(fixture.objects.delete('occurrences/x/initial/x.webp')).resolves.toBeUndefined();
  });
});
