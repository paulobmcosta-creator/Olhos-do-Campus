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

interface EncodedCanvasPhoto {
  blob: Blob;
  fileName: 'photo.webp' | 'photo.jpg' | 'photo.png';
}

function outputDimensions(width: number, height: number): { width: number; height: number } {
  if (Math.max(width, height) <= CLIENT_MAX_DIMENSION) return { width, height };
  const scale = CLIENT_MAX_DIMENSION / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function encodeCanvasPhoto(canvas: HTMLCanvasElement): Promise<EncodedCanvasPhoto> {
  const webp = await canvasToBlob(canvas, 'image/webp', CLIENT_WEBP_QUALITY);
  if (webp !== null && webp.type === 'image/webp') {
    return { blob: webp, fileName: 'photo.webp' };
  }

  // Safari/iOS pode não codificar canvas em WebP e retornar PNG (fallback do navegador)
  // ou null. JPEG é amplamente suportado e mantém o arquivo pequeno para fotografias.
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', CLIENT_WEBP_QUALITY);
  if (jpeg !== null && jpeg.type === 'image/jpeg') {
    return { blob: jpeg, fileName: 'photo.jpg' };
  }

  // Último fallback seguro: reutiliza PNG produzido pelo navegador ao rejeitar WebP,
  // ou solicita PNG explicitamente. O servidor continuará reencodando a entrada em WebP.
  if (webp !== null && webp.type === 'image/png') {
    return { blob: webp, fileName: 'photo.png' };
  }

  const png = await canvasToBlob(canvas, 'image/png');
  if (png !== null && png.type === 'image/png') {
    return { blob: png, fileName: 'photo.png' };
  }

  throw new Error('Este navegador não conseguiu processar a fotografia em um formato compatível.');
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

    const encoded = await encodeCanvasPhoto(canvas);
    if (encoded.blob.size > CLIENT_MAX_PHOTO_BYTES) {
      throw new Error('A fotografia processada excedeu o limite de 8 MB. Tente outra fotografia.');
    }

    const normalizedFile = new File([encoded.blob], encoded.fileName, {
      type: encoded.blob.type,
      lastModified: Date.now(),
    });

    return {
      id: crypto.randomUUID(),
      file: normalizedFile,
      previewUrl: URL.createObjectURL(encoded.blob),
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
