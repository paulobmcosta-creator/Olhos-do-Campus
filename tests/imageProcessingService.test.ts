import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  ImageProcessingError,
  ImageProcessingService,
  MAX_INPUT_PIXELS,
  MAX_MAIN_DIMENSION,
  MAX_PHOTO_BYTES,
  MAX_THUMBNAIL_DIMENSION,
} from '../server/services/imageProcessingService';

const service = new ImageProcessingService();

async function solid(format: 'jpeg' | 'png' | 'webp', width = 1200, height = 800): Promise<Buffer> {
  let pipeline = sharp({ create: { width, height, channels: 4, background: { r: 20, g: 120, b: 80, alpha: 0.7 } } });
  if (format === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 90 });
  if (format === 'png') pipeline = pipeline.png();
  if (format === 'webp') pipeline = pipeline.webp({ quality: 90 });
  return pipeline.toBuffer();
}

async function expectCode(action: Promise<unknown>, code: string): Promise<void> {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(ImageProcessingError);
    expect((error as ImageProcessingError).code).toBe(code);
    return;
  }
  throw new Error(`Era esperado erro ${code}.`);
}

describe('ImageProcessingService — validação autoritativa e reencodificação', () => {
  for (const [format, mime] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']] as const) {
    it(`aceita ${format.toUpperCase()} válido e produz WebP principal + miniatura`, async () => {
      const result = await service.process({ buffer: await solid(format), declaredMimeType: mime });
      const [main, thumb] = await Promise.all([sharp(result.main.buffer).metadata(), sharp(result.thumbnail.buffer).metadata()]);
      expect(result.contentType).toBe('image/webp');
      expect(main.format).toBe('webp');
      expect(thumb.format).toBe('webp');
      expect(result.main.width).toBeLessThanOrEqual(MAX_MAIN_DIMENSION);
      expect(result.main.height).toBeLessThanOrEqual(MAX_MAIN_DIMENSION);
      expect(result.thumbnail.width).toBeLessThanOrEqual(MAX_THUMBNAIL_DIMENSION);
      expect(result.thumbnail.height).toBeLessThanOrEqual(MAX_THUMBNAIL_DIMENSION);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(result).not.toHaveProperty('filename');
    });
  }

  it('rejeita SVG válido sem interpretar XML como formato permitido', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expectCode(service.process({ buffer: svg, declaredMimeType: 'image/svg+xml' }), 'PHOTO_TYPE_NOT_ALLOWED');
  });

  it('rejeita GIF válido', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#008000' } }).gif().toBuffer();
    await expectCode(service.process({ buffer: gif, declaredMimeType: 'image/gif' }), 'PHOTO_TYPE_NOT_ALLOWED');
  });

  it('rejeita TIFF e SVG disfarçados com MIME permitido antes da decodificação', async () => {
    const tiff = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#008000' } }).tiff().toBuffer();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    await expectCode(service.process({ buffer: tiff, declaredMimeType: 'image/jpeg' }), 'PHOTO_CORRUPTED');
    await expectCode(service.process({ buffer: svg, declaredMimeType: 'image/png' }), 'PHOTO_CORRUPTED');
  });

  it('rejeita conteúdo arbitrário e imagem corrompida', async () => {
    await expectCode(service.process({ buffer: Buffer.from('arquivo executável ou texto'), declaredMimeType: 'image/jpeg' }), 'PHOTO_CORRUPTED');
    await expectCode(service.process({ buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), declaredMimeType: 'image/jpeg' }), 'PHOTO_CORRUPTED');
  });

  it('não confia no MIME declarado quando diverge do conteúdo real', async () => {
    await expectCode(service.process({ buffer: await solid('png'), declaredMimeType: 'image/jpeg' }), 'PHOTO_TYPE_NOT_ALLOWED');
  });

  it('rejeita arquivo acima de 8 MB antes da decodificação', async () => {
    await expectCode(service.process({ buffer: Buffer.alloc(MAX_PHOTO_BYTES + 1), declaredMimeType: 'image/png' }), 'PHOTO_TOO_LARGE');
  });

  it('rejeita imagem acima do limite de pixels decodificados', async () => {
    expect(7000 * 6000).toBeGreaterThan(MAX_INPUT_PIXELS);
    const large = await sharp({ create: { width: 7000, height: 6000, channels: 3, background: '#ffffff' } }).png({ compressionLevel: 9 }).toBuffer();
    await expectCode(service.process({ buffer: large, declaredMimeType: 'image/png' }), 'PHOTO_DIMENSIONS_EXCEEDED');
  });

  it('redimensiona preservando proporção e não amplia imagens pequenas', async () => {
    const large = await service.process({ buffer: await solid('jpeg', 2400, 1200), declaredMimeType: 'image/jpeg' });
    expect([large.main.width, large.main.height]).toEqual([1600, 800]);
    expect([large.thumbnail.width, large.thumbnail.height]).toEqual([480, 240]);

    const small = await service.process({ buffer: await solid('png', 320, 200), declaredMimeType: 'image/png' });
    expect([small.main.width, small.main.height]).toEqual([320, 200]);
    expect([small.thumbnail.width, small.thumbnail.height]).toEqual([320, 200]);
  });

  it('aplica orientação e remove EXIF, GPS, campo textual e XMP por nova codificação', async () => {
    const input = readFileSync(join(process.cwd(), 'tests/fixtures/photo-with-exif-gps-xmp.jpg'));
    const before = await sharp(input).metadata();
    expect(before.orientation).toBe(6);
    expect(before.exif).toBeDefined();
    expect(before.xmp).toBeDefined();
    expect(input.includes(Buffer.from('Fixture metadata pessoal'))).toBe(true);
    // Tag GPSInfo 0x8825 no TIFF big-endian da fixture.
    expect(input.includes(Buffer.from([0x88, 0x25]))).toBe(true);

    const result = await service.process({ buffer: input, declaredMimeType: 'image/jpeg' });
    const after = await sharp(result.main.buffer).metadata();
    expect([result.main.width, result.main.height]).toEqual([80, 120]);
    expect(after.orientation).toBeUndefined();
    expect(after.exif).toBeUndefined();
    expect(after.xmp).toBeUndefined();
    expect(after.iptc).toBeUndefined();
    expect(result.main.buffer.includes(Buffer.from('Fixture metadata pessoal'))).toBe(false);
    expect(result.main.buffer.includes(Buffer.from('Pessoa XMP'))).toBe(false);
  });
});
