import { Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PublicOccurrencePhoto } from '../../models/occurrence';
import { occurrenceService } from '../../services/occurrenceService';
import { getErrorMessage } from '../../utils/errors';
import { StatusAlert } from '../common/StatusAlert';

interface PublicSolutionPhotoGalleryProps {
  photos: PublicOccurrencePhoto[];
  protocol: string;
  trackingKey: string;
}

export function PublicSolutionPhotoGallery({ photos, protocol, trackingKey }: PublicSolutionPhotoGalleryProps): React.JSX.Element | null {
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fullUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const load = async (): Promise<void> => {
      const next = new Map<string, string>();
      for (const photo of photos) {
        try {
          const blob = await occurrenceService.getPublicPhoto(protocol, trackingKey, photo.id, 'thumbnail');
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          next.set(photo.id, url);
        } catch (caught) {
          if (!cancelled) setError(getErrorMessage(caught));
        }
      }
      if (!cancelled) setThumbnailUrls(next);
    };
    void load();
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos, protocol, trackingKey]);

  useEffect(() => {
    fullUrlRef.current = fullUrl;
  }, [fullUrl]);

  useEffect(() => () => {
    if (fullUrlRef.current !== null) URL.revokeObjectURL(fullUrlRef.current);
  }, []);

  useEffect(() => {
    if (fullUrl === null) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        URL.revokeObjectURL(fullUrl);
        setFullUrl(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullUrl]);

  if (photos.length === 0) return null;

  const open = async (photoId: string): Promise<void> => {
    setError(null);
    try {
      const blob = await occurrenceService.getPublicPhoto(protocol, trackingKey, photoId, 'full');
      if (fullUrl !== null) URL.revokeObjectURL(fullUrl);
      setFullUrl(URL.createObjectURL(blob));
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  };

  const close = (): void => {
    if (fullUrl !== null) URL.revokeObjectURL(fullUrl);
    setFullUrl(null);
  };

  return (
    <section aria-labelledby="public-solution-photos-heading">
      <h3 id="public-solution-photos-heading" className="text-lg font-bold text-slate-950">Registro fotográfico da solução</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <article key={photo.id} className="border border-slate-300 bg-slate-50 p-2">
            <button type="button" className="block w-full focus:outline-none focus:ring-2 focus:ring-green-800" onClick={() => void open(photo.id)} aria-label={`Ampliar fotografia pública da solução ${index + 1}`}>
              {thumbnailUrls.get(photo.id) === undefined
                ? <div className="flex h-36 items-center justify-center text-sm text-slate-500">Carregando miniatura...</div>
                : <img src={thumbnailUrls.get(photo.id)} alt={`Fotografia pública da solução ${index + 1}`} className="h-36 w-full object-contain" />}
            </button>
            <button type="button" className="btn-secondary mt-2 w-full" onClick={() => void open(photo.id)}><Maximize2 className="h-4 w-4" aria-hidden="true" />Ampliar</button>
          </article>
        ))}
      </div>
      {error !== null && <div className="mt-3"><StatusAlert tone="error">{error}</StatusAlert></div>}
      {fullUrl !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Fotografia pública ampliada da solução">
          <div className="max-h-[95vh] w-full max-w-5xl overflow-auto bg-white p-4">
            <div className="flex justify-end"><button ref={closeRef} type="button" className="btn-secondary" onClick={close}><X className="h-4 w-4" aria-hidden="true" />Fechar</button></div>
            <img src={fullUrl} alt="Fotografia pública ampliada da solução" className="mt-3 max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}
    </section>
  );
}
