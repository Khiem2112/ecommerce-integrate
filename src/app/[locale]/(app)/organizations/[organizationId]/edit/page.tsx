import { redirect } from 'next/navigation';

export default async function EditOrganizationPage({
  params,
}: {
  readonly params: Promise<{
    readonly locale: string;
    readonly organizationId: string;
  }>;
}) {
  const { locale, organizationId } = await params;
  redirect(`/${locale}/organizations/${organizationId}`);
}
