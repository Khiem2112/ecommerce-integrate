import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AgentWorkspace } from '@/components/organisms';
import { getAuthenticatedSessionContextService } from '@/services/authentication/authSessionService';

type ConversationsPageProps = {
  readonly params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<{
  title: string;
  description: string;
}> {
  const t = await getTranslations('workspace');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ConversationsPage({
  params,
}: ConversationsPageProps): Promise<ReactElement> {
  const { locale } = await params;
  const session = await getAuthenticatedSessionContextService();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const organizationId = session.activeOrganization?.organizationId;
  if (organizationId == null) {
    redirect(`/${locale}/select-organization`);
  }

  return <AgentWorkspace orgId={organizationId} />;
}
