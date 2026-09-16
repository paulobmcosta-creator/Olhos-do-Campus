import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ensureAnonymousSession, observePublicUser } from '../auth/publicAuth';
import { getErrorMessage } from '../utils/errors';

interface PublicAuthContextValue {
  ready: boolean;
  error: string | null;
}

const PublicAuthContext = createContext<PublicAuthContextValue | null>(null);

export function PublicAuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;
    void observePublicUser((user) => {
      if (!active) return;
      if (user?.isAnonymous === true) {
        setReady(true);
        setError(null);
      }
    }).then((nextUnsubscribe) => {
      unsubscribe = nextUnsubscribe;
      return ensureAnonymousSession();
    }).catch((caught: unknown) => {
      if (active) setError(getErrorMessage(caught));
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(() => ({ ready, error }), [error, ready]);
  return <PublicAuthContext.Provider value={value}>{children}</PublicAuthContext.Provider>;
}

export function usePublicAuth(): PublicAuthContextValue {
  const context = useContext(PublicAuthContext);
  if (context === null) throw new Error('usePublicAuth deve ser usado dentro de PublicAuthProvider.');
  return context;
}
