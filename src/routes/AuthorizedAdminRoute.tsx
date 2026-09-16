import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/common/LoadingState';
import { StatusAlert } from '../components/common/StatusAlert';
import { ROUTES } from '../config/routes';
import { useAdminAuth } from '../context/AdminAuthContext';
import type { AdminRole } from '../models/admin';

interface AuthorizedAdminRouteProps {
  allowedRoles?: readonly AdminRole[];
}

export function AuthorizedAdminRoute({ allowedRoles }: AuthorizedAdminRouteProps): React.JSX.Element {
  const { session, status } = useAdminAuth();
  const location = useLocation();

  if (status === 'initializing' || status === 'signing-in' || status === 'authorizing') {
    return <LoadingState label="Validando autenticação e autorização institucional..." />;
  }

  if (status !== 'authorized' || session === null) {
    return <Navigate to={ROUTES.adminLogin} replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles !== undefined && !allowedRoles.includes(session.user.role)) {
    return (
      <StatusAlert tone="error">
        Seu papel institucional não possui permissão para acessar esta área.
      </StatusAlert>
    );
  }

  return <Outlet />;
}
