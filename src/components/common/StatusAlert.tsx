import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatusAlertProps {
  tone?: 'info' | 'error' | 'success' | 'warning';
  children: ReactNode;
  id?: string;
}

export function StatusAlert({ tone = 'info', children, id }: StatusAlertProps): React.JSX.Element {
  const styles = {
    info: 'border-slate-300 bg-slate-50 text-slate-800',
    error: 'border-red-300 bg-red-50 text-red-900',
    success: 'border-green-300 bg-green-50 text-green-900',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
  } as const;
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : Info;

  return (
    <div id={id} role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 border p-4 ${styles[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm leading-6">{children}</div>
    </div>
  );
}
