import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signOut as firebaseSignOut } from 'firebase/auth';
import {
  apiRequest,
  hasStoredDemoToken,
  setActiveDemoToken,
} from '../lib/apiClient';
import { auth } from '../lib/firebase';
import type { AuthSessionResponse } from '../shared/types';

export type PortalMode = 'backoffice' | 'employee';
export type ViewMode = 'desktop' | 'mobile';

const VIEW_MODE_STORAGE_KEY = 'karyaflow_view_mode';

function getInitialViewMode(): ViewMode {
  try {
    const saved = sessionStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === 'desktop' || saved === 'mobile') return saved;
  } catch {
    // ignore storage access issues
  }
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return 'mobile';
  }
  return 'desktop';
}

interface AuthContextValue {
  session: AuthSessionResponse | null;
  loading: boolean;
  authError: string | null;
  portalMode: PortalMode;
  viewMode: ViewMode;
  setPortalMode: (mode: PortalMode) => void;
  setViewMode: (mode: ViewMode) => void;
  signInWithDemo: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [portalMode, setPortalModeState] = useState<PortalMode>('employee');

  const resolvePortalForSession = useCallback(
    (data: AuthSessionResponse, targetViewMode: ViewMode): PortalMode => {
      if (targetViewMode === 'mobile') return 'employee';
      return data.permissions.canAccessBackoffice ? 'backoffice' : 'employee';
    },
    [],
  );

  const fetchBackendSession = useCallback(async () => {
    try {
      setAuthError(null);
      const data = await apiRequest<AuthSessionResponse>('/me');
      setSession(data);
      setPortalModeState(resolvePortalForSession(data, getInitialViewMode()));
    } catch (err) {
      setActiveDemoToken(null);
      const msg = err instanceof Error ? err.message : 'Sesi berakhir. Silakan masuk kembali.';
      setAuthError(msg);
      setSession(null);
    }
  }, [resolvePortalForSession]);

  useEffect(() => {
    const init = async () => {
      if (hasStoredDemoToken()) {
        await fetchBackendSession();
      }
      setLoading(false);
    };
    init();
  }, [fetchBackendSession]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      try {
        sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        // ignore storage errors
      }
      if (session) {
        setPortalModeState(resolvePortalForSession(session, mode));
      }
    },
    [session, resolvePortalForSession],
  );

  const signInWithDemo = useCallback(
    async (email: string, password: string) => {
      try {
        setAuthError(null);
        setLoading(true);
        const res = await apiRequest<{ token: string; session: AuthSessionResponse }>(
          '/auth/demo-login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          },
          true,
        );
        setActiveDemoToken(res.token);
        setSession(res.session);
        setPortalModeState(resolvePortalForSession(res.session, viewMode));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal masuk dengan akun demo.';
        setAuthError(message);
      } finally {
        setLoading(false);
      }
    },
    [viewMode, resolvePortalForSession],
  );

  const signOut = useCallback(async () => {
    setAuthError(null);
    setActiveDemoToken(null);
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if firebase not signed in
    }
    setSession(null);
    setPortalModeState('employee');
  }, []);

  const setPortalMode = useCallback(
    (mode: PortalMode) => {
      if (mode === 'backoffice' && !session?.permissions.canAccessBackoffice) {
        return;
      }
      setPortalModeState(mode);
      const nextViewMode: ViewMode = mode === 'backoffice' ? 'desktop' : 'mobile';
      setViewModeState(nextViewMode);
      try {
        sessionStorage.setItem(VIEW_MODE_STORAGE_KEY, nextViewMode);
      } catch {
        // ignore
      }
    },
    [session],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        authError,
        portalMode,
        viewMode,
        setPortalMode,
        setViewMode,
        signInWithDemo,
        signOut,
        refreshSession: fetchBackendSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
