'use client';

import type { JSX } from 'react';
import { OrganizationSwitcher } from '../Organization/OrganizationSwitcher';

export type UserSessionMenuProps = {
  readonly className?: string;
};

export function UserSessionMenu({ className }: UserSessionMenuProps): JSX.Element {
  return <OrganizationSwitcher compact className={className} />;
}
