import { AdminAuthProvider } from './context/AdminAuthContext';
import { AppDataProvider } from './context/AppDataContext';
import { PublicAuthProvider } from './context/PublicAuthContext';
import { AppRouter } from './routes/AppRouter';

export default function App(): React.JSX.Element {
  return (
    <PublicAuthProvider>
      <AppDataProvider>
        <AdminAuthProvider>
          <AppRouter />
        </AdminAuthProvider>
      </AppDataProvider>
    </PublicAuthProvider>
  );
}
