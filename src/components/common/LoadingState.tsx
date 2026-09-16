import { LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Carregando informações...' }: { label?: string }): React.JSX.Element {
  return (
    <div role="status" className="flex min-h-52 flex-col items-center justify-center gap-3 text-slate-700">
      <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
