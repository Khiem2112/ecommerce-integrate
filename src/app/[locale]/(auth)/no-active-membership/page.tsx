import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { NoActiveMembershipState } from '@/components/organisms/Authentication';
import { getAuthenticatedSessionContextAction } from '@/actions/authenticationActions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'authentication.noActiveMembership',
  });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function NoActiveMembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sessionResponse = await getAuthenticatedSessionContextAction();
  const authContext = sessionResponse.data;

  if (!authContext) {
    redirect(`/${locale}/login`);
  }

  // If user already has an active organization, redirect into the app
  if (authContext.computedState === 'active') {
    redirect(`/${locale}/conversations`);
  }

  return <NoActiveMembershipState user={authContext.user} />;
}
