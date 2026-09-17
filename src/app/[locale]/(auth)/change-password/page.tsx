import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PasswordChangeForm } from '@/components/organisms/Authentication';
import { getAuthenticatedSessionContextAction } from '@/actions/authenticationActions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'authentication.changePassword',
  });
  return {
    title: t('mandatoryTitle'),
    description: t('mandatorySubtitle'),
  };
}

export default async function ChangePasswordPage({
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

  // If the user is already permitted (does not require mandatory password change)
  if (!authContext.user.mustChangePassword) {
    redirect(`/${locale}/conversations`);
  }

  return <PasswordChangeForm mode="mandatory" />;
}
