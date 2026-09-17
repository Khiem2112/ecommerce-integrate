import { AgentWorkspace } from '@/components/organisms';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('workspace');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function ConversationsPage() {
  return <AgentWorkspace />;
}
