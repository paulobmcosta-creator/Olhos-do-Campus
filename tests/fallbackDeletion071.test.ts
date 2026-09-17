// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ImageProcessingService } from '../server/services/imageProcessingService';
import { PhotoService } from '../server/services/photoService';
import { FallbackPhotoRepository } from '../server/repositories/fallbackPhotoRepository';
import { PhotoDeletionError, type PhotoObjectInfo, type PhotoObjectMetadata, type PhotoObjectPage, type PhotoRepository, type PhotoStorageProvider } from '../server/repositories/photoRepository';
import { InMemoryPhotoMetadataRepository, InMemoryStorageCleanupTaskRepository } from './helpers/fakePhotoInfrastructure';

const path = 'occurrences/occ/initial/photo.webp';
const metadata: PhotoObjectMetadata = { occurrenceId: 'occ', photoId: 'photo', kind: 'INITIAL' };

class MemoryProvider implements PhotoRepository {
  private readonly objects = new Map<string, Buffer>();
  public failDelete = false;
  public constructor(public readonly provider: PhotoStorageProvider) {}
  public save(objectPath: string, buffer: Buffer, _metadata: PhotoObjectMetadata): Promise<void> { void _metadata; this.objects.set(objectPath, Buffer.from(buffer)); return Promise.resolve(); }
  public read(objectPath: string): Promise<Buffer | undefined> { const value = this.objects.get(objectPath); return Promise.resolve(value === undefined ? undefined : Buffer.from(value)); }
  public delete(objectPath: string): Promise<void> { if (this.failDelete) return Promise.reject(new Error(`delete-${this.provider}`)); this.objects.delete(objectPath); return Promise.resolve(); }
  public getMetadata(objectPath: string): Promise<PhotoObjectInfo | undefined> { const value = this.objects.get(objectPath); return Promise.resolve(value === undefined ? undefined : { path: objectPath, size: value.length }); }
  public listPage(_prefix: string, _cursor?: string, _limit?: number): Promise<PhotoObjectPage> { void _prefix; void _cursor; void _limit; return Promise.resolve({ items: [] }); }
  public has(objectPath: string): boolean { return this.objects.has(objectPath); }
}

async function seeded(r2Present: boolean, legacyPresent: boolean): Promise<{ r2: MemoryProvider; legacy: MemoryProvider; fallback: FallbackPhotoRepository }> {
  const r2 = new MemoryProvider('r2');
  const legacy = new MemoryProvider('firebase-storage');
  if (r2Present) await r2.save(path, Buffer.from('r2'), metadata);
  if (legacyPresent) await legacy.save(path, Buffer.from('legacy'), metadata);
  return { r2, legacy, fallback: new FallbackPhotoRepository(r2, legacy) };
}

describe('exclusão provider-aware durante fallback 0.7.1', () => {
  it('A. exclui objeto existente somente no R2', async () => { const { r2, legacy, fallback } = await seeded(true, false); await fallback.delete(path); expect(r2.has(path)).toBe(false); expect(legacy.has(path)).toBe(false); });
  it('B. exclui objeto existente somente no Firebase Storage legado', async () => { const { r2, legacy, fallback } = await seeded(false, true); await fallback.delete(path); expect(r2.has(path)).toBe(false); expect(legacy.has(path)).toBe(false); });
  it('C. exclui ambas as cópias quando R2 e legado coexistem', async () => { const { r2, legacy, fallback } = await seeded(true, true); await fallback.delete(path); expect(r2.has(path)).toBe(false); expect(legacy.has(path)).toBe(false); });
  it('D. é idempotente quando o objeto não existe em nenhum provider', async () => { const { fallback } = await seeded(false, false); await expect(fallback.delete(path)).resolves.toBeUndefined(); await expect(fallback.delete(path)).resolves.toBeUndefined(); });
  it('E. identifica falha no R2 sem impedir tentativa no legado', async () => { const { r2, legacy, fallback } = await seeded(true, true); r2.failDelete = true; await expect(fallback.delete(path)).rejects.toMatchObject({ failedProviders: ['r2'] }); expect(r2.has(path)).toBe(true); expect(legacy.has(path)).toBe(false); });
  it('F. identifica falha no Firebase sem desfazer exclusão bem-sucedida do R2', async () => { const { r2, legacy, fallback } = await seeded(true, true); legacy.failDelete = true; await expect(fallback.delete(path)).rejects.toMatchObject({ failedProviders: ['firebase-storage'] }); expect(r2.has(path)).toBe(false); expect(legacy.has(path)).toBe(true); });
  it('G. exclusão parcial gera cleanup pendente apenas para o provider que falhou', async () => { const { r2, legacy, fallback } = await seeded(true, true); legacy.failDelete = true; const cleanup = new InMemoryStorageCleanupTaskRepository(); const service = new PhotoService(fallback, new InMemoryPhotoMetadataRepository(), cleanup, new ImageProcessingService()); await service.compensate([path], 'remoção de domínio', 'corr'); const tasks = await cleanup.listPending(); expect(tasks).toHaveLength(1); expect(tasks[0]).toMatchObject({ storageProvider: 'firebase-storage', storagePaths: [path] }); expect(r2.has(path)).toBe(false); expect(legacy.has(path)).toBe(true); });
  it('H. retry posterior conclui a exclusão parcial de forma idempotente', async () => { const { r2, legacy, fallback } = await seeded(true, true); legacy.failDelete = true; await expect(fallback.delete(path)).rejects.toBeInstanceOf(PhotoDeletionError); legacy.failDelete = false; await expect(fallback.delete(path)).resolves.toBeUndefined(); expect(r2.has(path)).toBe(false); expect(legacy.has(path)).toBe(false); });
});
