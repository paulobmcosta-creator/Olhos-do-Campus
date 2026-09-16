import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { useAppData } from '../../context/AppDataContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { OCCURRENCE_PRIORITIES, OCCURRENCE_STATUSES } from '../../models/occurrence';
import type { AnalyticsFilters, AnalyticsStats, OperationalTeam } from '../../models/operations';
import type { AdminAssignee } from '../../models/admin';
import { adminService } from '../../services/adminService';
import { operationsService } from '../../services/operationsService';
import { getErrorMessage } from '../../utils/errors';

function n(value: number | null, unit = ''): string { return value === null ? 'Indisponível' : `${value.toFixed(1)}${unit}`; }
function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }

export function AdminAnalyticsPage(): React.JSX.Element {
  useDocumentTitle('Indicadores');
  const { data: appData } = useAppData();
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [data, setData] = useState<AnalyticsStats | null>(null);
  const [teams, setTeams] = useState<OperationalTeam[]>([]);
  const [assignees, setAssignees] = useState<AdminAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const areas = useMemo(() => appData?.locations[0]?.buildings.filter((item) => item.active !== false) ?? [], [appData]);
  const selectedArea = areas.find((item) => item.id === filters.areaId);
  const environments = selectedArea?.floors[0]?.rooms.filter((item) => item.active !== false) ?? [];

  const load = async (input = filters): Promise<void> => {
    setLoading(true);
    try { setData(await operationsService.analytics(input)); setError(null); }
    catch (caught) { setError(getErrorMessage(caught)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([operationsService.listTeams(), adminService.listAssignees()]).then(([teamItems, people]) => {
      if (active) { setTeams(teamItems); setAssignees(people); }
    }).catch(() => undefined);

    void (async () => {
      try {
        const analyticsData = await operationsService.analytics({});
        if (active) { setData(analyticsData); setError(null); }
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const shortcut = (days: number): void => {
    const now = new Date();
    const endDate = isoDate(now);
    const startDate = days === -1 ? `${now.getFullYear()}-01-01` : isoDate(new Date(now.getTime() - days * 86_400_000));
    const next = { ...filters, startDate, endDate };
    setFilters(next); void load(next);
  };

  if (loading && !data) return <LoadingState label="Calculando indicadores..." />;

  const distributions: Array<[string, AnalyticsStats['byCategory']]> = data ? [
    ['Por categoria', data.byCategory], ['Por situação', data.byStatus], ['Por prioridade', data.byPriority],
    ['Por Bloco/Área', data.byArea], ['Por equipe', data.byTeam], ['Por responsável', data.byResponsible],
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-bold">Indicadores</h1><p className="mt-1 text-sm text-slate-700">Período padrão: últimos 30 dias. Tempo total e tempo efetivo de SLA são métricas distintas.</p></div><button className="btn-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Atualizar</button></div>
      <section className="space-y-4 border border-slate-300 bg-slate-50 p-4" aria-labelledby="analytics-filters"><h2 id="analytics-filters" className="font-bold">Filtros analíticos</h2><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => shortcut(0)}>Hoje</button><button className="btn-secondary" onClick={() => shortcut(6)}>7 dias</button><button className="btn-secondary" onClick={() => shortcut(29)}>30 dias</button><button className="btn-secondary" onClick={() => shortcut(89)}>90 dias</button><button className="btn-secondary" onClick={() => shortcut(-1)}>Ano atual</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="form-label" htmlFor="a-from">De</label><input id="a-from" className="form-control" type="date" value={filters.startDate ?? ''} onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })} /></div>
          <div><label className="form-label" htmlFor="a-to">Até</label><input id="a-to" className="form-control" type="date" value={filters.endDate ?? ''} onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })} /></div>
          <div><label className="form-label" htmlFor="a-category">Categoria</label><select id="a-category" className="form-control" value={filters.categoryId ?? ''} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || undefined })}><option value="">Todas</option>{appData?.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label className="form-label" htmlFor="a-priority">Prioridade</label><select id="a-priority" className="form-control" value={filters.priority ?? ''} onChange={(e) => setFilters({ ...filters, priority: (e.target.value || undefined) as AnalyticsFilters['priority'] })}><option value="">Todas</option>{OCCURRENCE_PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label className="form-label" htmlFor="a-status">Situação</label><select id="a-status" className="form-control" value={filters.status ?? ''} onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as AnalyticsFilters['status'] })}><option value="">Todas</option>{OCCURRENCE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div><label className="form-label" htmlFor="a-area">Bloco/Área</label><select id="a-area" className="form-control" value={filters.areaId ?? ''} onChange={(e) => setFilters({ ...filters, areaId: e.target.value || undefined, environmentId: undefined })}><option value="">Todos</option>{areas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label className="form-label" htmlFor="a-env">Ambiente</label><select id="a-env" className="form-control" value={filters.environmentId ?? ''} onChange={(e) => setFilters({ ...filters, environmentId: e.target.value || undefined })}><option value="">Todos</option>{environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label className="form-label" htmlFor="a-team">Equipe</label><select id="a-team" className="form-control" value={filters.teamId ?? ''} onChange={(e) => setFilters({ ...filters, teamId: e.target.value || undefined })}><option value="">Todas</option>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div><label className="form-label" htmlFor="a-person">Responsável</label><select id="a-person" className="form-control" value={filters.responsibleId ?? ''} onChange={(e) => setFilters({ ...filters, responsibleId: e.target.value || undefined })}><option value="">Todos</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div>
        </div><button className="btn-primary" onClick={() => void load()}>Aplicar filtros</button>
      </section>
      {error && <StatusAlert tone="error">{error}</StatusAlert>}
      {loading && data && <p className="text-sm text-slate-600" role="status">Atualizando indicadores...</p>}
      {data && <>
        <p className="text-sm text-slate-600">Período efetivamente consultado: {data.period.start} a {data.period.end}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ['Abertas atualmente', data.openNow], ['Criadas no período', data.createdInPeriod], ['Urgentes/Emergenciais', data.urgentOrEmergency], ['SLA vencido', data.slaBreached], ['Sem equipe', data.withoutTeam], ['Sem responsável', data.withoutResponsible], ['Resolvidas', data.resolvedInPeriod], ['Encerradas', data.closedInPeriod], ['Reaberturas', data.reopenedInPeriod],
        ].map(([label, value]) => <article className="border border-slate-300 p-4" key={String(label)}><p className="text-2xl font-bold">{value}</p><p className="text-sm text-slate-600">{label}</p></article>)}</div>
        <section className="border border-slate-300 p-5"><h2 className="text-lg font-bold">Tempos e cumprimento de SLA</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div><dt className="detail-term">Primeira resposta — média</dt><dd className="detail-value">{n(data.averageFirstResponseBusinessHours, ' h úteis')}</dd></div><div><dt className="detail-term">Primeira resposta — mediana</dt><dd className="detail-value">{n(data.medianFirstResponseBusinessHours, ' h úteis')}</dd></div><div><dt className="detail-term">Primeira resposta no prazo</dt><dd className="detail-value">{n(data.firstResponseOnTimePercent, '%')}</dd></div><div><dt className="detail-term">Tempo total de encerramento — média</dt><dd className="detail-value">{n(data.averageTotalClosureHours, ' h corridas')}</dd></div><div><dt className="detail-term">Tempo total — mediana</dt><dd className="detail-value">{n(data.medianTotalClosureHours, ' h corridas')}</dd></div><div><dt className="detail-term">Conclusão dentro do SLA</dt><dd className="detail-value">{n(data.resolutionOnTimePercent, '%')}</dd></div><div><dt className="detail-term">Tempo efetivo de atendimento — média</dt><dd className="detail-value">{n(data.averageEffectiveBusinessHours, ' h úteis')}</dd></div><div><dt className="detail-term">Tempo efetivo — mediana</dt><dd className="detail-value">{n(data.medianEffectiveBusinessHours, ' h úteis')}</dd></div></dl></section>
        {data.unavailableMetrics.map((message) => <StatusAlert key={message}>{message}</StatusAlert>)}
        <div className="grid gap-4 lg:grid-cols-2">{distributions.map(([title, values]) => <section key={title} className="border border-slate-300 p-4"><h2 className="font-bold">{title}</h2><p className="sr-only">Distribuição textual de {title.toLowerCase()}.</p><ul className="mt-3 space-y-1 text-sm">{values.map((value) => <li key={value.name} className="flex justify-between border-b py-1"><span>{value.name}</span><strong>{value.value}</strong></li>)}</ul></section>)}</div>
      </>}
    </div>
  );
}
