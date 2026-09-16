import { RefreshCw, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AUDIT_EVENT_TYPES, type AuditEventType, type AuditLogFilters, type AuditLogPage, type AuditTargetType } from '../../models/admin';
import { operationsService } from '../../services/operationsService';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';

const TARGETS: Array<{ value: AuditTargetType; label: string }> = [
  { value: 'occurrence', label: 'Ocorrência' }, { value: 'adminUser', label: 'Usuário' }, { value: 'team', label: 'Equipe' },
  { value: 'category', label: 'Categoria' }, { value: 'location', label: 'Local' }, { value: 'sla', label: 'SLA' },
  { value: 'calendar', label: 'Calendário' }, { value: 'systemConfig', label: 'Configuração' }, { value: 'report', label: 'Relatório' },
  { value: 'security', label: 'Segurança' }, { value: 'adminSession', label: 'Sessão' },
];

export function AdminAuditPage(): React.JSX.Element {
  useDocumentTitle('Auditoria global');
  const [page, setPage] = useState<AuditLogPage | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({ limit: 25 });
  const [draft, setDraft] = useState<AuditLogFilters>({ limit: 25 });
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async (input = filters): Promise<void> => { setLoading(true); try { setPage(await operationsService.audit(input)); setError(null); } catch (caught) { setError(getErrorMessage(caught)); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await operationsService.audit({ limit: 25 });
        if (active) { setPage(result); setError(null); }
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);
  const apply = (): void => { const next = { ...draft, cursor: undefined }; setCursorStack([]); setFilters(next); void load(next); };
  const next = (): void => { if (!page?.nextCursor) return; setCursorStack((stack) => [...stack, filters.cursor]); const f = { ...filters, cursor: page.nextCursor }; setFilters(f); void load(f); };
  const previous = (): void => { const cursor = cursorStack.at(-1); setCursorStack((stack) => stack.slice(0, -1)); const f = { ...filters, cursor }; setFilters(f); void load(f); };
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-bold">Auditoria global</h1><p className="mt-1 text-sm text-slate-700">Acesso exclusivo de Administrador. O histórico funcional das ocorrências permanece disponível aos Gestores no detalhe de cada caso.</p></div><button className="btn-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Atualizar</button></div>
    <section className="grid gap-3 border border-slate-300 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros da auditoria">
      <div><label htmlFor="audit-actor" className="form-label">Usuário/e-mail</label><input id="audit-actor" className="form-control" value={draft.actor ?? ''} onChange={(e) => setDraft({ ...draft, actor: e.target.value || undefined })} /></div>
      <div><label htmlFor="audit-action" className="form-label">Tipo de ação</label><select id="audit-action" className="form-control" value={draft.eventType ?? ''} onChange={(e) => setDraft({ ...draft, eventType: (e.target.value || undefined) as AuditEventType | undefined })}><option value="">Todas</option>{AUDIT_EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
      <div><label htmlFor="audit-occurrence" className="form-label">ID/protocolo da ocorrência</label><input id="audit-occurrence" className="form-control" value={draft.occurrenceId ?? ''} onChange={(e) => setDraft({ ...draft, occurrenceId: e.target.value || undefined })} /></div>
      <div><label htmlFor="audit-target" className="form-label">Tipo de alvo</label><select id="audit-target" className="form-control" value={draft.targetType ?? ''} onChange={(e) => setDraft({ ...draft, targetType: (e.target.value || undefined) as AuditTargetType | undefined })}><option value="">Todos</option>{TARGETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
      <div><label htmlFor="audit-target-id" className="form-label">Identificador do alvo</label><input id="audit-target-id" className="form-control" value={draft.targetId ?? ''} onChange={(e) => setDraft({ ...draft, targetId: e.target.value || undefined })} /></div>
      <div><label htmlFor="audit-from" className="form-label">De</label><input id="audit-from" type="date" className="form-control" value={draft.startDate ?? ''} onChange={(e) => setDraft({ ...draft, startDate: e.target.value || undefined })} /></div>
      <div><label htmlFor="audit-to" className="form-label">Até</label><input id="audit-to" type="date" className="form-control" value={draft.endDate ?? ''} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || undefined })} /></div>
      <div><label htmlFor="audit-limit" className="form-label">Registros por página</label><select id="audit-limit" className="form-control" value={draft.limit ?? 25} onChange={(e) => setDraft({ ...draft, limit: Number(e.target.value) as 25 | 50 | 100 })}><option>25</option><option>50</option><option>100</option></select></div>
      <div className="sm:col-span-2 lg:col-span-4 flex gap-2"><button className="btn-primary" onClick={apply}><Search className="h-4 w-4" aria-hidden="true" />Aplicar filtros</button><button className="btn-secondary" onClick={() => { const f: AuditLogFilters = { limit: 25 }; setDraft(f); setFilters(f); setCursorStack([]); void load(f); }}>Limpar</button></div>
    </section>
    {error && <StatusAlert tone="error">{error}</StatusAlert>}
    {loading && !page ? <LoadingState label="Carregando auditoria..." /> : page && <><p className="text-sm text-slate-600" role="status">{page.items.length} evento(s) carregado(s) nesta página.</p><div className="overflow-x-auto border"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Ação</th><th className="p-3 text-left">Usuário</th><th className="p-3 text-left">Alvo</th><th className="p-3 text-left">Resumo</th></tr></thead><tbody>{page.items.map((item) => <tr key={item.id} className="border-t align-top"><td className="p-3 whitespace-nowrap">{formatDateTime(item.timestamp)}</td><td className="p-3 font-mono text-xs">{item.eventType}</td><td className="p-3">{item.actorEmail ?? 'Sistema'}{item.actorRole ? <span className="block text-xs text-slate-500">{item.actorRole}</span> : null}</td><td className="p-3">{item.targetType}{item.targetId ? ` / ${item.targetId}` : ''}</td><td className="p-3">{item.summary}</td></tr>)}</tbody></table></div><div className="flex justify-between"><button className="btn-secondary" disabled={!cursorStack.length} onClick={previous}>Anterior</button><button className="btn-secondary" disabled={!page.nextCursor} onClick={next}>Próxima</button></div></>}
  </div>;
}
