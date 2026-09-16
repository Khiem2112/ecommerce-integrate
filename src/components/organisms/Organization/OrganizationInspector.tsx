'use client';

import { OrganizationDetailHeader } from './OrganizationDetailHeader';
import { OrganizationWorkspaceInfoSection } from './OrganizationWorkspaceInfoSection';
import { OrganizationMembersSection } from './OrganizationMembersSection';
import type { OrganizationDetail } from '@/types';

export type OrganizationInspectorProps = {
  readonly organization: OrganizationDetail;
  readonly onSwitchActive?: () => void;
  readonly isSwitching?: boolean;
};

export function OrganizationInspector({
  organization,
  onSwitchActive,
  isSwitching,
}: OrganizationInspectorProps) {
  return (
    <div className="space-y-6">
      <OrganizationDetailHeader
        organization={organization}
        onSwitchActive={onSwitchActive}
        isSwitching={isSwitching}
      />
      <OrganizationWorkspaceInfoSection organization={organization} />
      <OrganizationMembersSection organization={organization} />
    </div>
  );
}
