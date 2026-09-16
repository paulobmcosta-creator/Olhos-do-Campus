import { LogIn, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { BrandImage } from '../../components/common/BrandImage';
import { LoadingState } from '../../components/common/LoadingState';
import { StatusAlert } from '../../components/common/StatusAlert';
import { BRANDING } from '../../config/branding';
import { FIREBASE_ENV } from '../../config/firebaseEnvironment';
import { ROUTES } from '../../config/routes';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

interface LoginLocationState {
  from?: string;
}

function readLoginState(value: unknown): LoginLocationState {
  if (typeof value === 'object' && value !== null && 'from' in value && typeof value.from === 'string') {
    return { from: value.from };
  }
  return {};
}

export function AdminLoginPage(): React.JSX.Element {
  useDocumentTitle('Entrada da área administrativa');
  const { status, error, login, logout, retryAuthorization, session } = useAdminAuth();
  const location = useLocation();
  const state = readLoginState(location.state);

  if (status === 'authorized' && session !== null) {
    return <Navigate to={state.from ?? ROUTES.adminHome} replace />;
  }

  const busy = status === 'initializing' || status === 'signing-in' || status === 'authorizing';

  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden border border-slate-300 bg-white lg:grid-cols-[340px_1fr]">
      <div className="hidden items-center justify-center border-r border-slate-300 bg-slate-50 p-8 lg:flex">
        <BrandImage orientation="vertical" className="w-full max-w-64" />
      </div>
      <div className="p-5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{BRANDING.publicName}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Entrada da área administrativa</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Entre com a conta Google previamente autorizada pela instituição. A autenticação não utiliza senha própria do sistema.
        </p>

        <div className="mt-6 space-y-4">
          <StatusAlert>
            <strong>Autenticação e autorização reais.</strong> O domínio permitido é apenas uma condição inicial; o e-mail também precisa constar como ativo no cadastro administrativo do Firestore.
          </StatusAlert>
          {FIREBASE_ENV.useEmulators && (
            <StatusAlert>
              Ambiente local conectado ao Firebase Emulator Suite. Este indicador não representa validação no projeto Firebase em nuvem.
            </StatusAlert>
          )}
          {status === 'denied' && (
            <StatusAlert tone="error">
              <strong>Acesso não autorizado.</strong> {error ?? 'A conta Google foi autenticada, mas não possui autorização administrativa ativa.'}
            </StatusAlert>
          )}
          {status === 'error' && (
            <StatusAlert tone="error">
              {error ?? 'Não foi possível concluir a autenticação administrativa.'}
            </StatusAlert>
          )}
        </div>

        {busy ? (
          <div className="mt-6"><LoadingState label="Validando acesso institucional..." /></div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-3">
            {status === 'signed-out' || status === 'error' ? (
              <button type="button" className="btn-primary" onClick={() => void login()}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> Entrar com Google
              </button>
            ) : null}
            {status === 'denied' ? (
              <>
                <button type="button" className="btn-secondary" onClick={() => void retryAuthorization()}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Verificar novamente
                </button>
                <button type="button" className="btn-secondary" onClick={() => void logout()}>
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Sair e usar outra conta
                </button>
              </>
            ) : null}
          </div>
        )}

        <div className="mt-8 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-700">
          <p className="flex items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-green-800" aria-hidden="true" />A autorização prévia não cria uma conta Google e não envia convite por e-mail nesta versão.</p>
        </div>
      </div>
    </div>
  );
}
