import { redirect } from 'next/navigation';

export default async function NewOrganizationPage({
  params,
}: {
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/organizations`);
}
