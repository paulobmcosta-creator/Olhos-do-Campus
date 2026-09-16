import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFoundPage(): React.JSX.Element {
  useDocumentTitle('Página não encontrada');
  return (
    <div className="mx-auto max-w-2xl border border-slate-300 bg-slate-50 p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Erro 404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Página não encontrada</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">O endereço informado não corresponde a uma rota disponível no sistema.</p>
      <Link to={ROUTES.home} className="btn-primary mt-6"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar à página inicial</Link>
    </div>
  );
}
