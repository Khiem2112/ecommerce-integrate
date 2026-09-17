import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAuthenticatedSessionContextAction } from '@/actions/authenticationActions';
import { getOrganizationsAction } from '@/actions/organizationActions';
import { OrganizationSelector } from '@/components/organisms/Authentication';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'authentication.selectOrganization',
  });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function SelectOrganizationPage({
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

  if (!authContext) {
    redirect(`/${locale}/login`);
  }

  if (authContext.user.mustChangePassword) {
    redirect(`/${locale}/change-password`);
  }

  const orgsResponse = await getOrganizationsAction({
    pageSize: 100,
  });

  const organizations = orgsResponse.data?.items ?? [];

  if (organizations.length === 0) {
    redirect(`/${locale}/no-active-membership`);
  }

  return (
    <OrganizationSelector
      organizations={organizations}
      returnUrl={returnUrl}
    />
  );
}
