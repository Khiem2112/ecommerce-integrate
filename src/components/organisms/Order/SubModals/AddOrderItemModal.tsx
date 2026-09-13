'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { addOrderItemSchema, type AddOrderItemValues } from '@/forms';
import { useAddOrderItem } from '@/hooks';
import {
  Button,
  Input,
  IconButton,
  Autocomplete,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
  const t = useTranslations('orders.modals.addOrderItem');
  const tc = useTranslations('common');
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
    { value: '', label: t('uncategorized') },
    ...(lookups?.categories || []).map((c) => ({
      value: String(c.id),
      label: c.name,
    })),
  ], [lookups?.categories, t]);

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
      setErrorMessage(err instanceof Error ? err.message : t('addFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent hideCloseButton className="max-w-lg p-6">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted mt-0.5 font-mono">
              #{order.platformOrderId}
            </DialogDescription>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            ariaLabel={tc('close')}
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
                {t('productId')} <span className="text-semantic-error">*</span>
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
              <label className="block text-xs font-medium text-muted mb-1">{t('sku')}</label>
              <Input
                {...register('item.sku')}
                placeholder="VD: SKU-BLK-M"
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {t('productName')} <span className="text-semantic-error">*</span>
            </label>
            <Input
              {...register('item.productName')}
              placeholder={t('productNamePlaceholder')}
              className="text-xs"
            />
            {errors.item?.productName && (
              <p className="mt-1 text-xs text-semantic-error">{errors.item.productName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {t('category')}
              </label>
              <Controller
                control={control}
                name="item.categoryId"
                render={({ field }) => (
                  <Autocomplete
                    options={categoryOptions}
                    value={field.value !== null && field.value !== undefined ? String(field.value) : ''}
                    onChange={(val) => field.onChange(val ? Number(val) : null)}
                    placeholder={t('selectCategory')}
                    searchPlaceholder={t('searchCategory')}
                    size="sm"
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                {t('quantity')} <span className="text-semantic-error">*</span>
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
                {t('unitPrice')} <span className="text-semantic-error">*</span>
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
              <label className="block text-xs font-medium text-muted mb-1">{t('discount')}</label>
              <Input
                type="number"
                {...register('item.discount', {
                  setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                })}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">{t('refundAmount')}</label>
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
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isPending}
            >
              {isPending ? t('adding') : t('add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
