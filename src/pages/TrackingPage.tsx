import { ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StatusBadge } from '../components/common/OccurrenceBadges';
import { StatusAlert } from '../components/common/StatusAlert';
import { PublicSolutionPhotoGallery } from '../components/photos/PublicSolutionPhotoGallery';
import { ROUTES } from '../config/routes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { PublicOccurrence } from '../models/occurrence';
import { occurrenceService } from '../services/occurrenceService';
import { formatDateTime } from '../utils/date';
import { getErrorMessage } from '../utils/errors';
import { trackingSchema } from '../validators/tracking';

interface TrackingLocationState {
  protocol?: string;
  trackingKey?: string;
}

function readTrackingState(value: unknown): TrackingLocationState {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const result: TrackingLocationState = {};
  if ('protocol' in value && typeof value.protocol === 'string') {
    result.protocol = value.protocol;
  }
  if ('trackingKey' in value && typeof value.trackingKey === 'string') {
    result.trackingKey = value.trackingKey;
  }
  return result;
}

export function TrackingPage(): React.JSX.Element {
  useDocumentTitle('Acompanhar uma ocorrência');
  const location = useLocation();
  const state = readTrackingState(location.state);
  const [protocol, setProtocol] = useState(state.protocol ?? '');
  const [trackingKey, setTrackingKey] = useState(state.trackingKey ?? '');
  const [result, setResult] = useState<PublicOccurrence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successfulCredentials, setSuccessfulCredentials] = useState<{ protocol: string; trackingKey: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setSuccessfulCredentials(null);

    const validation = trackingSchema.safeParse({ protocol, trackingKey });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Revise o protocolo e a chave informados.');
      return;
    }

    setSubmitting(true);
    try {
      const tracked = await occurrenceService.track(validation.data.protocol, validation.data.trackingKey);
      setResult(tracked);
      setSuccessfulCredentials({ protocol: validation.data.protocol, trackingKey: validation.data.trackingKey });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to={ROUTES.home} className="inline-flex items-center gap-2 text-sm font-semibold text-green-800 underline-offset-4 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar à página inicial
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">Acompanhar uma ocorrência</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          A consulta pública exige simultaneamente o protocolo e a chave de acompanhamento. Nenhuma ocorrência é exibida apenas pelo protocolo.
        </p>
      </div>

      <form onSubmit={(event) => void submit(event)} className="border border-slate-300 bg-slate-50 p-4 sm:p-6" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="tracking-protocol" className="form-label">Protocolo</label>
            <input
              id="tracking-protocol"
              className="form-control font-mono uppercase"
              autoComplete="off"
              placeholder="INF-2026-000001"
              value={protocol}
              onChange={(event) => setProtocol(event.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label htmlFor="tracking-key" className="form-label">Chave de acompanhamento</label>
            <input
              id="tracking-key"
              className="form-control font-mono uppercase"
              autoComplete="off"
              placeholder="XXXX-XXXX-XXXX"
              value={trackingKey}
              onChange={(event) => setTrackingKey(event.target.value.toUpperCase())}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary mt-5" disabled={submitting}>
          <Search className="h-4 w-4" aria-hidden="true" />
          {submitting ? 'Consultando...' : 'Consultar ocorrência'}
        </button>
      </form>

      {error !== null && <StatusAlert tone="error">{error}</StatusAlert>}

      {result !== null && (
        <section aria-labelledby="tracking-result-heading" className="space-y-6 border border-slate-300 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protocolo</p>
              <h2 id="tracking-result-heading" className="mt-1 break-all font-mono text-xl font-bold text-slate-950">{result.protocol}</h2>
              <p className="mt-2 text-sm text-slate-600">Registrada em {formatDateTime(result.createdAt)}</p>
            </div>
            <StatusBadge status={result.status} />
          </div>

          <dl className="grid gap-4 border-y border-slate-200 py-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Categoria</dt><dd className="mt-1 text-sm">{result.category}</dd>{result.categoryAdjusted && <p className="mt-1 text-xs text-slate-600">A categoria foi ajustada pela equipe responsável após a triagem.</p>}</div>
            <div><dt className="text-xs font-semibold uppercase text-slate-500">Local</dt><dd className="mt-1 text-sm">{[result.location.campusName, result.location.buildingName, result.location.floor, result.location.room].filter(Boolean).join(' — ')}</dd>{result.locationAdjusted && <p className="mt-1 text-xs text-slate-600">A localização foi ajustada pela equipe responsável após a triagem.</p>}</div>
            <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Descrição</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6">{result.description}</dd></div>
          </dl>

          {successfulCredentials !== null && (
            <PublicSolutionPhotoGallery
              photos={result.photos}
              protocol={successfulCredentials.protocol}
              trackingKey={successfulCredentials.trackingKey}
            />
          )}

          <div>
            <h3 className="text-lg font-bold text-slate-950">Histórico público</h3>
            <ol className="mt-4 space-y-4 border-l-2 border-green-700 pl-5">
              {result.timeline.map((event) => (
                <li key={event.id}>
                  <p className="font-semibold text-slate-900">{event.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(event.date)}</p>
                  {event.description !== undefined && <p className="mt-1 text-sm leading-6 text-slate-700">{event.description}</p>}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-950">Mensagens públicas</h3>
            {result.publicMessages.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">Ainda não há mensagem pública adicional.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {result.publicMessages.map((message) => (
                  <article key={message.id} className="border border-slate-300 bg-slate-50 p-4">
                    <p className="text-sm leading-6 text-slate-800">{message.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{message.authorRole} — {formatDateTime(message.date)}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <StatusAlert>
            A visão pública não apresenta observações administrativas internas, autoria nominal de servidores ou a chave armazenada pelo sistema.
          </StatusAlert>
        </section>
      )}
    </div>
  );
}
