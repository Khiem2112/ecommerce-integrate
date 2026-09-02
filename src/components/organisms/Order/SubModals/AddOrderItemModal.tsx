'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addOrderItemSchema, type AddOrderItemValues } from '@/forms';
import { useAddOrderItem } from '@/hooks';
import {
  Button,
  Input,
  IconButton,
  Autocomplete,
  type AutocompleteOption,
} from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import type { OrderWithHistory, OrderLookupOptions } from '@/types';

export type AddOrderItemModalProps = {
  readonly open: boolean;
  readonly order: OrderWithHistory;
  readonly lookups?: OrderLookupOptions;
  readonly onClose: () => void;
  readonly onSaveSuccess?: () => void;
};

export function AddOrderItemModal({
  open,
  order,
  lookups,
  onClose,
  onSaveSuccess,
}: AddOrderItemModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: addItem, isPending } = useAddOrderItem();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddOrderItemValues>({
    resolver: zodResolver(addOrderItemSchema),
    defaultValues: {
      orderId: order.id,
      item: {
        productId: '',
        sku: '',
        productName: '',
        categoryId: lookups?.categories[0]?.id ?? null,
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        refundAmount: 0,
      },
      updatedAt: String(order.updatedAt),
    },
  });

  const categoryOptions: readonly AutocompleteOption[] = useMemo(() => [
    { value: '', label: 'Chưa phân loại' },
    ...(lookups?.categories || []).map((c) => ({
      value: String(c.id),
      label: c.name,
    })),
  ], [lookups?.categories]);

  useEffect(() => {
    if (open) {
      reset({
        orderId: order.id,
        item: {
          productId: `PROD-${Date.now().toString().slice(-4)}`,
          sku: '',
          productName: '',
          categoryId: lookups?.categories[0]?.id ?? null,
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          refundAmount: 0,
        },
        updatedAt: String(order.updatedAt),
      });
    }
  }, [open, order, lookups, reset]);

  if (!open) return null;

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const onSubmit = async (values: AddOrderItemValues) => {
    setErrorMessage(null);
    try {
      await addItem(values);
      onSaveSuccess?.();
      handleClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Thêm sản phẩm thất bại');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface-card p-6 shadow-elevated">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Thêm sản phẩm vào đơn hàng #{order.platformOrderId}
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
                Mã sản phẩm (Product ID) <span className="text-semantic-error">*</span>
              </label>
              <Input
                {...register('item.productId')}
                placeholder="VD: PROD-101"
                className="text-xs"
              />
              {errors.item?.productId && (
                <p className="mt-1 text-xs text-semantic-error">{errors.item.productId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">SKU</label>
              <Input
                {...register('item.sku')}
                placeholder="VD: SKU-BLK-M"
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Tên sản phẩm <span className="text-semantic-error">*</span>
            </label>
            <Input
              {...register('item.productName')}
              placeholder="VD: Tai nghe Bluetooth chống ồn..."
              className="text-xs"
            />
            {errors.item?.productName && (
              <p className="mt-1 text-xs text-semantic-error">{errors.item.productName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Danh mục
              </label>
              <Controller
                control={control}
                name="item.categoryId"
                render={({ field }) => (
                  <Autocomplete
                    options={categoryOptions}
                    value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                    onChange={(val) => field.onChange(val ? Number(val) : null)}
                    placeholder="Chọn danh mục..."
                    searchPlaceholder="Tìm danh mục..."
                    size="sm"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Số lượng <span className="text-semantic-error">*</span>
              </label>
              <Input
                type="number"
                {...register('item.quantity', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 1 : Number(v)),
                })}
                className="text-xs"
              />
              {errors.item?.quantity && (
                <p className="mt-1 text-xs text-semantic-error">{errors.item.quantity.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Đơn giá (VND) <span className="text-semantic-error">*</span>
              </label>
              <Input
                type="number"
                {...register('item.unitPrice', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                })}
                className="text-xs"
              />
              {errors.item?.unitPrice && (
                <p className="mt-1 text-xs text-semantic-error">{errors.item.unitPrice.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Giảm giá dòng (VND)</label>
              <Input
                type="number"
                {...register('item.discount', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                })}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Hoàn tiền (VND)</label>
              <Input
                type="number"
                {...register('item.refundAmount', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                })}
                className="text-xs"
              />
            </div>
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
              {isPending ? 'Đang thêm...' : 'Thêm sản phẩm'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
