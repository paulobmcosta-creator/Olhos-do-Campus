import { Download, Filter, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingState } from '../../components/common/LoadingState';
import { PriorityBadge, StatusBadge } from '../../components/common/OccurrenceBadges';
import { StatusAlert } from '../../components/common/StatusAlert';
import { ROUTES } from '../../config/routes';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useAppData } from '../../context/AppDataContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  OCCURRENCE_PRIORITIES,
  OCCURRENCE_STATUSES,
  type Occurrence,
  type OccurrenceFilterOptions,
  type OccurrenceSort,
} from '../../models/occurrence';
import { adminService } from '../../services/adminService';
import { occurrenceService } from '../../services/occurrenceService';
import { operationsService } from '../../services/operationsService';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { startNonDestructivePolling } from '../../utils/polling';

function boolParam(params: URLSearchParams, key: string): boolean | undefined { return params.get(key) === 'true' ? true : undefined; }
function initialParams(params: URLSearchParams): OccurrenceFilterOptions {
  const page = Number(params.get('pageSize'));
  const text = (key: string): string | undefined => params.get(key) || undefined;
  return {
    ...(text('protocol') ? { protocol: text('protocol') } : {}),
    ...(text('keyword') ? { keyword: text('keyword') } : {}),
    ...(text('startDate') ? { startDate: text('startDate') } : {}),
    ...(text('endDate') ? { endDate: text('endDate') } : {}),
    ...(text('closedStartDate') ? { closedStartDate: text('closedStartDate') } : {}),
    ...(text('closedEndDate') ? { closedEndDate: text('closedEndDate') } : {}),
    ...(text('category') ? { category: text('category') } : {}),
    ...(text('areaId') ? { areaId: text('areaId') } : {}),
    ...(text('environmentId') ? { environmentId: text('environmentId') } : {}),
    ...(text('status') ? { status: text('status') as OccurrenceFilterOptions['status'] } : {}),
    ...(text('priority') ? { priority: text('priority') as OccurrenceFilterOptions['priority'] } : {}),
    ...(text('assignedTeamId') ? { assignedTeamId: text('assignedTeamId') } : {}),
    ...(text('assignedToAdminUserId') ? { assignedToAdminUserId: text('assignedToAdminUserId') } : {}),
    ...(text('immediateRisk') ? { immediateRisk: text('immediateRisk') as 'true' | 'false' } : {}),
    ...(text('slaStatus') ? { slaStatus: text('slaStatus') as OccurrenceFilterOptions['slaStatus'] } : {}),
    ...(text('dataClassification') ? { dataClassification: text('dataClassification') as 'REAL' | 'TEST' } : {}),
    ...(boolParam(params, 'withoutTeam') ? { withoutTeam: true } : {}),
    ...(boolParam(params, 'withoutRouting') ? { withoutRouting: true } : {}),
    ...(boolParam(params, 'criticalPriority') ? { criticalPriority: true } : {}),
    ...(boolParam(params, 'awaitingAction') ? { awaitingAction: true } : {}),
    ...(boolParam(params, 'withoutResponsible') ? { withoutResponsible: true } : {}),
    ...(boolParam(params, 'withPhoto') ? { withPhoto: true } : {}),
    ...(boolParam(params, 'withoutPhoto') ? { withoutPhoto: true } : {}),
    ...(boolParam(params, 'reopened') ? { reopened: true } : {}),
    pageSize: page === 50 || page === 100 ? page : 25,
    sort: (text('sort') as OccurrenceSort | undefined) ?? 'operational',
  };
}

function cleanFilters(filters: OccurrenceFilterOptions): OccurrenceFilterOptions {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== false && value !== undefined)) as OccurrenceFilterOptions;
}

export function AdminOccurrencesPage(): React.JSX.Element {
  useDocumentTitle('Ocorrências');
  const { session } = useAdminAuth();
  const isAttendant = session?.user.role === 'Atendente';
  const { data } = useAppData();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<OccurrenceFilterOptions>(() => initialParams(params));
  const [draft, setDraft] = useState<OccurrenceFilterOptions>(() => initialParams(params));
  const [items, setItems] = useState<Occurrence[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newData, setNewData] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; displayName: string }>>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (draft.protocol?.trim()) count++;
    if (draft.keyword?.trim()) count++;
    if (draft.startDate) count++;
    if (draft.endDate) count++;
    if (draft.closedStartDate) count++;
    if (draft.closedEndDate) count++;
    if (draft.category) count++;
    if (draft.status && draft.status !== 'TODAS') count++;
    if (draft.priority && draft.priority !== 'TODAS') count++;
    if (draft.areaId) count++;
    if (draft.environmentId) count++;
    if (draft.assignedTeamId) count++;
    if (draft.assignedToAdminUserId) count++;
    if (draft.immediateRisk) count++;
    if (draft.slaStatus) count++;
    if (draft.dataClassification) count++;
    if (draft.withoutTeam) count++;
    if (draft.withoutResponsible) count++;
    if (draft.withPhoto) count++;
    if (draft.withoutPhoto) count++;
    if (draft.reopened) count++;
    return count;
  }, [draft]);

  useEffect(() => {
    if (isAttendant) {
      operationsService.listTeams()
        .then((teamItems) => { setTeams(teamItems.filter((item) => item.active)); })
        .catch(() => undefined);
      return;
    }
    Promise.all([operationsService.listTeams(), adminService.listAssignees()])
      .then(([teamItems, people]) => { setTeams(teamItems.filter((item) => item.active)); setAssignees(people); })
      .catch(() => undefined);
  }, [isAttendant]);

  const load = useCallback(async (input = filters): Promise<void> => {
    setLoading(true);
    try {
      const response = await occurrenceService.list(input);
      setItems(response.items); setNextCursor(response.nextCursor); setError(null); setNewData(false);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await occurrenceService.list(filters);
        if (active) {
          setItems(response.items);
          setNextCursor(response.nextCursor);
          setError(null);
          setNewData(false);
        }
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filters]);

  useEffect(() => startNonDestructivePolling(async () => {
    const response = await occurrenceService.list(filters);
    const incoming = response.items.map((item) => `${item.id}:${item.version}`).join('|');
    const current = items.map((item) => `${item.id}:${item.version}`).join('|');
    return incoming !== current;
  }, () => setNewData(true)), [filters, items]);

  const categories = data?.categories ?? [];
  const areas = useMemo(() => data?.locations[0]?.buildings.filter((item) => item.active !== false) ?? [], [data]);
  const selectedArea = areas.find((item) => item.id === draft.areaId);
  const rooms = selectedArea?.floors[0]?.rooms.filter((item) => item.active !== false) ?? [];

  const submit = (event: FormEvent): void => {
    event.preventDefault(); setCursorStack([]); setFilters({ ...cleanFilters(draft), cursor: undefined });
  };
  const next = (): void => { if (nextCursor) { setCursorStack((stack) => [...stack, filters.cursor]); setFilters({ ...filters, cursor: nextCursor }); } };
  const previous = (): void => { const prior = cursorStack.at(-1); setCursorStack((stack) => stack.slice(0, -1)); setFilters({ ...filters, cursor: prior }); };
  const exportFile = async (format: 'csv' | 'xlsx' | 'pdf'): Promise<void> => {
    try {
      const response = await operationsService.exportOccurrences(format, { ...filters, cursor: undefined });
      const url = URL.createObjectURL(response.blob); const link = document.createElement('a'); link.href = url;
      link.download = `olhos-do-campus-ocorrencias.${format}`; link.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(getErrorMessage(caught)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Ocorrências</h1>
          <p className="mt-1 text-sm text-slate-700">
            {isAttendant ? 'Visualizando exclusivamente ocorrências sob sua responsabilidade.' : 'Consulta operacional de ocorrências. Padrão: 25 registros por página.'}
          </p>
        </div>
        <button className="btn-secondary" type="button" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Atualizar
        </button>
      </div>

      {newData && (
        <StatusAlert>
          Há novas informações disponíveis. <button className="font-semibold underline" onClick={() => void load()}>Atualizar agora</button>
        </StatusAlert>
      )}

      <div className="flex flex-col gap-2 sm:hidden">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="admin-occurrence-filters"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="btn-secondary flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-green-800 px-2 py-0.5 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
          <span className="text-xs font-normal text-slate-600">
            {filtersOpen ? 'Recolher filtros' : 'Expandir filtros'}
          </span>
        </button>
        {activeFilterCount > 0 && !filtersOpen && (
          <div className="flex items-center justify-between px-1 text-xs text-slate-700">
            <span>{activeFilterCount} filtro(s) ativo(s)</span>
            <button
              type="button"
              className="font-semibold text-green-800 underline"
              onClick={() => {
                const clean: OccurrenceFilterOptions = { pageSize: 25, sort: 'operational' };
                setDraft(clean);
                setCursorStack([]);
                setFilters(clean);
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      <form
        id="admin-occurrence-filters"
        onSubmit={submit}
        className={`border border-slate-300 bg-slate-50 p-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 ${filtersOpen ? 'grid' : 'hidden'}`}
      >
        <div><label className="form-label" htmlFor="f-protocol">Protocolo</label><input id="f-protocol" className="form-control" value={draft.protocol ?? ''} onChange={(e) => setDraft({ ...draft, protocol: e.target.value })} /></div>
        <div><label className="form-label" htmlFor="f-keyword">Palavra-chave</label><input id="f-keyword" className="form-control" value={draft.keyword ?? ''} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} /><p className="mt-1 text-xs text-slate-600">Busca por palavras-chave principais no título e descrição.</p></div>
        <div><label className="form-label" htmlFor="f-open-from">Abertura — de</label><input id="f-open-from" type="date" className="form-control" value={draft.startDate ?? ''} onChange={(e) => setDraft({ ...draft, startDate: e.target.value || undefined })} /></div>
        <div><label className="form-label" htmlFor="f-open-to">Abertura — até</label><input id="f-open-to" type="date" className="form-control" value={draft.endDate ?? ''} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || undefined })} /></div>
        <div><label className="form-label" htmlFor="f-close-from">Encerramento — de</label><input id="f-close-from" type="date" className="form-control" value={draft.closedStartDate ?? ''} onChange={(e) => setDraft({ ...draft, closedStartDate: e.target.value || undefined })} /></div>
        <div><label className="form-label" htmlFor="f-close-to">Encerramento — até</label><input id="f-close-to" type="date" className="form-control" value={draft.closedEndDate ?? ''} onChange={(e) => setDraft({ ...draft, closedEndDate: e.target.value || undefined })} /></div>
        <div><label className="form-label" htmlFor="f-category">Categoria</label><select id="f-category" className="form-control" value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value || undefined })}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div><label className="form-label" htmlFor="f-status">Situação</label><select id="f-status" className="form-control" value={draft.status ?? 'TODAS'} onChange={(e) => setDraft({ ...draft, status: e.target.value as OccurrenceFilterOptions['status'] })}><option value="TODAS">Todas</option>{OCCURRENCE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div><label className="form-label" htmlFor="f-priority">Prioridade</label><select id="f-priority" className="form-control" value={draft.priority ?? 'TODAS'} onChange={(e) => setDraft({ ...draft, priority: e.target.value as OccurrenceFilterOptions['priority'] })}><option value="TODAS">Todas</option>{OCCURRENCE_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div><label className="form-label" htmlFor="f-area">Bloco/Área</label><select id="f-area" className="form-control" value={draft.areaId ?? ''} onChange={(e) => setDraft({ ...draft, areaId: e.target.value || undefined, environmentId: undefined })}><option value="">Todos</option>{areas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div><label className="form-label" htmlFor="f-room">Ambiente</label><select id="f-room" className="form-control" value={draft.environmentId ?? ''} onChange={(e) => setDraft({ ...draft, environmentId: e.target.value || undefined })}><option value="">Todos</option>{rooms.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div><label className="form-label" htmlFor="f-team">Equipe</label><select id="f-team" className="form-control" value={draft.assignedTeamId ?? ''} onChange={(e) => setDraft({ ...draft, assignedTeamId: e.target.value || undefined })}><option value="">Todas</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        {!isAttendant && <div><label className="form-label" htmlFor="f-person">Responsável</label><select id="f-person" className="form-control" value={draft.assignedToAdminUserId ?? ''} onChange={(e) => setDraft({ ...draft, assignedToAdminUserId: e.target.value || undefined })}><option value="">Todos</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div>}
        <div><label className="form-label" htmlFor="f-risk">Risco imediato</label><select id="f-risk" className="form-control" value={draft.immediateRisk ?? ''} onChange={(e) => setDraft({ ...draft, immediateRisk: (e.target.value || undefined) as 'true' | 'false' | undefined })}><option value="">Todos</option><option value="true">Informado</option><option value="false">Não informado</option></select></div>
        <div><label className="form-label" htmlFor="f-sla">SLA</label><select id="f-sla" className="form-control" value={draft.slaStatus ?? ''} onChange={(e) => setDraft({ ...draft, slaStatus: (e.target.value || undefined) as OccurrenceFilterOptions['slaStatus'] })}><option value="">Todos</option><option value="ON_TIME">Dentro do prazo</option><option value="NEAR_DUE">Próximo do vencimento</option><option value="BREACHED">Vencido</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Concluído</option></select></div>
        <div><label className="form-label" htmlFor="f-classification">Natureza do registro</label><select id="f-classification" className="form-control" value={draft.dataClassification ?? ''} onChange={(e) => setDraft({ ...draft, dataClassification: (e.target.value || undefined) as 'REAL' | 'TEST' | undefined })}><option value="">REAL e TEST</option><option value="REAL">REAL</option><option value="TEST">TEST</option></select></div>
        <div><label className="form-label" htmlFor="f-sort">Ordenação</label><select id="f-sort" className="form-control" value={draft.sort ?? 'operational'} onChange={(e) => setDraft({ ...draft, sort: e.target.value as OccurrenceSort })}><option value="operational">Operacional: prioridade, SLA, antiguidade</option><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="priority">Prioridade</option><option value="sla">SLA</option><option value="protocol">Protocolo</option></select></div>
        <div><label className="form-label" htmlFor="f-size">Registros por página</label><select id="f-size" className="form-control" value={draft.pageSize ?? 25} onChange={(e) => setDraft({ ...draft, pageSize: Number(e.target.value) as 25 | 50 | 100 })}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></div>
        <fieldset className="sm:col-span-2 lg:col-span-4"><legend className="form-label">Características adicionais</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{!isAttendant && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.withoutTeam ?? false} onChange={(e) => setDraft({ ...draft, withoutTeam: e.target.checked || undefined })} />Sem equipe</label>}{!isAttendant && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.withoutResponsible ?? false} onChange={(e) => setDraft({ ...draft, withoutResponsible: e.target.checked || undefined })} />Sem responsável</label>}<label className="flex items-center gap-2"><input type="checkbox" checked={draft.withPhoto ?? false} onChange={(e) => setDraft({ ...draft, withPhoto: e.target.checked || undefined, withoutPhoto: e.target.checked ? undefined : draft.withoutPhoto })} />Com fotografia</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.withoutPhoto ?? false} onChange={(e) => setDraft({ ...draft, withoutPhoto: e.target.checked || undefined, withPhoto: e.target.checked ? undefined : draft.withPhoto })} />Sem fotografia</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.reopened ?? false} onChange={(e) => setDraft({ ...draft, reopened: e.target.checked || undefined })} />Reaberta</label></div></fieldset>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2"><button className="btn-primary"><Search className="h-4 w-4" aria-hidden="true" />Aplicar filtros</button><button className="btn-secondary" type="button" onClick={() => { const clean: OccurrenceFilterOptions = { pageSize: 25, sort: 'operational' }; setDraft(clean); setCursorStack([]); setFilters(clean); }}>Limpar</button>{!isAttendant && <span className="ml-auto flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={() => void exportFile('csv')}><Download className="h-4 w-4" aria-hidden="true" />CSV</button><button className="btn-secondary" type="button" onClick={() => void exportFile('xlsx')}>XLSX</button><button className="btn-secondary" type="button" onClick={() => void exportFile('pdf')}>PDF</button></span>}</div>
      </form>

      {error && <StatusAlert tone="error">{error}</StatusAlert>}
      {loading ? (
        <LoadingState label="Carregando ocorrências..." />
      ) : (
        <>
          <p className="text-sm text-slate-600" role="status">{items.length} registro(s) carregado(s) nesta página.</p>
          
          {/* Visualização mobile em cartões */}
          <div className="space-y-3 sm:hidden" aria-label="Lista de ocorrências em cartões">
            {items.map((item) => (
              <article key={item.id} className="space-y-3 border border-slate-300 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <Link className="font-mono text-lg font-bold text-green-800 hover:underline" to={ROUTES.adminOccurrence(item.id)}>
                      {`Protocolo ${item.protocol}`}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">{item.dataClassification === 'TEST' && (
                    <span className="border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">TEST</span>
                  )}{item.attachedToProtocol && <span className="border border-slate-400 bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800">APENSADA</span>}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge status={item.status} />
                  <PriorityBadge priority={item.priority} />
                  {item.slaStatus && (
                    <span className="inline-flex border border-slate-400 px-2 py-0.5 text-xs font-semibold">
                      SLA: {item.slaStatus}
                    </span>
                  )}
                </div>
                <dl className="grid gap-2 text-sm text-slate-700">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Categoria</dt>
                    <dd className="font-medium text-slate-900">{item.categoryName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Local</dt>
                    <dd>{[item.location.buildingName, item.location.room].filter(Boolean).join(' — ') || 'Não especificado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Encaminhamento</dt>
                    <dd>{item.assignedTeamNameSnapshot ?? 'Sem equipe'}{item.assignedToDisplayNameSnapshot ? ` — ${item.assignedToDisplayNameSnapshot}` : ''}</dd>
                  </div>
                </dl>
                <div className="pt-1">
                  <Link
                    to={ROUTES.adminOccurrence(item.id)}
                    className="btn-secondary w-full text-center"
                    aria-label={`Ver detalhamento da ocorrência ${item.protocol}`}
                  >
                    Ver detalhamento
                  </Link>
                </div>
              </article>
            ))}
            {items.length === 0 && (
              <p className="border border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                Nenhuma ocorrência corresponde aos filtros.
              </p>
            )}
          </div>

          {/* Visualização desktop tabular */}
          <div className="hidden sm:block overflow-x-auto border border-slate-300">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3 text-left">Protocolo / abertura</th>
                  <th className="p-3 text-left">Categoria / local</th>
                  <th className="p-3 text-left">Situação</th>
                  <th className="p-3 text-left">Prioridade / SLA</th>
                  <th className="p-3 text-left">Encaminhamento</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="border-t align-top" key={item.id}>
                    <td className="p-3">
                      <Link className="font-mono font-semibold text-green-800 hover:underline" to={ROUTES.adminOccurrence(item.id)}>
                        {item.protocol}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                      {(item.dataClassification === 'TEST' || item.attachedToProtocol) && <div className="mt-1 flex flex-wrap gap-1">{item.dataClassification === 'TEST' && <span className="inline-block border border-amber-400 px-1 text-[11px] font-semibold">TEST</span>}{item.attachedToProtocol && <span className="inline-block border border-slate-400 px-1 text-[11px] font-semibold">APENSADA</span>}</div>}
                    </td>
                    <td className="p-3">
                      <strong>{item.categoryName}</strong>
                      <p className="mt-1 text-xs text-slate-600">{[item.location.buildingName, item.location.room].filter(Boolean).join(' — ')}</p>
                    </td>
                    <td className="p-3"><StatusBadge status={item.status} /></td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <PriorityBadge priority={item.priority} />
                        {item.slaStatus && <span className="inline-flex border border-slate-400 px-2 py-1 text-xs font-semibold">SLA: {item.slaStatus}</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <p>{item.assignedTeamNameSnapshot ?? 'Sem equipe'}</p>
                      <p className="mt-1 text-xs text-slate-600">{item.assignedToDisplayNameSnapshot ?? 'Sem responsável individual'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-6 text-center text-sm text-slate-600">Nenhuma ocorrência corresponde aos filtros.</p>}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button className="btn-secondary" disabled={cursorStack.length === 0} onClick={previous}>Página anterior</button>
            <button className="btn-secondary" disabled={!nextCursor} onClick={next}>Próxima página</button>
          </div>
        </>
      )}
    </div>
  );
}
