import { Eye, EyeOff, ImagePlus, Maximize2, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import type { AdminRole } from '../../models/admin';
import type { Occurrence, OccurrencePhoto } from '../../models/occurrence';
import { ApiError } from '../../services/apiClient';
import { occurrenceService } from '../../services/occurrenceService';
import { getErrorMessage } from '../../utils/errors';
import { revokePreparedPhoto, sanitizeImageFile } from '../../utils/image';
import type { PreparedClientPhoto } from '../../utils/image';
import { StatusAlert } from '../common/StatusAlert';

interface AdminPhotoGalleryProps {
  occurrence: Occurrence;
  role: AdminRole;
  onOccurrenceUpdated: (occurrence: Occurrence) => void;
}

interface FullImageState {
  url: string;
}

function PhotoGroup({
  title,
  photos,
  role,
  thumbnailUrls,
  onOpen,
  onVisibility,
  onDelete,
  busyPhotoId,
}: {
  title: string;
  photos: OccurrencePhoto[];
  role: AdminRole;
  thumbnailUrls: ReadonlyMap<string, string>;
  onOpen: (photo: OccurrencePhoto, triggerEl?: HTMLElement | null) => void;
  onVisibility: (photo: OccurrencePhoto) => void;
  onDelete: (photo: OccurrencePhoto) => void;
  busyPhotoId: string | null;
}): React.JSX.Element {
  const canManage = role === 'Administrador' || role === 'Gestor';
  const active = photos.filter((photo) => photo.status === 'READY');
  const deleted = photos.filter((photo) => photo.status === 'DELETED');
  return (
    <section className="border border-slate-300 p-5" aria-labelledby={`photo-group-${title.replaceAll(' ', '-').toLowerCase()}`}>
      <h2 id={`photo-group-${title.replaceAll(' ', '-').toLowerCase()}`} className="text-lg font-bold text-slate-950">{title}</h2>
      {active.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Nenhuma fotografia disponível nesta seção.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((photo, index) => {
            const thumbnailUrl = thumbnailUrls.get(photo.id);
            return (
              <article key={photo.id} className="border border-slate-300 bg-slate-50 p-3">
                <button
                  type="button"
                  className="block w-full border border-slate-300 bg-white p-1 focus:outline-none focus:ring-2 focus:ring-green-800"
                  onClick={(e) => onOpen(photo, e.currentTarget)}
                  aria-label={`Abrir fotografia ${index + 1} de ${title.toLowerCase()} em tamanho maior`}
                >
                  {thumbnailUrl === undefined
                    ? <div className="flex h-40 items-center justify-center text-sm text-slate-500">Carregando miniatura...</div>
                    : <img src={thumbnailUrl} alt={`Miniatura da fotografia ${index + 1} de ${title.toLowerCase()}`} className="h-40 w-full object-contain" />}
                </button>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={`border px-2 py-1 text-xs font-semibold ${photo.visibility === 'PUBLIC' ? 'border-green-300 bg-green-50 text-green-900' : 'border-slate-300 bg-white text-slate-700'}`}>
                    {photo.visibility === 'PUBLIC' ? 'Pública' : 'Interna'}
                  </span>
                  <span className="text-xs text-slate-500">{photo.width} × {photo.height}px</span>
                </div>
                <button type="button" className="btn-secondary mt-3 w-full" onClick={(e) => onOpen(photo, e.currentTarget)}>
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />Ampliar
                </button>
                {canManage && photo.kind === 'RESOLUTION' && (
                  <div className="mt-2 grid gap-2">
                    <button type="button" className="btn-secondary w-full" disabled={busyPhotoId !== null} onClick={() => onVisibility(photo)}>
                      {photo.visibility === 'PUBLIC' ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      {photo.visibility === 'PUBLIC' ? 'Tornar interna' : 'Tornar pública'}
                    </button>
                    <button type="button" className="btn-secondary w-full" disabled={busyPhotoId !== null} onClick={() => onDelete(photo)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />Excluir fotografia
                    </button>
                  </div>
                )}
                {canManage && photo.kind === 'INITIAL' && (
                  <button type="button" className="btn-secondary mt-2 w-full" disabled={busyPhotoId !== null} onClick={() => onDelete(photo)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />Excluir fotografia
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {deleted.length > 0 && <p className="mt-4 text-xs text-slate-500">{deleted.length} fotografia{deleted.length === 1 ? '' : 's'} removida{deleted.length === 1 ? '' : 's'} permanece{deleted.length === 1 ? '' : 'm'} registrada{deleted.length === 1 ? '' : 's'} no histórico lógico e não pode{deleted.length === 1 ? '' : 'm'} mais ser acessada{deleted.length === 1 ? '' : 's'}.</p>}
    </section>
  );
}

export function AdminPhotoGallery({ occurrence, role, onOccurrenceUpdated }: AdminPhotoGalleryProps): React.JSX.Element {
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const [fullImage, setFullImage] = useState<FullImageState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [prepared, setPrepared] = useState<PreparedClientPhoto[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const preparedRef = useRef<PreparedClientPhoto[]>([]);
  const fullImageRef = useRef<FullImageState | null>(null);

  const initialPhotos = occurrence.photos.filter((photo) => photo.kind === 'INITIAL');
  const resolutionPhotos = occurrence.photos.filter((photo) => photo.kind === 'RESOLUTION');
  const readyResolutionCount = resolutionPhotos.filter((photo) => photo.status === 'READY').length;
  const remainingResolutionSlots = Math.max(0, 3 - readyResolutionCount);

  useEffect(() => {
    preparedRef.current = prepared;
  }, [prepared]);

  useEffect(() => () => {
    preparedRef.current.forEach(revokePreparedPhoto);
    if (fullImageRef.current !== null) URL.revokeObjectURL(fullImageRef.current.url);
  }, []);

  useEffect(() => {
    fullImageRef.current = fullImage;
  }, [fullImage]);

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];
    const load = async (): Promise<void> => {
      const next = new Map<string, string>();
      const photosToLoad = occurrence.photos.filter((photo) => photo.status === 'READY');
      for (const photo of photosToLoad) {
        try {
          const blob = await occurrenceService.getAdminPhoto(occurrence.id, photo.id, 'thumbnail');
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          createdUrls.push(url);
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
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [occurrence.id, occurrence.photos, occurrence.version]);

  const closeFull = useCallback((): void => {
    if (fullImage !== null) URL.revokeObjectURL(fullImage.url);
    setFullImage(null);
  }, [fullImage]);

  const { setTriggerElement } = useModalFocusTrap({
    isOpen: fullImage !== null,
    onClose: closeFull,
    containerRef: modalRef,
    initialFocusRef: closeRef,
  });

  const openFull = async (photo: OccurrencePhoto, triggerEl?: HTMLElement | null): Promise<void> => {
    if (triggerEl) {
      setTriggerElement(triggerEl);
    } else if (document.activeElement instanceof HTMLElement) {
      setTriggerElement(document.activeElement);
    }
    setError(null);
    setBusyPhotoId(photo.id);
    try {
      const blob = await occurrenceService.getAdminPhoto(occurrence.id, photo.id, 'full');
      if (fullImage !== null) URL.revokeObjectURL(fullImage.url);
      setFullImage({ url: URL.createObjectURL(blob) });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusyPhotoId(null);
    }
  };

  const handleSelect = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    if (files.length + prepared.length > remainingResolutionSlots) {
      setError(`É possível selecionar no máximo ${remainingResolutionSlots} nova${remainingResolutionSlots === 1 ? '' : 's'} fotografia${remainingResolutionSlots === 1 ? '' : 's'} de solução neste momento.`);
      return;
    }
    setError(null);
    const next: PreparedClientPhoto[] = [];
    try {
      for (const file of files) next.push(await sanitizeImageFile(file));
      setPrepared((current) => [...current, ...next]);
    } catch (caught) {
      next.forEach(revokePreparedPhoto);
      setError(getErrorMessage(caught));
    }
  };

  const removePrepared = (id: string): void => {
    setPrepared((current) => {
      const item = current.find((photo) => photo.id === id);
      if (item !== undefined) revokePreparedPhoto(item);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const uploadResolution = async (): Promise<void> => {
    if (prepared.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await occurrenceService.addResolutionPhotos(occurrence.id, occurrence.version, prepared.map((photo) => photo.file));
      prepared.forEach(revokePreparedPhoto);
      setPrepared([]);
      onOccurrenceUpdated(updated);
      setSuccess('Fotografia(s) da solução armazenada(s) com visibilidade interna.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('A ocorrência foi atualizada por outro usuário. Recarregue os dados antes de continuar.');
      } else {
        setError(getErrorMessage(caught));
      }
    } finally {
      setUploading(false);
    }
  };

  const updateVisibility = async (photo: OccurrencePhoto): Promise<void> => {
    setBusyPhotoId(photo.id);
    setError(null);
    setSuccess(null);
    try {
      const visibility = photo.visibility === 'PUBLIC' ? 'INTERNAL' : 'PUBLIC';
      const updated = await occurrenceService.updatePhotoVisibility(occurrence.id, photo.id, occurrence.version, visibility);
      onOccurrenceUpdated(updated);
      setSuccess(visibility === 'PUBLIC' ? 'Fotografia da solução disponibilizada para consulta pública.' : 'Fotografia da solução voltou a ser interna.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusyPhotoId(null);
    }
  };

  const deletePhoto = async (photo: OccurrencePhoto): Promise<void> => {
    if (!window.confirm('Confirma a exclusão desta fotografia? O histórico da ação será preservado.')) return;
    setBusyPhotoId(photo.id);
    setError(null);
    setSuccess(null);
    try {
      const updated = await occurrenceService.deletePhoto(occurrence.id, photo.id, occurrence.version);
      onOccurrenceUpdated(updated);
      setSuccess('Fotografia removida e encaminhada para exclusão física do Storage.');
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusyPhotoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PhotoGroup title="Fotografias do registro" photos={initialPhotos} role={role} thumbnailUrls={thumbnailUrls} onOpen={(photo, el) => void openFull(photo, el)} onVisibility={(photo) => void updateVisibility(photo)} onDelete={(photo) => void deletePhoto(photo)} busyPhotoId={busyPhotoId} />
      <PhotoGroup title="Fotografias da solução" photos={resolutionPhotos} role={role} thumbnailUrls={thumbnailUrls} onOpen={(photo, el) => void openFull(photo, el)} onVisibility={(photo) => void updateVisibility(photo)} onDelete={(photo) => void deletePhoto(photo)} busyPhotoId={busyPhotoId} />

      <section className="border border-slate-300 p-5" aria-labelledby="solution-upload-heading">
        <h2 id="solution-upload-heading" className="text-lg font-bold text-slate-950">Adicionar fotografia da solução</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">Até 3 fotografias de solução podem permanecer ativas. Novas imagens são internas por padrão e não se tornam públicas automaticamente.</p>
        {remainingResolutionSlots > 0 ? (
          <>
            <label className="btn-secondary mt-4 inline-flex cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[#166534] has-[:focus-visible]:outline-offset-2">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />Selecionar fotografia(s)
              <input aria-label="Selecionar fotografias da solução" className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleSelect(event)} disabled={uploading} />
            </label>
            {prepared.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {prepared.map((photo, index) => (
                  <div key={photo.id} className="border border-slate-300 p-2">
                    <img src={photo.previewUrl} alt={`Pré-visualização da fotografia de solução ${index + 1}`} className="h-36 w-full object-contain" />
                    <button type="button" className="btn-secondary mt-2 w-full" onClick={() => removePrepared(photo.id)} disabled={uploading}><Trash2 className="h-4 w-4" aria-hidden="true" />Remover</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn-primary mt-4" onClick={() => void uploadResolution()} disabled={prepared.length === 0 || uploading}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />{uploading ? 'Enviando...' : 'Anexar à solução'}
            </button>
          </>
        ) : <p className="mt-3 text-sm text-slate-600">O limite de 3 fotografias de solução ativas foi atingido.</p>}
        {error !== null && <div className="mt-4"><StatusAlert tone="error">{error}</StatusAlert></div>}
        {success !== null && <div className="mt-4"><StatusAlert tone="success">{success}</StatusAlert></div>}
      </section>

      {fullImage !== null && (
        <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Visualização ampliada da fotografia">
          <div className="max-h-[95vh] w-full max-w-5xl overflow-auto bg-white p-4 shadow-xl">
            <div className="flex justify-end">
              <button ref={closeRef} type="button" className="btn-secondary" onClick={closeFull}><X className="h-4 w-4" aria-hidden="true" />Fechar</button>
            </div>
            <img src={fullImage.url} alt="Fotografia ampliada da ocorrência" className="mt-3 max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
