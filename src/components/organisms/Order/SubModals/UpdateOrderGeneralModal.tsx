'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderGeneralUpdateSchema, type OrderGeneralUpdateValues } from '@/forms';
import { useUpdateOrder } from '@/hooks';
import {
  Button,
  Input,
  IconButton,
  Autocomplete,
  type AutocompleteOption,
} from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import type { OrderWithHistory, OrderLookupOptions } from '@/types';

export type UpdateOrderGeneralModalProps = {
  readonly open: boolean;
  readonly order: OrderWithHistory;
  readonly lookups?: OrderLookupOptions;
  readonly onClose: () => void;
  readonly onSaveSuccess?: () => void;
};

export function UpdateOrderGeneralModal({
  open,
  order,
  lookups,
  onClose,
  onSaveSuccess,
}: UpdateOrderGeneralModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: updateOrder, isPending } = useUpdateOrder();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderGeneralUpdateValues>({
    resolver: zodResolver(orderGeneralUpdateSchema),
    defaultValues: {
      orderId: order.id,
      platformId: order.platformId,
      platformOrderId: order.platformOrderId,
      customerId: order.customerId,
      currency: order.currency,
      updatedAt: String(order.updatedAt),
    },
  });

  const platformOptions: readonly AutocompleteOption[] = useMemo(() => {
    return (lookups?.platforms || []).map((p) => ({
      value: String(p.id),
      label: p.name,
    }));
  }, [lookups?.platforms]);

  const customerOptions: readonly AutocompleteOption[] = useMemo(() => {
    return (lookups?.customers || []).map((c) => ({
      value: String(c.id),
      label: c.platformBuyerId,
      subLabel: `${c.platformName} · ${c.vipTierName}`,
    }));
  }, [lookups?.customers]);

  useEffect(() => {
    if (open) {
      reset({
        orderId: order.id,
        platformId: order.platformId,
        platformOrderId: order.platformOrderId,
        customerId: order.customerId,
        currency: order.currency,
        updatedAt: String(order.updatedAt),
      });
    }
  }, [open, order, reset]);

  if (!open) return null;

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const onSubmit = async (values: OrderGeneralUpdateValues) => {
    setErrorMessage(null);
    try {
      await updateOrder({
        id: values.orderId,
        platformId: values.platformId,
        platformOrderId: values.platformOrderId,
        customerId: values.customerId,
        currency: values.currency,
        updatedAt: values.updatedAt,
      });
      onSaveSuccess?.();
      handleClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Cập nhật thông tin thất bại');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface-card p-6 shadow-elevated">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Chỉnh sửa thông tin chung đơn hàng
          </h3>
          <IconButton
            variant="ghost"
            size="sm"
            ariaLabel="Đóng"
            onClick={handleClose}
            className="text-muted hover:text-foreground"
          >
            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </IconButton>
        </div>

        {errorMessage && (
          <div className="mt-3">
            <ErrorBanner
              message={errorMessage}
              onDismiss={() => setErrorMessage(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Sàn thương mại điện tử <span className="text-semantic-error">*</span>
            </label>
            <Controller
              control={control}
              name="platformId"
              render={({ field }) => (
                <Autocomplete
                  options={platformOptions}
                  value={field.value ? String(field.value) : ''}
                  onChange={(val) => field.onChange(val ? Number(val) : 0)}
                  placeholder="Chọn sàn TMĐT..."
                  searchPlaceholder="Tìm kiếm sàn..."
                  size="sm"
                />
              )}
            />
            {errors.platformId && (
              <p className="mt-1 text-xs text-semantic-error">{errors.platformId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Mã đơn hàng sàn <span className="text-semantic-error">*</span>
            </label>
            <Input
              {...register('platformOrderId')}
              placeholder="VD: ORD-12345, SHOPIFY-9821..."
              className="text-xs"
            />
            {errors.platformOrderId && (
              <p className="mt-1 text-xs text-semantic-error">{errors.platformOrderId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Khách hàng (Buyer ID) <span className="text-semantic-error">*</span>
            </label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Autocomplete
                  options={customerOptions}
                  value={field.value ? String(field.value) : ''}
                  onChange={(val) => field.onChange(val ? Number(val) : 0)}
                  placeholder="Chọn khách hàng..."
                  searchPlaceholder="Tìm kiếm buyer..."
                  size="sm"
                />
              )}
            />
            {errors.customerId && (
              <p className="mt-1 text-xs text-semantic-error">{errors.customerId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tiền tệ</label>
            <Input
              {...register('currency')}
              placeholder="VND"
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isPending}
            >
              {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
