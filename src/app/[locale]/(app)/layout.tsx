import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/organisms/AppShell';
import { AuthenticationProvider } from '@/components/providers/AuthenticationProvider';
import {
  getAuthenticatedSessionContextAction,
  getUserActiveMembershipCountAction,
} from '@/actions/authenticationActions';

type AppLayoutProps = {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
};

export default async function ProtectedAppLayout({
  children,
  params,
}: AppLayoutProps): Promise<ReactNode> {
  const { locale } = await params;
  const sessionResponse = await getAuthenticatedSessionContextAction();
  const authContext = sessionResponse.data;

  if (
    !authContext ||
    authContext.computedState === 'revoked' ||
    authContext.computedState === 'expired'
  ) {
    redirect(`/${locale}/login`);
  }

  if (authContext.computedState === 'restricted_password_change') {
    redirect(`/${locale}/change-password`);
  }

  if (authContext.computedState === 'context_pending') {
    const countResponse = await getUserActiveMembershipCountAction();
    const membershipCount = countResponse.data ?? 0;

    if (membershipCount > 0) {
      redirect(`/${locale}/select-organization`);
    } else {
      redirect(`/${locale}/no-active-membership`);
    }
  }

  return (
    <AuthenticationProvider
      initialUser={authContext.user}
      initialState={authContext.computedState}
    >
      <AppShell>{children}</AppShell>
    </AuthenticationProvider>
  );
}
