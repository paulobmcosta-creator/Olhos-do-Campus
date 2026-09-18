import { ArrowLeft, ArrowRight, Camera, Check, Copy, Images, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { StatusAlert } from '../components/common/StatusAlert';
import { StepIndicator } from '../components/public/StepIndicator';
import { ROUTES } from '../config/routes';
import { useAppData } from '../context/AppDataContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { CreateOccurrenceResponse } from '../models/occurrence';
import { occurrenceService } from '../services/occurrenceService';
import { getErrorMessage } from '../utils/errors';
import { revokePreparedPhoto, sanitizeImageFile } from '../utils/image';
import type { PreparedClientPhoto } from '../utils/image';
import { validateOccurrenceForm } from '../validators/occurrence';
import type { OccurrenceFormValues } from '../validators/occurrence';

const initialDraft: OccurrenceFormValues = {
  location: {
    campusId: '',
    buildingId: '',
    floorId: '',
    roomId: '',
    complement: '',
  },
  categoryId: '',
  description: '',
  immediateRisk: false,
};

function fieldError(errors: Record<string, string>, key: string): string | undefined {
  return errors[key];
}

export function NewOccurrencePage(): React.JSX.Element {
  useDocumentTitle('Registrar problema de infraestrutura');
  const { data } = useAppData();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OccurrenceFormValues>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PreparedClientPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CreateOccurrenceResponse | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const photosRef = useRef<PreparedClientPhoto[]>([]);

  const locations = data?.locations ?? [];
  const categories = data?.categories.filter((category) => category.active) ?? [];
  const selectedCampus = locations.find((location) => location.id === draft.location.campusId);
  const selectedBuilding = selectedCampus?.buildings.find((building) => building.id === draft.location.buildingId);
  const selectedFloor = selectedBuilding?.floors.find((floor) => floor.id === draft.location.floorId);
  const availableRooms = [...(selectedFloor?.rooms ?? [])]
    .filter((room) => room.active !== false)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base', numeric: true }));
  const selectedRoom = availableRooms.find((room) => room.id === draft.location.roomId);
  const selectedCategory = categories.find((category) => category.id === draft.categoryId);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => () => {
    photosRef.current.forEach(revokePreparedPhoto);
  }, []);

  const values = useMemo<OccurrenceFormValues>(() => ({
    location: draft.location,
    categoryId: draft.categoryId,
    description: draft.description,
    immediateRisk: draft.immediateRisk,
  }), [draft]);

  const updateLocation = (field: keyof OccurrenceFormValues['location'], value: string | boolean): void => {
    setDraft((current) => ({ ...current, location: { ...current.location, [field]: value } }));
  };

  const selectCampus = (campusId: string): void => {
    setDraft((current) => ({
      ...current,
      location: { ...current.location, campusId, buildingId: '', floorId: '', roomId: '' },
    }));
  };

  const selectBuilding = (buildingId: string): void => {
    const building = selectedCampus?.buildings.find((item) => item.id === buildingId);
    const singleTechnicalFloor = building?.floors.length === 1 ? building.floors[0] : undefined;
    setDraft((current) => ({
      ...current,
      location: { ...current.location, buildingId, floorId: singleTechnicalFloor?.id ?? '', roomId: '' },
    }));
  };

  const selectFloor = (floorId: string): void => {
    setDraft((current) => ({
      ...current,
      location: { ...current.location, floorId, roomId: '' },
    }));
  };

  const validateCurrentStep = (): boolean => {
    const allErrors = validateOccurrenceForm(values);
    const stepPrefixes: Record<number, string[]> = {
      1: [],
      2: ['location.'],
      3: ['categoryId'],
      4: ['description'],
      5: [],
      6: [],
    };
    const relevantPrefixes = stepPrefixes[step] ?? [];
    const relevantErrors = Object.fromEntries(Object.entries(allErrors).filter(([key]) =>
      relevantPrefixes.some((prefix) => key === prefix || key.startsWith(prefix)),
    ));
    setErrors(relevantErrors);
    return Object.keys(relevantErrors).length === 0;
  };

  const next = (): void => {
    if (validateCurrentStep()) {
      setErrors({});
      setStep((current) => Math.min(5, current + 1));
    }
  };

  const previous = (): void => {
    setErrors({});
    setSubmitError(null);
    setStep((current) => Math.max(1, current - 1));
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) return;
    if (photos.length + selected.length > 3) {
      setPhotoError('Você pode anexar no máximo 3 fotografias. Remova uma imagem antes de selecionar outra.');
      return;
    }
    setPhotoError(null);
    setProcessingPhotos(true);
    const prepared: PreparedClientPhoto[] = [];
    try {
      for (const file of selected) prepared.push(await sanitizeImageFile(file));
      setPhotos((current) => [...current, ...prepared]);
    } catch (caught) {
      prepared.forEach(revokePreparedPhoto);
      setPhotoError(getErrorMessage(caught));
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (photoId: string): void => {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed !== undefined) revokePreparedPhoto(removed);
      return current.filter((photo) => photo.id !== photoId);
    });
    setPhotoError(null);
  };


  const submit = async (): Promise<void> => {
    const allErrors = validateOccurrenceForm(values);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setStep(2);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await occurrenceService.create(values, photos.map((photo) => photo.file));
      photos.forEach(revokePreparedPhoto);
      setPhotos([]);
      setConfirmation(response);
      setStep(6);
    } catch (caught) {
      setSubmitError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = async (): Promise<void> => {
    if (confirmation === null) return;
    try {
      await navigator.clipboard.writeText(`Protocolo: ${confirmation.protocol}\nChave: ${confirmation.trackingKey}`);
      setCopyStatus('Protocolo e chave copiados.');
    } catch {
      setCopyStatus('Não foi possível copiar automaticamente. Anote os dados exibidos.');
    }
  };

  if (step === 6 && confirmation !== null) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="border border-green-300 bg-green-50 p-6 sm:p-8" aria-labelledby="confirmation-heading">
          <Check className="h-10 w-10 text-green-800" aria-hidden="true" />
          <h1 id="confirmation-heading" ref={headingRef} tabIndex={-1} className="mt-4 text-3xl font-bold text-slate-950 outline-none">Ocorrência registrada</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">Guarde o protocolo e a chave. A chave não pode ser recuperada posteriormente pela equipe administrativa.</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="border border-green-300 bg-white p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Protocolo</dt><dd className="mt-2 break-all font-mono text-lg font-bold">{confirmation.protocol}</dd></div>
            <div className="border border-green-300 bg-white p-4"><dt className="text-xs font-semibold uppercase text-slate-500">Chave de acompanhamento</dt><dd className="mt-2 break-all font-mono text-lg font-bold">{confirmation.trackingKey}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => void copyCredentials()}><Copy className="h-4 w-4" aria-hidden="true" />Copiar dados</button>
            <Link className="btn-primary" to={ROUTES.trackOccurrence} state={{ protocol: confirmation.protocol, trackingKey: confirmation.trackingKey }}>Acompanhar agora</Link>
          </div>
          {copyStatus !== null && <p className="mt-3 text-sm text-slate-700" role="status">{copyStatus}</p>}
        </section>
        <StatusAlert tone="warning">Sem a chave, não será possível consultar a ocorrência publicamente. O sistema não armazena a chave em texto claro.</StatusAlert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to={ROUTES.home} className="inline-flex items-center gap-2 text-sm font-semibold text-green-800 underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar</Link>
        <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-3xl font-bold text-slate-950 outline-none">Registrar problema de infraestrutura</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">Ajude-nos a cuidar e melhorar os espaços do campus. O registro não exige identificação pessoal obrigatória.</p>
      </div>

      <StepIndicator currentStep={step} totalSteps={5} />

      <section className="border border-slate-300 bg-white p-4 sm:p-6">
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <Camera className="mt-1 h-6 w-6 text-green-800" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold">Fotografias</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">A fotografia é opcional. Você pode anexar até 3 imagens.</p>
              </div>
            </div>
            <StatusAlert>
              Você pode anexar até 3 fotografias. As imagens serão processadas antes do armazenamento para reduzir o tamanho e remover metadados, como informações de localização.
            </StatusAlert>
            <StatusAlert tone="warning">Evite fotografar rostos, documentos, placas de veículos, telas ou outras informações pessoais. A remoção de metadados não remove dados pessoais que estejam visíveis na própria imagem.</StatusAlert>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex cursor-pointer flex-col items-center justify-center border border-dashed border-slate-400 p-6 text-center hover:bg-slate-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[#166534] has-[:focus-visible]:outline-offset-2 file-upload-trigger ${photos.length >= 3 || processingPhotos ? 'pointer-events-none opacity-60' : ''}`}>
                <Camera className="h-7 w-7 text-slate-600" aria-hidden="true" />
                <span className="mt-2 font-semibold">Tirar fotografia</span>
                <span className="mt-1 text-xs text-slate-600">Usar a câmera traseira quando disponível.</span>
                <input aria-label="Tirar fotografia da ocorrência" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={photos.length >= 3 || processingPhotos} onChange={(event) => void handlePhoto(event)} />
              </label>
              <label className={`flex cursor-pointer flex-col items-center justify-center border border-dashed border-slate-400 p-6 text-center hover:bg-slate-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[#166534] has-[:focus-visible]:outline-offset-2 file-upload-trigger ${photos.length >= 3 || processingPhotos ? 'pointer-events-none opacity-60' : ''}`}>
                <Images className="h-7 w-7 text-slate-600" aria-hidden="true" />
                <span className="mt-2 font-semibold">Selecionar da galeria</span>
                <span className="mt-1 text-xs text-slate-600">JPEG, PNG ou WebP; máximo de 8 MB por arquivo.</span>
                <input aria-label="Selecionar fotografia da galeria para a ocorrência" className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={photos.length >= 3 || processingPhotos} onChange={(event) => void handlePhoto(event)} />
              </label>
            </div>
            <p className="text-sm font-medium text-slate-700" role="status">{processingPhotos ? 'Processando fotografias...' : `${photos.length}/3 fotografias selecionadas`}</p>
            {photos.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3" aria-label="Pré-visualização das fotografias selecionadas">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="border border-slate-300 bg-slate-50 p-2">
                    <img src={photo.previewUrl} alt={`Pré-visualização da fotografia ${index + 1}`} className="h-40 w-full object-contain" />
                    <button type="button" className="btn-secondary mt-2 w-full" onClick={() => removePhoto(photo.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photoError !== null && <StatusAlert tone="error">{photoError}</StatusAlert>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Local da ocorrência</h2>
              <p className="mt-1 text-sm text-slate-600"><span className="text-red-700 font-bold" aria-hidden="true">*</span> Indica campo de preenchimento obrigatório.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="campus" className="form-label">
                  Campus ou unidade <span className="text-red-700 font-bold" aria-hidden="true">*</span><span className="sr-only"> (obrigatório)</span>
                </label>
                <select
                  id="campus"
                  className="form-control"
                  required
                  aria-required="true"
                  value={draft.location.campusId}
                  onChange={(event) => selectCampus(event.target.value)}
                  aria-invalid={fieldError(errors, 'location.campusId') !== undefined ? 'true' : undefined}
                  aria-describedby={fieldError(errors, 'location.campusId') ? 'campus-error' : undefined}
                >
                  <option value="">Selecione</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.campusName}</option>)}
                </select>
                {fieldError(errors, 'location.campusId') !== undefined && <p id="campus-error" className="form-error">{fieldError(errors, 'location.campusId')}</p>}
              </div>
              <div>
                <label htmlFor="building" className="form-label">
                  Prédio, bloco ou área <span className="text-red-700 font-bold" aria-hidden="true">*</span><span className="sr-only"> (obrigatório)</span>
                </label>
                <select
                  id="building"
                  className="form-control"
                  required
                  aria-required="true"
                  value={draft.location.buildingId}
                  disabled={selectedCampus === undefined}
                  onChange={(event) => selectBuilding(event.target.value)}
                  aria-invalid={fieldError(errors, 'location.buildingId') !== undefined ? 'true' : undefined}
                  aria-describedby={fieldError(errors, 'location.buildingId') ? 'building-error' : undefined}
                >
                  <option value="">Selecione</option>
                  {selectedCampus?.buildings.filter((b) => b.active !== false).map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
                </select>
                {fieldError(errors, 'location.buildingId') !== undefined && <p id="building-error" className="form-error">{fieldError(errors, 'location.buildingId')}</p>}
              </div>
              {selectedBuilding !== undefined && (selectedBuilding.floors.length > 1 || selectedBuilding.floors[0]?.name.trim()) && (
                <div>
                  <label htmlFor="floor" className="form-label">
                    Pavimento ou referência <span className="font-normal text-slate-500">(quando aplicável)</span>
                  </label>
                  <select
                    id="floor"
                    className="form-control"
                    value={draft.location.floorId}
                    onChange={(event) => selectFloor(event.target.value)}
                    aria-invalid={fieldError(errors, 'location.floorId') !== undefined ? 'true' : undefined}
                    aria-describedby={fieldError(errors, 'location.floorId') ? 'floor-error' : undefined}
                  >
                    <option value="">Selecione</option>
                    {selectedBuilding.floors.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                  </select>
                  {fieldError(errors, 'location.floorId') !== undefined && <p id="floor-error" className="form-error">{fieldError(errors, 'location.floorId')}</p>}
                </div>
              )}
              <div>
                <label htmlFor="room" className="form-label">
                  Sala, ambiente ou local <span className="text-red-700 font-bold" aria-hidden="true">*</span><span className="sr-only"> (obrigatório)</span>
                </label>
                <select
                  id="room"
                  className="form-control"
                  required
                  aria-required="true"
                  value={draft.location.roomId}
                  disabled={selectedFloor === undefined}
                  onChange={(event) => updateLocation('roomId', event.target.value)}
                  aria-invalid={fieldError(errors, 'location.roomId') !== undefined ? 'true' : undefined}
                  aria-describedby={fieldError(errors, 'location.roomId') ? 'room-error' : undefined}
                >
                  <option value="">Selecione</option>
                  {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                </select>
                {fieldError(errors, 'location.roomId') !== undefined && <p id="room-error" className="form-error">{fieldError(errors, 'location.roomId')}</p>}
              </div>
              <div className="sm:col-span-2"><label htmlFor="complement" className="form-label">Complemento <span className="font-normal text-slate-500">(opcional)</span></label><input id="complement" className="form-control" maxLength={300} value={draft.location.complement ?? ''} onChange={(event) => updateLocation('complement', event.target.value)} /></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <fieldset
            aria-required="true"
            aria-describedby={fieldError(errors, 'categoryId') ? 'category-error' : undefined}
            className="space-y-5"
          >
            <legend className="text-xl font-bold text-slate-950">
              Categoria do problema <span className="text-red-700 font-bold" aria-hidden="true">*</span><span className="sr-only"> (obrigatório)</span>
            </legend>
            <p className="mt-1 text-sm text-slate-600"><span className="text-red-700 font-bold" aria-hidden="true">*</span> Seleção obrigatória. Escolha a categoria correspondente ao problema observado.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.map((category) => (
                <label key={category.id} className={`cursor-pointer border p-4 ${draft.categoryId === category.id ? 'border-green-800 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                  <span className="flex gap-3">
                    <input
                      type="radio"
                      name="category"
                      value={category.id}
                      checked={draft.categoryId === category.id}
                      onChange={() => setDraft((current) => ({ ...current, categoryId: category.id }))}
                    />
                    <span>
                      <strong className="block">{category.name}</strong>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{category.description}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {fieldError(errors, 'categoryId') !== undefined && <p id="category-error" className="form-error">{fieldError(errors, 'categoryId')}</p>}
          </fieldset>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">Descrição da situação</h2>
              <p className="mt-1 text-sm text-slate-600"><span className="text-red-700 font-bold" aria-hidden="true">*</span> Indica campo de preenchimento obrigatório.</p>
            </div>
            <div>
              <label htmlFor="description" className="form-label">
                O que está acontecendo? <span className="text-red-700 font-bold" aria-hidden="true">*</span><span className="sr-only"> (obrigatório)</span>
              </label>
              <textarea
                id="description"
                className="form-control min-h-40"
                required
                aria-required="true"
                maxLength={2000}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                aria-invalid={fieldError(errors, 'description') !== undefined ? 'true' : undefined}
                aria-describedby={fieldError(errors, 'description') ? 'description-error' : undefined}
              />
              <p className="mt-1 text-xs text-slate-500">{draft.description.length}/2000 caracteres</p>
              {fieldError(errors, 'description') !== undefined && <p id="description-error" className="form-error">{fieldError(errors, 'description')}</p>}
            </div>
            <label className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-4">
              <input type="checkbox" className="mt-1" checked={draft.immediateRisk} onChange={(event) => setDraft((current) => ({ ...current, immediateRisk: event.target.checked }))} />
              <span>
                <strong className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Há risco imediato?</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-700">Marque quando houver risco atual para pessoas, patrimônio ou continuidade do serviço.</span>
              </span>
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5"><h2 className="text-xl font-bold">Revisar e registrar</h2><dl className="grid gap-4 border-y border-slate-200 py-5 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase text-slate-500">Fotografias</dt><dd className="mt-1 text-sm">{photos.length} anexada{photos.length === 1 ? '' : 's'}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Categoria</dt><dd className="mt-1 text-sm">{selectedCategory?.name ?? '—'}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Local</dt><dd className="mt-1 text-sm">{[selectedCampus?.campusName, selectedBuilding?.name, selectedFloor?.name, selectedRoom?.name, draft.location.complement].filter(Boolean).join(' — ')}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Descrição</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{draft.description}</dd></div><div><dt className="text-xs font-semibold uppercase text-slate-500">Risco imediato</dt><dd className="mt-1 text-sm">{draft.immediateRisk ? 'Sim' : 'Não'}</dd></div></dl>{photos.length > 0 && <div><p className="form-label">Miniaturas para revisão</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{photos.map((photo, index) => <img key={photo.id} src={photo.previewUrl} alt={`Fotografia ${index + 1} para revisão`} className="h-32 w-full border border-slate-300 object-contain" />)}</div></div>}<StatusAlert>Ao registrar, o sistema gerará um protocolo transacional e uma chave de acompanhamento secreta. A chave não será gravada em texto claro.</StatusAlert>{submitError !== null && <StatusAlert tone="error">{submitError}</StatusAlert>}</div>
        )}
      </section>

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={previous} disabled={step === 1}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Anterior</button>
        {step < 5 ? <button type="button" className="btn-primary" onClick={next}>Próximo<ArrowRight className="h-4 w-4" aria-hidden="true" /></button> : <button type="button" className="btn-primary" onClick={() => void submit()} disabled={submitting}>{submitting ? 'Registrando...' : 'Registrar ocorrência'}<Check className="h-4 w-4" aria-hidden="true" /></button>}
      </div>
    </div>
  );
}
