import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  completeAdminRedirect,
  loginWithGoogle,
  logoutAdmin,
  observeAdminUser,
} from '../auth/adminAuth';
import type { AdminSession } from '../models/admin';
import { adminService } from '../services/adminService';
import { getErrorMessage } from '../utils/errors';

export type AdminAuthStatus =
  | 'initializing'
  | 'signed-out'
  | 'signing-in'
  | 'authorizing'
  | 'authorized'
  | 'denied'
  | 'error';

interface AdminAuthContextValue {
  session: AdminSession | null;
  status: AdminAuthStatus;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  retryAuthorization: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<AdminAuthStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const authorizationSequence = useRef(0);

  const authorizeCurrentUser = useCallback(async (): Promise<void> => {
    const sequence = ++authorizationSequence.current;
    setStatus('authorizing');
    setError(null);
    try {
      const nextSession = await adminService.getSession();
      if (sequence !== authorizationSequence.current) return;
      setSession(nextSession);
      setStatus('authorized');
    } catch (caught) {
      if (sequence !== authorizationSequence.current) return;
      setSession(null);
      setStatus('denied');
      setError(getErrorMessage(caught));
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void completeAdminRedirect()
      .catch((caught: unknown) => {
        if (active) {
          setStatus('error');
          setError(getErrorMessage(caught));
        }
      })
      .then(() => observeAdminUser((firebaseUser) => {
        if (!active) return;
        if (firebaseUser === null) {
          authorizationSequence.current += 1;
          setSession(null);
          setError(null);
          setStatus('signed-out');
          return;
        }
        void authorizeCurrentUser();
      }))
      .then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
      })
      .catch((caught: unknown) => {
        if (active) {
          setStatus('error');
          setError(getErrorMessage(caught));
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [authorizeCurrentUser]);

  const login = useCallback(async (): Promise<void> => {
    setStatus('signing-in');
    setError(null);
    try {
      await loginWithGoogle();
    } catch (caught) {
      setStatus('error');
      setError(getErrorMessage(caught));
      throw caught;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    authorizationSequence.current += 1;
    await logoutAdmin();
    setSession(null);
    setError(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ session, status, error, login, logout, retryAuthorization: authorizeCurrentUser }),
    [authorizeCurrentUser, error, login, logout, session, status],
  );
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (context === null) throw new Error('useAdminAuth deve ser utilizado dentro de AdminAuthProvider.');
  return context;
}
