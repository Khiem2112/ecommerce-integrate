'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
} from '@/components/atoms';
import { formatDate } from '@/utils';
import type { CustomerFullDetail } from '@/types';

export type CustomerConversationsTabProps = {
  readonly customer: CustomerFullDetail;
};

function getPriorityBadgeVariant(priority: string): 'error' | 'warning' | 'info' | 'secondary' {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    case 'normal':
      return 'info';
    default:
      return 'secondary';
  }
}

export function CustomerConversationsTab({
  customer,
}: CustomerConversationsTabProps) {
  const conversations = customer.conversations ?? [];
  const t = useTranslations('customers');

  if (conversations.length === 0) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
        <svg
          aria-hidden="true"
          className="mx-auto size-10 text-muted/60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.5 4.5 0 0 0 .762-2.316A8.04 8.04 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
        <h3 className="mt-3 text-sm font-semibold text-foreground">{t('conversations.emptyTitle')}</h3>
        <p className="mt-1 text-xs text-muted">
          {t('conversations.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('conversations.history', { count: conversations.length })}
        </h3>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-card">
        <Table className="min-w-[850px]">
          <TableHeader className="bg-surface-lifted border-b border-hairline">
            <TableRow>
              <TableHead className="w-24 whitespace-nowrap">{t('conversations.sessionId')}</TableHead>
              <TableHead className="w-36 whitespace-nowrap">{t('conversations.time')}</TableHead>
              <TableHead className="w-44 whitespace-nowrap">{t('conversations.intent')}</TableHead>
              <TableHead className="w-28 whitespace-nowrap">{t('conversations.priority')}</TableHead>
              <TableHead className="w-44 whitespace-nowrap">{t('conversations.agent')}</TableHead>
              <TableHead className="w-32 whitespace-nowrap">{t('conversations.status')}</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">{t('conversations.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conv) => (
              <TableRow key={conv.id} className="hover:bg-surface-lifted/60 transition-colors">
                {/* ID */}
                <TableCell className="font-mono text-xs font-semibold text-foreground">
                  #{conv.id}
                </TableCell>

                {/* Started At */}
                <TableCell className="text-xs text-muted">
                  {formatDate(conv.startedAt)}
                </TableCell>

                {/* Intent */}
                <TableCell>
                  <span className="text-xs font-medium text-foreground">
                    {conv.intent?.name ?? t('conversations.generalInquiry')}
                  </span>
                </TableCell>

                {/* Priority */}
                <TableCell>
                  <Badge variant={getPriorityBadgeVariant(conv.priority)} size="sm">
                    {conv.priority.toUpperCase()}
                  </Badge>
                </TableCell>

                {/* Agent */}
                <TableCell className="text-xs text-muted">
                  {conv.assignedAgent?.name ?? t('conversations.unassigned')}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge variant="info" size="sm">
                    {conv.status.name}
                  </Badge>
                </TableCell>

                {/* Action */}
                <TableCell className="text-right">
                  <Link href={`/?conversationId=${conv.id}`}>
                    <Button variant="outline" size="xs">
                      {t('conversations.openChat')}
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
