import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import backend from '@/api/backends';
import { IS_LOCAL_MODE } from '@/api/config';
import { resetActivityUser } from '@/api/activity';

const AuthContext = createContext(null);

/**
 * Keeps track of whether someone is signed in.
 *
 * status:
 *   "loading"    – still checking
 *   "signedOut"  – show the sign-in screen
 *   "signedIn"   – show the app
 *   "error"      – the database could not be reached
 */
export const AuthProvider = ({ children }) => {
  const [status, setStatus] = useState('loading');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const lastUserId = useRef(null);

  const checkAppState = useCallback(async () => {
    try {
      setAuthError(null);
      const userId = await backend.getSessionUserId();
      if (userId) {
        if (lastUserId.current !== userId) {
          lastUserId.current = userId;
          resetActivityUser();
          setSessionVersion((v) => v + 1);
        }
        setNeedsSetup(false);
        setStatus('signedIn');
        return;
      }
      lastUserId.current = null;
      const setupNeeded = await backend.needsSetup();
      setNeedsSetup(setupNeeded);
      setStatus('signedOut');
    } catch (error) {
      console.error('Could not check sign-in state:', error);
      setAuthError({
        type: 'unreachable',
        message: error?.message || 'The database could not be reached.',
      });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    checkAppState();
    const unsubscribe = backend.onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecoveringPassword(true);
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      checkAppState();
    });
    return unsubscribe;
  }, [checkAppState]);

  const signIn = useCallback(
    async (credentials) => {
      const result = await backend.signIn(credentials);
      await checkAppState();
      return result;
    },
    [checkAppState]
  );

  const signUp = useCallback(
    async (details) => {
      const result = await backend.signUp(details);
      await checkAppState();
      return result;
    },
    [checkAppState]
  );

  const logout = useCallback(async () => {
    try {
      await backend.signOut();
    } finally {
      await checkAppState();
    }
  }, [checkAppState]);

  const requestPasswordReset = useCallback((details) => backend.resetPassword(details), []);

  const finishPasswordRecovery = useCallback(async (newPassword) => {
    await backend.changePassword(newPassword);
    setIsRecoveringPassword(false);
  }, []);

  const value = useMemo(
    () => ({
      status,
      isAuthenticated: status === 'signedIn',
      isLoadingAuth: status === 'loading',
      needsSetup,
      authError,
      isLocalMode: IS_LOCAL_MODE,
      isRecoveringPassword,
      sessionVersion,
      signIn,
      signUp,
      logout,
      requestPasswordReset,
      finishPasswordRecovery,
      cancelPasswordRecovery: () => setIsRecoveringPassword(false),
      checkInvitation: (email) => backend.checkInvitation(email),
      checkAppState,
    }),
    [
      status,
      needsSetup,
      authError,
      isRecoveringPassword,
      sessionVersion,
      signIn,
      signUp,
      logout,
      requestPasswordReset,
      finishPasswordRecovery,
      checkAppState,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
