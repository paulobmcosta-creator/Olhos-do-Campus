import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_MAX_PHOTO_BYTES, revokePreparedPhoto, sanitizeImageFile } from '../src/utils/image';

let objectUrlSequence = 0;
let createObjectUrl: ReturnType<typeof vi.fn>;
let revokeObjectUrl: ReturnType<typeof vi.fn>;
let createElementSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  objectUrlSequence = 0;
  createObjectUrl = vi.fn(() => `blob:test-${++objectUrlSequence}`);
  revokeObjectUrl = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

  class TestImage {
    public naturalWidth = 2000;
    public naturalHeight = 1000;
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  }
  vi.stubGlobal('Image', TestImage);

  const original = document.createElement.bind(document);
  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = original(tagName, options);
    if (tagName.toLowerCase() === 'canvas') {
      const canvas = element as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getContext', { configurable: true, value: vi.fn(() => ({ drawImage: vi.fn() })) });
      Object.defineProperty(canvas, 'toBlob', { configurable: true, value: vi.fn((callback: BlobCallback) => callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }))) });
    }
    return element;
  }) as typeof document.createElement);
});

afterEach(() => {
  createElementSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe('processamento de fotografias no cliente', () => {
  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
    it(`aceita ${mime}, redimensiona e produz File WebP + Object URL temporária`, async () => {
      const prepared = await sanitizeImageFile(new File([new Uint8Array([1, 2, 3])], 'original-com-nome-pessoal.ext', { type: mime }));
      expect(prepared.file.type).toBe('image/webp');
      expect(prepared.file.name).toBe('photo.webp');
      expect([prepared.width, prepared.height]).toEqual([1600, 800]);
      expect(prepared.previewUrl).toBe('blob:test-2');
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-1');
      revokePreparedPhoto(prepared);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-2');
    });
  }

  it('rejeita formato preliminar não permitido e arquivo acima de 8 MB', async () => {
    await expect(sanitizeImageFile(new File([new Uint8Array([1])], 'arquivo.gif', { type: 'image/gif' }))).rejects.toThrow(/JPEG, PNG ou WebP/iu);
    await expect(sanitizeImageFile(new File([new Uint8Array(CLIENT_MAX_PHOTO_BYTES + 1)], 'grande.jpg', { type: 'image/jpeg' }))).rejects.toThrow(/8 MB/iu);
  });
});
