import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BootstrapData } from '../models/config';
import { configService } from '../services/configService';
import { getErrorMessage } from '../utils/errors';

interface AppDataContextValue {
  data: BootstrapData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setData(await configService.getBootstrap());
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadBootstrap = async (): Promise<void> => {
      try {
        const result = await configService.getBootstrap();
        if (!ignore) {
          setData(result);
          setError(null);
        }
      } catch (caught) {
        if (!ignore) {
          setError(getErrorMessage(caught));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };
    void loadBootstrap();
    return () => {
      ignore = true;
    };
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({ data, loading, error, refresh }),
    [data, error, loading, refresh],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (context === null) {
    throw new Error('useAppData deve ser utilizado dentro de AppDataProvider.');
  }
  return context;
}
