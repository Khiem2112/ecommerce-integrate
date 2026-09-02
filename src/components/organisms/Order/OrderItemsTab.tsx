'use client';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  IconButton,
  Badge,
} from '@/components/atoms';
import { formatVND } from '@/utils';
import type { OrderWithHistory } from '@/types';

export type OrderItemsTabProps = {
  readonly order: OrderWithHistory;
  readonly onAddItem: () => void;
  readonly onDeleteItem: (itemId: number) => void;
};

export function OrderItemsTab({
  order,
  onAddItem,
  onDeleteItem,
}: OrderItemsTabProps) {
  const itemsSubtotal = order.items.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice - item.discount),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Danh sách mặt hàng ({order.items.length} sản phẩm)
          </h4>
          <p className="text-xs text-muted">Các dòng sản phẩm và chiết khấu chi tiết của đơn hàng.</p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onAddItem}
          className="h-8 text-xs"
          icon={
            <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
        >
          Thêm sản phẩm
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface-card shadow-card">
        <Table className="min-w-[800px]">
          <TableHeader className="sticky top-0 z-10 bg-surface-lifted border-b border-hairline">
            <TableRow>
              <TableHead className="w-12 text-center whitespace-nowrap">#</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Mã SP / SKU</TableHead>
              <TableHead className="whitespace-nowrap">Tên sản phẩm</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Danh mục</TableHead>
              <TableHead className="w-20 text-center whitespace-nowrap">SL</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">Đơn giá</TableHead>
              <TableHead className="w-24 text-right whitespace-nowrap">Giảm giá</TableHead>
              <TableHead className="w-32 text-right whitespace-nowrap">Thành tiền</TableHead>
              <TableHead className="w-16 text-right whitespace-nowrap">Xóa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-xs text-muted">
                  Chưa có sản phẩm nào trong đơn hàng.
                </TableCell>
              </TableRow>
            ) : (
              order.items.map((item, index) => {
                const lineTotal = item.quantity * item.unitPrice - item.discount;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-center font-mono text-xs text-muted">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {item.productId}
                        </span>
                        {item.sku && (
                          <span className="font-mono text-xs text-muted">
                            SKU: {item.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-xs">
                      {item.productName}
                    </TableCell>
                    <TableCell>
                      {item.category ? (
                        <Badge variant="secondary" size="sm">
                          {item.category.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-semibold">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatVND(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-semantic-error">
                      {item.discount > 0 ? `-${formatVND(item.discount)}` : '0'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatVND(lineTotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      <IconButton
                        variant="ghost"
                        size="sm"
                        ariaLabel="Xóa sản phẩm"
                        onClick={() => onDeleteItem(item.id)}
                        disabled={order.items.length <= 1}
                        className="text-muted hover:text-semantic-error disabled:opacity-50"
                        tooltip={order.items.length <= 1 ? 'Đơn hàng phải có ít nhất 1 sản phẩm' : 'Xóa sản phẩm này'}
                      >
                        <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Financial Breakdown Summary in Table Footer */}
        <div className="border-t border-hairline bg-surface-lifted/40 p-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Tạm tính tiền hàng:</span>
              <span className="font-mono text-foreground">{formatVND(itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Phí vận chuyển:</span>
              <span className="font-mono text-foreground">+{formatVND(order.shippingFee)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Giảm giá toàn đơn:</span>
              <span className="font-mono text-semantic-error">-{formatVND(order.discountAmount)}</span>
            </div>
            <div className="border-t border-hairline pt-1.5 flex justify-between font-semibold text-sm text-foreground">
              <span>Tổng thanh toán:</span>
              <span className="font-mono text-base text-primary">{formatVND(order.totalValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
