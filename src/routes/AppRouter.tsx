import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { RootLayout } from '../layouts/RootLayout';
import { HomePage } from '../pages/HomePage';
import { NewOccurrencePage } from '../pages/NewOccurrencePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { TrackingPage } from '../pages/TrackingPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminLoginPage } from '../pages/admin/AdminLoginPage';
import { AdminOccurrenceDetailPage } from '../pages/admin/AdminOccurrenceDetailPage';
import { AdminOccurrencesPage } from '../pages/admin/AdminOccurrencesPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';
import { AdminTeamsPage } from '../pages/admin/AdminTeamsPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AuthorizedAdminRoute } from './AuthorizedAdminRoute';

export function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="ocorrencias/nova" element={<NewOccurrencePage />} />
        <Route path="ocorrencias/acompanhar" element={<TrackingPage />} />
        <Route path="administracao/entrar" element={<AdminLoginPage />} />
        <Route element={<AuthorizedAdminRoute />}>
          <Route path="administracao" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="ocorrencias" element={<AdminOccurrencesPage />} />
            <Route path="ocorrencias/:id" element={<AdminOccurrenceDetailPage />} />
            <Route path="indicadores" element={<AdminAnalyticsPage />} />
            <Route element={<AuthorizedAdminRoute allowedRoles={['Administrador']} />}>
              <Route path="usuarios" element={<AdminUsersPage />} />
              <Route path="equipes" element={<AdminTeamsPage />} />
              <Route path="auditoria" element={<AdminAuditPage />} />
              <Route path="configuracoes" element={<AdminSettingsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function AppRouter(): React.JSX.Element {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
