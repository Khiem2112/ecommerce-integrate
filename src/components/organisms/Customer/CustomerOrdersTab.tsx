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
import { formatVND, formatDate, getStatusBadgeVariant } from '@/utils';
import type { CustomerFullDetail } from '@/types';

export type CustomerOrdersTabProps = {
  readonly customer: CustomerFullDetail;
  readonly onViewOrder?: (orderId: number) => void;
};

export function CustomerOrdersTab({ customer, onViewOrder }: CustomerOrdersTabProps) {
  const orders = customer.orders ?? [];
  const t = useTranslations('customers');

  if (orders.length === 0) {
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
        <h3 className="mt-3 text-sm font-semibold text-foreground">{t('orders.emptyTitle')}</h3>
        <p className="mt-1 text-xs text-muted">
          {t('orders.emptyDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('orders.history', { count: orders.length })}
        </h3>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-card">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-surface-lifted border-b border-hairline">
            <TableRow>
              <TableHead className="w-40 whitespace-nowrap">{t('orders.orderId')}</TableHead>
              <TableHead className="w-28 whitespace-nowrap">{t('orders.platform')}</TableHead>
              <TableHead className="w-36 whitespace-nowrap">{t('orders.orderedAt')}</TableHead>
              <TableHead className="w-32 whitespace-nowrap">{t('orders.status')}</TableHead>
              <TableHead className="w-56 whitespace-nowrap">{t('orders.items')}</TableHead>
              <TableHead className="w-36 text-right whitespace-nowrap">{t('orders.total')}</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">{t('orders.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const statusBadge = getStatusBadgeVariant(order.currentStatus.code);

              return (
                <TableRow key={order.id} className="hover:bg-surface-lifted/60 transition-colors">
                  {/* Order ID */}
                  <TableCell className="font-mono text-xs font-semibold text-foreground">
                    {onViewOrder ? (
                      <button
                        type="button"
                        onClick={() => onViewOrder(order.id)}
                        className="font-mono text-xs font-semibold text-foreground hover:underline hover:text-primary transition cursor-pointer"
                      >
                        #{order.platformOrderId}
                      </button>
                    ) : (
                      <Link
                        href={`/orders/${order.id}`}
                        className="hover:underline hover:text-primary transition"
                      >
                        #{order.platformOrderId}
                      </Link>
                    )}
                  </TableCell>

                  {/* Platform */}
                  <TableCell>
                    <Badge variant="secondary" size="sm">
                      {order.platform.name}
                    </Badge>
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-xs text-muted">
                    {formatDate(order.createdAt)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant={statusBadge.variant} size="sm">
                      {order.currentStatus.name}
                    </Badge>
                  </TableCell>

                  {/* Items summary */}
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-foreground">
                        {t('orders.itemCount', { count: order.items.length })}
                      </span>
                      {order.items.length > 0 && (
                        <span className="truncate max-w-[200px] text-[11px] text-muted">
                          {order.items[0]?.productName}
                          {order.items.length > 1 ? ` (+${order.items.length - 1})` : ''}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Total Amount */}
                  <TableCell className="text-right font-semibold text-xs text-foreground font-mono">
                    {formatVND(order.totalValue)}
                  </TableCell>

                  {/* Action */}
                  <TableCell className="text-right">
                    {onViewOrder ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => onViewOrder(order.id)}
                      >
                        {t('orders.viewDetails')}
                      </Button>
                    ) : (
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="xs">
                          {t('orders.viewDetails')}
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
