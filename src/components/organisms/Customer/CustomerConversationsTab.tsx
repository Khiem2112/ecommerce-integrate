'use client';

import Link from 'next/link';
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
        <h3 className="mt-3 text-sm font-semibold text-foreground">Chưa có lịch sử hội thoại</h3>
        <p className="mt-1 text-xs text-muted">
          Khách hàng này chưa có phiên chat hoặc yêu cầu hỗ trợ nào được ghi nhận trên hệ thống.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          Lịch sử hội thoại & khiếu nại ({conversations.length})
        </h3>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-card">
        <Table className="min-w-[850px]">
          <TableHeader className="bg-surface-lifted border-b border-hairline">
            <TableRow>
              <TableHead className="w-24 whitespace-nowrap">Mã phiên</TableHead>
              <TableHead className="w-36 whitespace-nowrap">Thời điểm</TableHead>
              <TableHead className="w-44 whitespace-nowrap">Ý định (Intent)</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Mức ưu tiên</TableHead>
              <TableHead className="w-44 whitespace-nowrap">Agent phụ trách</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Trạng thái</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">Thao tác</TableHead>
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
                    {conv.intent?.name ?? 'Hỏi đáp chung'}
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
                  {conv.assignedAgent?.name ?? 'Chưa phân công'}
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
                      Mở chat
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
