import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/organisms/Authentication';
import { getAuthenticatedSessionContextAction } from '@/actions/authenticationActions';
import { validateSafeReturnUrl } from '@/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'authentication.login' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { locale } = await params;
  const { returnUrl } = await searchParams;

  const sessionResponse = await getAuthenticatedSessionContextAction();
  const authContext = sessionResponse.data;

  // If already authenticated and active, forward to target
  if (authContext && authContext.computedState === 'active') {
    const destination = validateSafeReturnUrl(returnUrl, `/${locale}/conversations`);
    redirect(destination);
  }

  return <LoginForm returnUrl={returnUrl} />;
}
