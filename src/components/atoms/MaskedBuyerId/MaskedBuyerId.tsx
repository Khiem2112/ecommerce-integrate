'use client';

import { Tooltip } from '../Tooltip';
import { cn } from '@/lib/cn';

const MASKED_PATTERN = /[A-Za-z0-9_]+\*+[A-Za-z0-9_]*/;
const UNKNOWN_VALUES = ['unknown_buyer', 'unknown', ''];
const MASKED_BUYER_TOOLTIP = 'Thông tin người mua bị ẩn theo chính sách sàn';

function InfoIcon({ className = 'text-muted' }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('size-3 shrink-0', className)}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function MaskedBuyerId({
  value,
}: {
  readonly value: string | null | undefined;
}) {
  if (!value || UNKNOWN_VALUES.includes(value.toLowerCase())) {
    return (
      <Tooltip content={MASKED_BUYER_TOOLTIP} side="right">
        <span className="inline-flex items-center gap-1 font-mono text-xs italic text-muted">
          Ẩn danh (sàn)
          <InfoIcon />
        </span>
      </Tooltip>
    );
  }

  if (MASKED_PATTERN.test(value)) {
    return (
      <Tooltip content={MASKED_BUYER_TOOLTIP} side="right">
        <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground">
          {value}
          <InfoIcon />
        </span>
      </Tooltip>
    );
  }

  return <span className="font-mono text-xs text-foreground">{value}</span>;
}
