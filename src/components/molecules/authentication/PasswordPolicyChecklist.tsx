'use client';

import { useTranslations } from 'next-intl';
import { AUTH_CONFIG } from '@/config/authentication';
import { cn } from '@/lib/cn';

export type PasswordPolicyChecklistProps = {
  readonly password?: string;
  readonly confirmation?: string;
  readonly currentPassword?: string;
  readonly isVoluntary?: boolean;
};

export function PasswordPolicyChecklist({
  password = '',
  confirmation = '',
  currentPassword = '',
  isVoluntary = false,
}: PasswordPolicyChecklistProps) {
  const t = useTranslations('authentication.changePassword');

  const isLengthValid =
    password.length >= AUTH_CONFIG.PASSWORD_POLICY.MIN_LENGTH &&
    password.length <= AUTH_CONFIG.PASSWORD_POLICY.MAX_LENGTH;

  const isMatchValid = password.length > 0 && password === confirmation;

  const isDifferentValid = !isVoluntary || (password.length > 0 && password !== currentPassword);

  const rules = [
    { id: 'length', label: t('policyLength'), satisfied: isLengthValid },
    { id: 'match', label: t('policyMatch'), satisfied: isMatchValid },
    ...(isVoluntary
      ? [{ id: 'different', label: t('policyDifferent'), satisfied: isDifferentValid }]
      : []),
  ];

  return (
    <ul className="space-y-1.5 text-xs">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={cn(
            'flex items-center gap-2 transition-colors duration-150',
            rule.satisfied ? 'text-status-success-text' : 'text-muted',
          )}
        >
          {rule.satisfied ? (
            <svg
              aria-hidden="true"
              className="size-3.5 shrink-0 text-status-success"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted/60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
