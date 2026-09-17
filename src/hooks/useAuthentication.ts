'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { logoutAction } from '@/actions/authenticationActions';
import { useAuthContext } from '@/components/providers/AuthenticationProvider';

export function useAuthentication() {
  const { user, computedState, isAuthenticated } = useAuthContext();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout(): Promise<void> {
    try {
      setIsLoggingOut(true);
      await logoutAction();
      queryClient.clear();
      router.push('/login');
      router.refresh();
    } catch {
      // In case of error, still clear client cache and push to login
      queryClient.clear();
      router.push('/login');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return {
    user,
    computedState,
    isAuthenticated,
    isLoggingOut,
    logout,
  };
}
