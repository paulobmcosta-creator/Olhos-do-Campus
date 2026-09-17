import { BarChart3, Gauge, LayoutDashboard, ListChecks, LogOut, Menu, ScrollText, Settings, UserCog, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { useAdminAuth } from '../context/AdminAuthContext';

export function AdminLayout(): React.JSX.Element {
  const { session, logout } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdministrator = session?.user.role === 'Administrador';
  const isAttendant = session?.user.role === 'Atendente';

  const links = [
    { to: ROUTES.adminHome, label: 'Painel', icon: LayoutDashboard, end: true, visible: true },
    { to: ROUTES.adminOccurrences, label: 'Ocorrências', icon: ListChecks, end: false, visible: true },
    { to: ROUTES.adminAnalytics, label: 'Indicadores', icon: BarChart3, end: false, visible: !isAttendant },
    { to: ROUTES.adminUsers, label: 'Usuários', icon: UserCog, end: false, visible: isAdministrator },
    { to: ROUTES.adminTeams, label: 'Equipes/Setores', icon: UsersRound, end: false, visible: isAdministrator },
    { to: ROUTES.adminAudit, label: 'Auditoria', icon: ScrollText, end: false, visible: isAdministrator },
    { to: ROUTES.adminInfrastructure, label: 'Infraestrutura e capacidade', icon: Gauge, end: false, visible: isAdministrator },
    { to: ROUTES.adminSettings, label: 'Configurações', icon: Settings, end: false, visible: isAdministrator },
  ] as const;

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <div className="space-y-6">
      <div className="border border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Área administrativa institucional</p>
            <p className="font-semibold text-slate-900">{session?.user.displayName}</p>
            <p className="text-sm text-slate-600">{session?.user.role}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="max-w-xl text-xs leading-5 text-slate-600">
              {isAdministrator
                ? 'Administrador: gestão do sistema e das ocorrências.'
                : isAttendant
                  ? 'Atendente: execução e atendimento das ocorrências atribuídas.'
                  : 'Gestor: gestão operacional das ocorrências.'}
            </p>
            <button type="button" className="btn-secondary self-start sm:self-auto" onClick={() => void logout()}><LogOut className="h-4 w-4" aria-hidden="true" /> Sair</button>
          </div>
        </div>
      </div>
      <a href="#admin-main-content" className="sr-only focus:not-sr-only focus:inline-block focus:p-2 focus:bg-green-800 focus:text-white focus:font-bold focus:outline-none focus:ring-2 focus:ring-offset-2">
        Pular navegação administrativa
      </a>

      {/* Navegação mobile e tablet (< lg) */}
      <div className="space-y-2 lg:hidden">
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="admin-navigation-menu"
          aria-label="Menu de navegação administrativa"
          onClick={() => setMenuOpen((open) => !open)}
          className="btn-secondary flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-2">
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            <span>Menu de navegação</span>
          </span>
          <span className="text-xs font-normal text-slate-600">
            {menuOpen ? 'Fechar menu' : 'Abrir opções'}
          </span>
        </button>

        {menuOpen && (
          <nav
            id="admin-navigation-menu"
            aria-label="Menu administrativo expandido"
            className="space-y-1 rounded border border-slate-300 bg-white p-2 shadow-sm"
          >
            {links.filter((item) => item.visible).map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-l-4 border-green-800 bg-green-50 text-green-900 font-bold'
                    : 'border-l-4 border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {/* Navegação desktop (>= lg) */}
      <nav aria-label="Navegação administrativa" className="hidden lg:flex gap-1 overflow-x-auto border-b border-slate-300">
        {links.filter((item) => item.visible).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${isActive ? 'border-green-800 text-green-900' : 'border-transparent text-slate-600 hover:border-slate-400 hover:text-slate-900'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>

      <div id="admin-main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </div>
    </div>
  );
}
