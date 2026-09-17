'use client';

import { OrganizationMembersSection } from './OrganizationMembersSection';
import type { OrganizationDetail } from '@/types';

export type OrganizationMembersTabProps = {
  readonly organization: OrganizationDetail;
};

export function OrganizationMembersTab({
  organization,
}: OrganizationMembersTabProps) {
  return <OrganizationMembersSection organization={organization} />;
}
