'use client';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from '@/components/atoms';
import { formatDate } from '@/utils';
import type { CustomerFullDetail } from '@/types';
import { cn } from '@/lib/cn';

export type CustomerEvidencesTabProps = {
  readonly customer: CustomerFullDetail;
};

function ConfidenceMeter({ confidence }: { readonly confidence: number }) {
  const pct = Math.round(confidence * 100);
  let barColor = 'bg-status-warning';
  if (confidence >= 0.9) barColor = 'bg-status-success';
  else if (confidence >= 0.7) barColor = 'bg-status-info';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-surface-lifted border border-hairline">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs font-semibold text-foreground">
        {pct}%
      </span>
    </div>
  );
}

export function CustomerEvidencesTab({
  customer,
}: CustomerEvidencesTabProps) {
  const evidences = customer.evidences ?? [];

  return (
    <div className="space-y-4">
      {/* Notice Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-lifted p-4 shadow-xs">
        <div className="rounded-lg bg-surface-card border border-hairline p-2 text-primary shadow-xs">
          <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.516 0c.85.493 1.508 1.333 1.508 2.316V18" />
          </svg>
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold text-foreground">
            Layer 3 Memory — AI Co-pilot Grounded Evidence Facts
          </h4>
          <p className="text-xs text-muted">
            Các sự thật hành vi dưới đây được trích xuất tự động từ lịch sử mua sắm và hội thoại của khách hàng để phục vụ AI Co-pilot phản hồi chính xác, chống ảo giác (Anti-Hallucination). Màn hình này đang hoạt động ở chế độ <strong>Read-Only</strong> theo quy định hệ thống.
          </p>
        </div>
      </div>

      {evidences.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface-card p-12 text-center shadow-card">
          <svg
            aria-hidden="true"
            className="mx-auto size-10 text-muted/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Chưa có Evidence Facts nào</h3>
          <p className="mt-1 text-xs text-muted">
            Hệ thống AI chưa trích xuất hoặc ghi nhận sự thật hành vi nào cho khách hàng này.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-card">
          <Table className="min-w-[950px]">
            <TableHeader className="bg-surface-lifted border-b border-hairline">
              <TableRow>
                <TableHead className="w-16 whitespace-nowrap">ID</TableHead>
                <TableHead className="w-64 whitespace-nowrap">Sự thật hành vi (Fact)</TableHead>
                <TableHead className="w-80 whitespace-nowrap">Chứng cứ đối chiếu (Evidence)</TableHead>
                <TableHead className="w-36 whitespace-nowrap">Độ tin cậy</TableHead>
                <TableHead className="w-36 whitespace-nowrap">Ghi nhận gần nhất</TableHead>
                <TableHead className="w-24 whitespace-nowrap">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidences.map((item) => (
                <TableRow key={item.id} className="hover:bg-surface-lifted/60 transition-colors">
                  {/* ID */}
                  <TableCell className="font-mono text-xs font-semibold text-muted">
                    #{item.id}
                  </TableCell>

                  {/* Fact */}
                  <TableCell>
                    <span className="text-xs font-medium text-foreground">
                      {item.fact}
                    </span>
                  </TableCell>

                  {/* Evidence */}
                  <TableCell>
                    <span className="text-xs text-muted font-mono">
                      {item.evidence}
                    </span>
                  </TableCell>

                  {/* Confidence */}
                  <TableCell>
                    <ConfidenceMeter confidence={item.confidence} />
                  </TableCell>

                  {/* Last Observed */}
                  <TableCell className="text-xs text-muted">
                    {formatDate(item.lastObserved)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {item.isActive ? (
                      <Badge variant="success" size="sm">
                        Hiệu lực
                      </Badge>
                    ) : (
                      <Badge variant="secondary" size="sm">
                        Đã tắt
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
