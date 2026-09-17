import {
  PhotoDeletionError,
  type PhotoObjectInfo,
  type PhotoObjectMetadata,
  type PhotoObjectPage,
  type PhotoRepository,
  type PhotoStorageProvider,
} from './photoRepository';

export class FallbackPhotoRepository implements PhotoRepository {
  public readonly provider = 'r2' as const;

  public constructor(
    private readonly primary: PhotoRepository,
    private readonly legacy: PhotoRepository,
    private readonly onFallback: () => void = () => undefined,
  ) {
    if (primary.provider !== 'r2') throw new Error('O repositório primário do fallback deve ser R2.');
    if (legacy.provider !== 'firebase-storage') throw new Error('O repositório legado do fallback deve ser Firebase Storage.');
  }

  public save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void> {
    return this.primary.save(path, buffer, metadata);
  }

  public async read(path: string): Promise<Buffer | undefined> {
    const primary = await this.primary.read(path);
    if (primary !== undefined) return primary;
    const legacy = await this.legacy.read(path);
    if (legacy !== undefined) this.onFallback();
    return legacy;
  }

  public async delete(path: string): Promise<void> {
    const failures: PhotoStorageProvider[] = [];
    // Ambos os providers implementam delete idempotente. Durante o fallback, uma
    // exclusão de domínio precisa alcançar as duas possíveis localizações, mesmo
    // quando uma leitura anterior tenha vindo apenas de uma delas.
    for (const repository of [this.primary, this.legacy]) {
      try {
        await repository.delete(path);
      } catch {
        failures.push(repository.provider);
      }
    }
    if (failures.length > 0) throw new PhotoDeletionError(failures);
  }

  public async getMetadata(path: string): Promise<PhotoObjectInfo | undefined> {
    const primary = await this.primary.getMetadata(path);
    if (primary !== undefined) return primary;
    const legacy = await this.legacy.getMetadata(path);
    if (legacy !== undefined) this.onFallback();
    return legacy;
  }

  public listPage(prefix: string, cursor?: string, limit?: number): Promise<PhotoObjectPage> {
    return this.primary.listPage(prefix, cursor, limit);
  }
}
