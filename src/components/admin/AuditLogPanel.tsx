import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AuditLog } from '../../models/admin';
import { adminService } from '../../services/adminService';
import { formatDateTime } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { LoadingState } from '../common/LoadingState';
import { StatusAlert } from '../common/StatusAlert';

export function AuditLogPanel(): React.JSX.Element {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await adminService.listAuditLogs(100));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <section className="space-y-4 border border-slate-300 p-5" aria-labelledby="audit-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="audit-title" className="text-xl font-bold text-slate-950">Auditoria de autenticação e acessos</h2>
          <p className="mt-2 text-sm text-slate-700">Últimos eventos de autorização e gestão de usuários, limitados a 100 registros.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar auditoria
        </button>
      </div>
      {error !== null && <StatusAlert tone="error">{error}</StatusAlert>}
      {loading ? <LoadingState label="Carregando auditoria..." /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead><tr className="border-b-2 border-slate-300 bg-slate-50"><th className="p-3">Data</th><th className="p-3">Evento</th><th className="p-3">Ator</th><th className="p-3">Resumo</th></tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-200 align-top">
                  <td className="whitespace-nowrap p-3">{formatDateTime(log.timestamp)}</td>
                  <td className="p-3 font-mono text-xs">{log.eventType}</td>
                  <td className="p-3">{log.actorEmail ?? 'Sistema'}{log.actorRole ? ` — ${log.actorRole}` : ''}</td>
                  <td className="p-3">{log.summary}<span className="mt-1 block text-xs text-slate-500">Correlação: {log.requestCorrelationId ?? 'não informada'}</span></td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="p-5 text-center text-slate-600">Nenhum evento de auditoria registrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
