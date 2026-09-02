'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderShippingUpdateSchema, type OrderShippingUpdateValues } from '@/forms';
import { useUpdateOrder } from '@/hooks';
import {
  Button,
  Input,
  IconButton,
  Autocomplete,
  type AutocompleteOption,
} from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import type { OrderWithHistory } from '@/types';

export type UpdateOrderShippingModalProps = {
  readonly open: boolean;
  readonly order: OrderWithHistory;
  readonly onClose: () => void;
  readonly onSaveSuccess?: () => void;
};

export function UpdateOrderShippingModal({
  open,
  order,
  onClose,
  onSaveSuccess,
}: UpdateOrderShippingModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: updateOrder, isPending } = useUpdateOrder();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderShippingUpdateValues>({
    resolver: zodResolver(orderShippingUpdateSchema),
    defaultValues: {
      orderId: order.id,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount,
      cancelReturnInitiator: (order.cancelReturnInitiator as 'buyer' | 'seller' | 'system' | '') || '',
      cancellationReason: order.cancellationReason || '',
      updatedAt: String(order.updatedAt),
    },
  });

  const initiatorOptions: readonly AutocompleteOption[] = useMemo(() => [
    { value: '', label: 'Không có' },
    { value: 'buyer', label: 'Người mua (Buyer)' },
    { value: 'seller', label: 'Người bán (Seller)' },
    { value: 'system', label: 'Hệ thống (System)' },
  ], []);

  useEffect(() => {
    if (open) {
      reset({
        orderId: order.id,
        shippingFee: order.shippingFee,
        discountAmount: order.discountAmount,
        cancelReturnInitiator: (order.cancelReturnInitiator as 'buyer' | 'seller' | 'system' | '') || '',
        cancellationReason: order.cancellationReason || '',
        updatedAt: String(order.updatedAt),
      });
    }
  }, [open, order, reset]);

  if (!open) return null;

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const onSubmit = async (values: OrderShippingUpdateValues) => {
    setErrorMessage(null);
    try {
      await updateOrder({
        id: values.orderId,
        shippingFee: values.shippingFee,
        discountAmount: values.discountAmount,
        cancelReturnInitiator: values.cancelReturnInitiator || null,
        cancellationReason: values.cancellationReason || null,
        updatedAt: values.updatedAt,
      });
      onSaveSuccess?.();
      handleClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Cập nhật vận chuyển thất bại');
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
            Chỉnh sửa vận chuyển & tài chính
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Phí vận chuyển (VND) <span className="text-semantic-error">*</span>
              </label>
              <Input
                type="number"
                {...register('shippingFee', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                })}
                className="text-xs"
              />
              {errors.shippingFee && (
                <p className="mt-1 text-xs text-semantic-error">{errors.shippingFee.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Giảm giá (VND) <span className="text-semantic-error">*</span>
              </label>
              <Input
                type="number"
                {...register('discountAmount', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                })}
                className="text-xs"
              />
              {errors.discountAmount && (
                <p className="mt-1 text-xs text-semantic-error">{errors.discountAmount.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Bên yêu cầu hủy / hoàn (nếu có)
            </label>
            <Controller
              control={control}
              name="cancelReturnInitiator"
              render={({ field }) => (
                <Autocomplete
                  options={initiatorOptions}
                  value={field.value || ''}
                  onChange={(val) => field.onChange((val as 'buyer' | 'seller' | 'system' | '') || '')}
                  placeholder="Chọn bên yêu cầu..."
                  searchable={false}
                  size="sm"
                />
              )}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Lý do hủy / trả hàng
            </label>
            <textarea
              {...register('cancellationReason')}
              rows={2}
              placeholder="Nhập lý do chi tiết..."
              className="w-full rounded-md border border-hairline bg-surface-card p-2.5 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
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
