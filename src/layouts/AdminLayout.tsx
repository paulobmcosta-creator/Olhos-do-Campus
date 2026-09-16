import { BarChart3, LayoutDashboard, ListChecks, LogOut, ScrollText, Settings, UserCog, UsersRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { useAdminAuth } from '../context/AdminAuthContext';

export function AdminLayout(): React.JSX.Element {
  const { session, logout } = useAdminAuth();
  const isAdministrator = session?.user.role === 'Administrador';
  const links = [
    { to: ROUTES.adminHome, label: 'Painel', icon: LayoutDashboard, end: true, visible: true },
    { to: ROUTES.adminOccurrences, label: 'Ocorrências', icon: ListChecks, end: false, visible: true },
    { to: ROUTES.adminAnalytics, label: 'Indicadores', icon: BarChart3, end: false, visible: true },
    { to: ROUTES.adminUsers, label: 'Usuários', icon: UserCog, end: false, visible: isAdministrator },
    { to: ROUTES.adminTeams, label: 'Equipes/Setores', icon: UsersRound, end: false, visible: isAdministrator },
    { to: ROUTES.adminAudit, label: 'Auditoria', icon: ScrollText, end: false, visible: isAdministrator },
    { to: ROUTES.adminSettings, label: 'Configurações', icon: Settings, end: false, visible: isAdministrator },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="border border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Área administrativa institucional</p>
            <p className="font-semibold text-slate-900">{session?.user.displayName}</p>
            <p className="text-sm text-slate-600">{session?.user.role}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="max-w-xl text-xs leading-5 text-slate-600">
              {isAdministrator ? 'Administrador: gestão do sistema e das ocorrências.' : 'Gestor: gestão operacional das ocorrências.'}
            </p>
            <button type="button" className="btn-secondary" onClick={() => void logout()}><LogOut className="h-4 w-4" aria-hidden="true" /> Sair</button>
          </div>
        </div>
      </div>
      <nav aria-label="Navegação administrativa" className="flex gap-1 overflow-x-auto border-b border-slate-300">
        {links.filter((item) => item.visible).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${isActive ? 'border-green-800 text-green-900' : 'border-transparent text-slate-600 hover:border-slate-400 hover:text-slate-900'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
