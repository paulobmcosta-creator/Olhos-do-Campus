import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type {
  PhotoObjectInfo,
  PhotoObjectMetadata,
  PhotoObjectPage,
  PhotoRepository,
} from './photoRepository';

export const SAFE_PHOTO_STORAGE_PATH = /^occurrences\/[A-Za-z0-9_-]+\/(?:initial|initial-thumbnails|resolution|resolution-thumbnails)\/[A-Za-z0-9_-]+\.webp$/u;

export function assertPhotoStoragePath(path: string): void {
  if (!SAFE_PHOTO_STORAGE_PATH.test(path) || path.includes('..') || path.startsWith('/')) {
    throw new Error('PHOTO_STORAGE_PATH_INVALID');
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const record = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return record.name === 'NotFound' || record.name === 'NoSuchKey' || record.$metadata?.httpStatusCode === 404;
}

function normalizedMetadata(metadata: Record<string, string> | undefined): Record<string, string> | undefined {
  if (metadata === undefined) return undefined;
  return Object.fromEntries(Object.entries(metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export interface R2PhotoRepositoryOptions {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
  client?: S3Client;
}

export class R2PhotoRepository implements PhotoRepository {
  public readonly provider = 'r2' as const;
  private readonly client: S3Client;

  public constructor(private readonly options: R2PhotoRepositoryOptions) {
    this.client = options.client ?? new S3Client({
      region: 'auto',
      endpoint: options.endpoint ?? `https://${options.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  public async save(path: string, buffer: Buffer, metadata: PhotoObjectMetadata): Promise<void> {
    assertPhotoStoragePath(path);
    await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucketName,
      Key: path,
      Body: buffer,
      ContentType: 'image/webp',
      ContentDisposition: 'inline',
      CacheControl: 'private, no-store, max-age=0',
      Metadata: {
        occurrenceid: metadata.occurrenceId,
        photoid: metadata.photoId,
        kind: metadata.kind,
        schemaversion: '1',
      },
    }));
  }

  public async read(path: string): Promise<Buffer | undefined> {
    assertPhotoStoragePath(path);
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucketName, Key: path }));
      if (response.Body === undefined) return undefined;
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error: unknown) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  public async delete(path: string): Promise<void> {
    assertPhotoStoragePath(path);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucketName, Key: path }));
  }

  public async getMetadata(path: string): Promise<PhotoObjectInfo | undefined> {
    assertPhotoStoragePath(path);
    try {
      const response = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucketName, Key: path }));
      return {
        path,
        ...(response.ContentType === undefined ? {} : { contentType: response.ContentType }),
        ...(response.ContentLength === undefined ? {} : { size: response.ContentLength }),
        ...(response.ETag === undefined ? {} : { etag: response.ETag.replaceAll('"', '') }),
        ...(response.LastModified === undefined ? {} : { lastModified: response.LastModified }),
        ...(normalizedMetadata(response.Metadata) === undefined ? {} : { metadata: normalizedMetadata(response.Metadata) }),
      };
    } catch (error: unknown) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  public async listPage(prefix: string, cursor?: string, limit = 500): Promise<PhotoObjectPage> {
    if (prefix !== '' && !prefix.startsWith('occurrences/')) throw new Error('PHOTO_STORAGE_PREFIX_INVALID');
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.options.bucketName,
      Prefix: prefix,
      ...(cursor === undefined ? {} : { ContinuationToken: cursor }),
      MaxKeys: Math.min(Math.max(limit, 1), 1000),
    }));
    const items = (response.Contents ?? []).flatMap((object) => object.Key === undefined ? [] : [{
      path: object.Key,
      ...(object.Size === undefined ? {} : { size: object.Size }),
      ...(object.ETag === undefined ? {} : { etag: object.ETag.replaceAll('"', '') }),
      ...(object.LastModified === undefined ? {} : { lastModified: object.LastModified }),
    }]);
    return {
      items,
      ...(response.IsTruncated === true && response.NextContinuationToken !== undefined
        ? { nextCursor: response.NextContinuationToken }
        : {}),
    };
  }
}
