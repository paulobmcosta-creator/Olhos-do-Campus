import { AlertTriangle, CheckCircle2, Clock3, Inbox, Route, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { DashboardStats } from '../../models/occurrence';
import { ROUTES } from '../../config/routes';
import { occurrenceService } from '../../services/occurrenceService';
import { getErrorMessage } from '../../utils/errors';
import { startNonDestructivePolling } from '../../utils/polling';

export function AdminDashboardPage(): React.JSX.Element {
  useDocumentTitle('Painel administrativo');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newData, setNewData] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setStats(await occurrenceService.getStats());
      setNewData(false);
      setError(null);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await occurrenceService.getStats();
        if (active) {
          setStats(result);
          setNewData(false);
          setError(null);
        }
      } catch (caught) {
        if (active) setError(getErrorMessage(caught));
      }
    })();
    const stop = startNonDestructivePolling(async () => {
      const next = await occurrenceService.getStats();
      return stats !== null && JSON.stringify(next) !== JSON.stringify(stats);
    }, () => { if (active) setNewData(true); });
    return () => {
      active = false;
      stop();
    };
  }, [stats]);

  if (error) return <StatusAlert tone="error">{error}</StatusAlert>;
  if (!stats) return <LoadingState label="Calculando filas operacionais..." />;

  const cards = [
    ['Urgentes/Emergenciais', stats.urgentOrEmergency, AlertTriangle, 'criticalPriority=true'],
    ['SLA vencido', stats.slaBreached, Clock3, 'slaStatus=BREACHED'],
    ['Sem encaminhamento', stats.withoutRouting, Route, 'withoutRouting=true'],
    ['Em atendimento', stats.inService, Wrench, 'status=Em+atendimento'],
    ['Aguardando providência', stats.awaitingAction, Inbox, 'awaitingAction=true'],
    ['Resolvidas recentemente', stats.resolvedRecently, CheckCircle2, 'status=Resolvida'],
  ] as const;

  const queues = [
    ['Requerem atenção imediata', stats.urgentOrEmergency, 'criticalPriority=true'],
    ['Sem encaminhamento', stats.withoutRouting, 'withoutRouting=true'],
    ['SLA vencido', stats.slaBreached, 'slaStatus=BREACHED'],
    ['Aguardando providência', stats.awaitingAction, 'awaitingAction=true'],
  ] as const;

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Painel administrativo</h1><p className="mt-2 text-sm text-slate-700">Visão operacional enxuta das filas que exigem decisão ou acompanhamento.</p></div>
    {newData && <StatusAlert>Há novas informações disponíveis. <button className="font-semibold underline" onClick={() => void load()}>Atualizar agora</button></StatusAlert>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value, Icon, query]) => <Link key={label} to={`${ROUTES.adminOccurrences}?${query}`} className="border border-slate-300 bg-white p-4 hover:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-800"><Icon className="h-5 w-5 text-green-800" aria-hidden="true"/><p className="mt-3 text-3xl font-bold">{value}</p><p className="text-sm font-semibold text-slate-700">{label}</p></Link>)}</div>
    <section className="border border-slate-300 bg-white" aria-labelledby="operational-queues"><div className="border-b border-slate-300 bg-slate-50 px-4 py-3"><h2 id="operational-queues" className="font-bold">Filas operacionais</h2><p className="text-sm text-slate-600">Atalhos para as prioridades de acompanhamento cotidiano.</p></div><ul>{queues.map(([label, value, query]) => <li key={label} className="border-b border-slate-200 last:border-b-0"><Link className="flex items-center justify-between gap-4 px-4 py-3 font-semibold text-green-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-800" to={`${ROUTES.adminOccurrences}?${query}`}><span>{label}</span><span aria-label={`${value} ocorrência(s)`}>{value}</span></Link></li>)}</ul></section>
    <div className="border border-slate-300 bg-slate-50 p-4"><strong>Novas hoje:</strong> {stats.receivedToday}. <Link className="ml-2 font-semibold text-green-800 underline" to={ROUTES.adminAnalytics}>Abrir indicadores</Link></div>
  </div>;
}
