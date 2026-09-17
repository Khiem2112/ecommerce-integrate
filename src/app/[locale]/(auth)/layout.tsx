import type { ReactNode } from 'react';
import { AuthenticationProvider } from '@/components/providers/AuthenticationProvider';
import { getAuthenticatedSessionContextAction } from '@/actions/authenticationActions';

export default async function AuthLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const sessionResponse = await getAuthenticatedSessionContextAction().catch(() => ({ success: true, data: null }));
  const authContext = sessionResponse?.data;

  return (
    <AuthenticationProvider
      initialUser={authContext?.user ?? null}
      initialState={authContext?.computedState ?? null}
    >
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-foreground text-background font-bold text-lg shadow-sm">
            O
          </div>
          <h1 className="mt-3 text-lg font-bold tracking-tight text-foreground">
            OmniCart Recover
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Merchant Operations Platform
          </p>
        </div>

        {/* Centered Auth Card */}
        <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-card p-6 sm:p-8 shadow-sm">
          {children}
        </div>

        {/* Footer copyright */}
        <div className="mt-8 text-center text-[11px] text-muted">
          &copy; {new Date().getFullYear()} OmniCart. All rights reserved.
        </div>
      </div>
    </AuthenticationProvider>
  );
}
