import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { IncomingPhoto, ProcessedPhoto } from '../models/photoDomain';

// Defesa em profundidade recomendada pelo projeto sharp para entrada não confiável.
// O preflight por assinatura abaixo impede que GIF/TIFF/VIPS/SVG cheguem ao decoder;
// estes bloqueios também restringem os loaders no nível do libvips.
sharp.block({ operation: ['VipsForeignLoadNsgif', 'VipsForeignLoadTiff', 'VipsForeignLoadVips'] });

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_MAIN_DIMENSION = 1600;
export const MAX_THUMBNAIL_DIMENSION = 480;
export const WEBP_QUALITY = 82;

export type ImageProcessingErrorCode =
  | 'PHOTO_TOO_LARGE'
  | 'PHOTO_TYPE_NOT_ALLOWED'
  | 'PHOTO_CORRUPTED'
  | 'PHOTO_DIMENSIONS_EXCEEDED'
  | 'PHOTO_PROCESSING_FAILED';

export class ImageProcessingError extends Error {
  public constructor(public readonly code: ImageProcessingErrorCode, message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const DECLARED_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FORMAT_MIME: Readonly<Record<string, string>> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

type AllowedInputFormat = 'jpeg' | 'png' | 'webp';

function detectedAllowedFormat(buffer: Buffer): AllowedInputFormat | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) return 'png';
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return undefined;
}

function mappedProcessingError(error: unknown): ImageProcessingError {
  if (error instanceof ImageProcessingError) return error;
  const message = error instanceof Error ? error.message : '';
  if (/pixel limit|limitInputPixels|exceeds pixel limit/iu.test(message)) {
    return new ImageProcessingError('PHOTO_DIMENSIONS_EXCEEDED', 'A fotografia possui dimensões acima do limite permitido.');
  }
  if (/unsupported image format|Input buffer contains unsupported image format|corrupt|invalid|truncated/iu.test(message)) {
    return new ImageProcessingError('PHOTO_CORRUPTED', 'A fotografia está corrompida ou não pôde ser decodificada com segurança.');
  }
  return new ImageProcessingError('PHOTO_PROCESSING_FAILED', 'A fotografia não pôde ser processada com segurança.');
}

async function variantMetadata(buffer: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new ImageProcessingError('PHOTO_PROCESSING_FAILED', 'Não foi possível determinar as dimensões da fotografia processada.');
  }
  return { width: metadata.width, height: metadata.height };
}

export class ImageProcessingService {
  public async process(photo: IncomingPhoto): Promise<ProcessedPhoto> {
    if (photo.buffer.length === 0) {
      throw new ImageProcessingError('PHOTO_CORRUPTED', 'A fotografia recebida está vazia.');
    }
    if (photo.buffer.length > MAX_PHOTO_BYTES) {
      throw new ImageProcessingError('PHOTO_TOO_LARGE', 'Cada fotografia deve ter no máximo 8 MB.');
    }
    const declaredMimeType = photo.declaredMimeType?.toLowerCase();
    if (declaredMimeType !== undefined && declaredMimeType !== '' && !DECLARED_ALLOWED_MIME.has(declaredMimeType)) {
      throw new ImageProcessingError('PHOTO_TYPE_NOT_ALLOWED', 'O formato declarado da fotografia não é permitido. Utilize JPEG, PNG ou WebP.');
    }

    const signatureFormat = detectedAllowedFormat(photo.buffer);
    if (signatureFormat === undefined) {
      throw new ImageProcessingError('PHOTO_CORRUPTED', 'A fotografia está corrompida ou não corresponde a JPEG, PNG ou WebP permitido.');
    }
    if (declaredMimeType !== undefined && declaredMimeType !== '' && FORMAT_MIME[signatureFormat] !== declaredMimeType) {
      throw new ImageProcessingError('PHOTO_TYPE_NOT_ALLOWED', 'O tipo MIME declarado não corresponde ao formato real da fotografia.');
    }

    try {
      const probe = sharp(photo.buffer, {
        failOn: 'warning',
        limitInputPixels: MAX_INPUT_PIXELS,
        animated: false,
        sequentialRead: true,
      });
      const metadata = await probe.metadata();
      if (metadata.format === undefined || !ALLOWED_FORMATS.has(metadata.format)) {
        throw new ImageProcessingError('PHOTO_TYPE_NOT_ALLOWED', 'O conteúdo real do arquivo não corresponde a JPEG, PNG ou WebP permitido.');
      }
      if (metadata.width === undefined || metadata.height === undefined || metadata.width < 1 || metadata.height < 1) {
        throw new ImageProcessingError('PHOTO_CORRUPTED', 'A fotografia não contém dimensões válidas.');
      }
      if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
        throw new ImageProcessingError('PHOTO_DIMENSIONS_EXCEEDED', 'A fotografia excede o limite de 40 megapixels de entrada.');
      }
      if ((metadata.pages ?? 1) > 1) {
        throw new ImageProcessingError('PHOTO_TYPE_NOT_ALLOWED', 'Imagens animadas ou com múltiplos quadros não são permitidas.');
      }

      const baseOptions = { failOn: 'warning' as const, limitInputPixels: MAX_INPUT_PIXELS, animated: false, sequentialRead: true };
      const mainBuffer = await sharp(photo.buffer, baseOptions)
        .rotate()
        .resize({ width: MAX_MAIN_DIMENSION, height: MAX_MAIN_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
      const thumbnailBuffer = await sharp(photo.buffer, baseOptions)
        .rotate()
        .resize({ width: MAX_THUMBNAIL_DIMENSION, height: MAX_THUMBNAIL_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_QUALITY, effort: 4 })
        .toBuffer();

      const [mainMetadata, thumbnailMetadata] = await Promise.all([
        variantMetadata(mainBuffer),
        variantMetadata(thumbnailBuffer),
      ]);
      return {
        contentType: 'image/webp',
        main: { buffer: mainBuffer, ...mainMetadata, byteSize: mainBuffer.length },
        thumbnail: { buffer: thumbnailBuffer, ...thumbnailMetadata, byteSize: thumbnailBuffer.length },
        sha256: createHash('sha256').update(mainBuffer).digest('hex'),
      };
    } catch (error: unknown) {
      throw mappedProcessingError(error);
    }
  }
}
