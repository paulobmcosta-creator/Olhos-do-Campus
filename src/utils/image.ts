export const CLIENT_MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const CLIENT_MAX_DIMENSION = 1600;
export const CLIENT_WEBP_QUALITY = 0.82;
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface PreparedClientPhoto {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

function outputDimensions(width: number, height: number): { width: number; height: number } {
  if (Math.max(width, height) <= CLIENT_MAX_DIMENSION) return { width, height };
  const scale = CLIENT_MAX_DIMENSION / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null || blob.type !== 'image/webp') {
        reject(new Error('Este navegador não conseguiu reencodar a fotografia em WebP.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', CLIENT_WEBP_QUALITY);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir a fotografia selecionada.'));
    image.src = url;
  });
}

export async function sanitizeImageFile(file: File): Promise<PreparedClientPhoto> {
  if (!ACCEPTED_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Selecione uma fotografia JPEG, PNG ou WebP.');
  }
  if (file.size > CLIENT_MAX_PHOTO_BYTES) throw new Error('Cada fotografia deve ter no máximo 8 MB.');

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('A fotografia selecionada não possui dimensões válidas.');
    const dimensions = outputDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('O navegador não conseguiu processar a fotografia.');
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToWebp(canvas);
    const normalizedFile = new File([blob], 'photo.webp', { type: 'image/webp', lastModified: Date.now() });
    return {
      id: crypto.randomUUID(),
      file: normalizedFile,
      previewUrl: URL.createObjectURL(blob),
      width: dimensions.width,
      height: dimensions.height,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function revokePreparedPhoto(photo: PreparedClientPhoto): void {
  URL.revokeObjectURL(photo.previewUrl);
}
