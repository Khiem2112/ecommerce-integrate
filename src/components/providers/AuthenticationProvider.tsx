'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ComputedSessionState, UserSessionProjection } from '@/types';

type AuthenticationContextValue = {
  readonly user: UserSessionProjection | null;
  readonly computedState: ComputedSessionState | null;
  readonly isAuthenticated: boolean;
};

const AuthenticationContext = createContext<AuthenticationContextValue>({
  user: null,
  computedState: null,
  isAuthenticated: false,
});

export type AuthenticationProviderProps = {
  readonly children: ReactNode;
  readonly initialUser?: UserSessionProjection | null;
  readonly initialState?: ComputedSessionState | null;
};

export function AuthenticationProvider({
  children,
  initialUser = null,
  initialState = null,
}: AuthenticationProviderProps) {
  const value = useMemo(
    () => ({
      user: initialUser,
      computedState: initialState,
      isAuthenticated: Boolean(initialUser && initialState === 'active'),
    }),
    [initialUser, initialState],
  );

  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
}

export function useAuthContext(): AuthenticationContextValue {
  return useContext(AuthenticationContext);
}
