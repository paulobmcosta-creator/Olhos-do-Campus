import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BRANDING } from '../../config/branding';
import { ROUTES } from '../../config/routes';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { BrandImage } from './BrandImage';

const navigation = [
  { to: ROUTES.newOccurrence, label: 'Registrar problema de infraestrutura' },
  { to: ROUTES.trackOccurrence, label: 'Acompanhar uma ocorrência' },
  { to: ROUTES.adminLogin, label: 'Área administrativa' },
] as const;

export function Header(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, logout } = useAdminAuth();

  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to={ROUTES.home} className="min-w-0 shrink focus-visible:outline-offset-4" aria-label="Página inicial do Olhos do Campus">
            <div className="flex min-w-0 items-center gap-4">
              <BrandImage orientation="horizontal" className="w-36 shrink-0 sm:w-48 lg:w-72" />
              <div className="hidden min-w-0 border-l border-slate-300 pl-4 sm:block">
                <p className="truncate text-lg font-bold text-slate-900 sm:text-xl">{BRANDING.publicName}</p>
                <p className="hidden max-w-md text-xs leading-5 text-slate-600 sm:block">{BRANDING.officialName}</p>
              </div>
            </div>
          </Link>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-slate-300 bg-white text-slate-800 lg:hidden"
            aria-label={menuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-green-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {session !== null && (
              <button
                type="button"
                onClick={() => void logout()}
                className="ml-2 inline-flex min-h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair
              </button>
            )}
          </nav>
        </div>

        {menuOpen && (
          <nav aria-label="Navegação principal móvel" className="mt-3 border-t border-slate-200 pt-3 lg:hidden">
            <div className="grid gap-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `min-h-11 px-3 py-3 text-sm font-medium ${
                      isActive ? 'bg-green-800 text-white' : 'text-slate-800 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {session !== null && (
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                    setMenuOpen(false);
                  }}
                  className="min-h-11 px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  Encerrar sessão administrativa
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
