'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderFormSchema, type OrderFormValues } from '@/forms';
import {
  useDirtyWarning,
  useCreateOrder,
  useUpdateOrder,
  setFlashingId,
} from '@/hooks';
import {
  Button,
  Input,
  IconButton,
  Autocomplete,
  type AutocompleteOption,
} from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import { formatVND } from '@/utils';
import type { OrderLookupOptions, OrderWithHistory } from '@/types';

export type OrderFormProps = {
  readonly mode: 'NEW' | 'EDIT' | 'COPY';
  readonly initialValues?: Partial<OrderFormValues>;
  readonly orderId?: number;
  readonly lookups?: OrderLookupOptions;
  readonly onSaveSuccess?: (order: OrderWithHistory) => void;
};

export function OrderForm({
  mode,
  initialValues,
  orderId,
  lookups,
  onSaveSuccess,
}: OrderFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { mutateAsync: createOrder, isPending: isCreating } = useCreateOrder();
  const { mutateAsync: updateOrder, isPending: isUpdating } = useUpdateOrder();

  const isSubmitting = isCreating || isUpdating;

  const defaultPlatformId = lookups?.platforms[0]?.id ?? 1;
  const defaultStatusId = lookups?.statuses[0]?.id ?? 1;
  const defaultCustomerId = lookups?.customers[0]?.id ?? 1;

  const defaultValues: OrderFormValues = {
    id: initialValues?.id,
    platformId: initialValues?.platformId ?? defaultPlatformId,
    platformOrderId: initialValues?.platformOrderId ?? `ORD-${Date.now().toString().slice(-6)}`,
    customerId: initialValues?.customerId ?? defaultCustomerId,
    currentStatusId: initialValues?.currentStatusId ?? defaultStatusId,
    currency: initialValues?.currency ?? 'VND',
    shippingFee: initialValues?.shippingFee ?? 0,
    discountAmount: initialValues?.discountAmount ?? 0,
    totalValue: initialValues?.totalValue ?? 0,
    cancelReturnInitiator: initialValues?.cancelReturnInitiator,
    cancellationReason: initialValues?.cancellationReason,
    items: initialValues?.items ?? [
      {
        productId: 'PROD-001',
        productName: '',
        sku: '',
        categoryId: lookups?.categories[0]?.id ?? null,
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        refundAmount: 0,
      },
    ],
    updatedAt: initialValues?.updatedAt,
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useDirtyWarning(isDirty);

  // Memoized Lookup Options for Autocomplete
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

  const statusOptions: readonly AutocompleteOption[] = useMemo(() => {
    return (lookups?.statuses || []).map((st) => ({
      value: String(st.id),
      label: st.name,
    }));
  }, [lookups?.statuses]);

  const categoryOptions: readonly AutocompleteOption[] = useMemo(() => {
    return [
      { value: '', label: 'Chưa phân loại' },
      ...(lookups?.categories || []).map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    ];
  }, [lookups?.categories]);

  // Real-time calculation of totalValue
  const watchedItems = watch('items');
  const watchedShippingFee = watch('shippingFee') || 0;
  const watchedDiscount = watch('discountAmount') || 0;

  useEffect(() => {
    const itemsTotal = (watchedItems || []).reduce((acc, item) => {
      const q = Number(item?.quantity) || 0;
      const p = Number(item?.unitPrice) || 0;
      const d = Number(item?.discount) || 0;
      return acc + (q * p - d);
    }, 0);

    const calcTotal = Math.max(0, itemsTotal + Number(watchedShippingFee) - Number(watchedDiscount));
    setValue('totalValue', calcTotal);
  }, [watchedItems, watchedShippingFee, watchedDiscount, setValue]);

  const onSubmit = async (values: OrderFormValues) => {
    setErrorMessage(null);
    try {
      let result: OrderWithHistory;
      if (mode === 'EDIT' && orderId) {
        result = await updateOrder({
          ...values,
          id: orderId,
        });
      } else {
        result = await createOrder(values);
      }

      // Store flashing row key for table highlight
      setFlashingId(result.id);

      if (onSaveSuccess) {
        onSaveSuccess(result);
      } else {
        router.push(`/orders/${result.id}`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu đơn hàng.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {errorMessage && (
        <ErrorBanner
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* 1. Thông tin chung đơn hàng */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-hairline pb-2.5">
          1. Thông tin nền tảng & Khách hàng
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              placeholder="VD: ORD-998811..."
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
                  searchPlaceholder="Tìm kiếm theo Buyer ID..."
                  size="sm"
                />
              )}
            />
            {errors.customerId && (
              <p className="mt-1 text-xs text-semantic-error">{errors.customerId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Trạng thái ban đầu <span className="text-semantic-error">*</span>
            </label>
            <Controller
              control={control}
              name="currentStatusId"
              render={({ field }) => (
                <Autocomplete
                  options={statusOptions}
                  value={field.value ? String(field.value) : ''}
                  onChange={(val) => field.onChange(val ? Number(val) : 0)}
                  placeholder="Chọn trạng thái..."
                  searchPlaceholder="Tìm trạng thái..."
                  size="sm"
                />
              )}
            />
            {errors.currentStatusId && (
              <p className="mt-1 text-xs text-semantic-error">{errors.currentStatusId.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Danh sách sản phẩm (Dynamic Items) */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-2.5">
          <h3 className="text-sm font-semibold text-foreground">
            2. Chi tiết các sản phẩm trong đơn ({fields.length})
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                productId: `PROD-${Date.now().toString().slice(-4)}`,
                productName: '',
                sku: '',
                categoryId: lookups?.categories[0]?.id ?? null,
                quantity: 1,
                unitPrice: 0,
                discount: 0,
                refundAmount: 0,
              })
            }
            icon={
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            Thêm sản phẩm
          </Button>
        </div>

        {errors.items?.root && (
          <p className="text-xs text-semantic-error">{errors.items.root.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => {
            const rowQty = watch(`items.${index}.quantity`) || 0;
            const rowPrice = watch(`items.${index}.unitPrice`) || 0;
            const rowDiscount = watch(`items.${index}.discount`) || 0;
            const rowTotal = Math.max(0, rowQty * rowPrice - rowDiscount);

            return (
              <div
                key={field.id}
                className="relative rounded-lg border border-hairline bg-surface-lifted/40 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
                  <span className="font-mono text-xs font-medium text-foreground">
                    Mặt hàng #{index + 1}
                  </span>
                  {fields.length > 1 && (
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      ariaLabel="Xóa dòng"
                      onClick={() => remove(index)}
                      className="text-muted hover:text-semantic-error"
                    >
                      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </IconButton>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">
                      Mã sản phẩm (ID) <span className="text-semantic-error">*</span>
                    </label>
                    <Input
                      {...register(`items.${index}.productId`)}
                      placeholder="VD: PROD-101"
                      className="text-xs"
                    />
                    {errors.items?.[index]?.productId && (
                      <p className="mt-0.5 text-xs text-semantic-error">
                        {errors.items[index]?.productId?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">
                      Tên sản phẩm <span className="text-semantic-error">*</span>
                    </label>
                    <Input
                      {...register(`items.${index}.productName`)}
                      placeholder="VD: Chuột không dây Logitech..."
                      className="text-xs"
                    />
                    {errors.items?.[index]?.productName && (
                      <p className="mt-0.5 text-xs text-semantic-error">
                        {errors.items[index]?.productName?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">SKU</label>
                    <Input
                      {...register(`items.${index}.sku`)}
                      placeholder="VD: SKU-MS-01"
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">Danh mục</label>
                    <Controller
                      control={control}
                      name={`items.${index}.categoryId`}
                      render={({ field: catField }) => (
                        <Autocomplete
                          options={categoryOptions}
                          value={catField.value !== null && catField.value !== undefined ? String(catField.value) : ''}
                          onChange={(val) => catField.onChange(val ? Number(val) : null)}
                          placeholder="Chọn danh mục..."
                          searchPlaceholder="Tìm danh mục..."
                          size="sm"
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">
                      Số lượng <span className="text-semantic-error">*</span>
                    </label>
                    <Input
                      type="number"
                      {...register(`items.${index}.quantity`, {
                        setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                      })}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">
                      Đơn giá (VND) <span className="text-semantic-error">*</span>
                    </label>
                    <Input
                      type="number"
                      {...register(`items.${index}.unitPrice`, {
                        setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                      })}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">Giảm giá dòng</label>
                    <Input
                      type="number"
                      {...register(`items.${index}.discount`, {
                        setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
                      })}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted mb-0.5">Thành tiền dòng</label>
                    <div className="flex h-9 items-center rounded-md bg-surface-card px-3 font-mono text-xs font-semibold text-foreground border border-hairline">
                      {formatVND(rowTotal)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Vận chuyển, giảm giá & Tổng tiền */}
      <div className="rounded-xl border border-hairline bg-surface-card p-5 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-hairline pb-2.5">
          3. Thanh toán & Vận chuyển
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Tổng mã giảm giá (VND) <span className="text-semantic-error">*</span>
            </label>
            <Input
              type="number"
              {...register('discountAmount', {
                setValueAs: (v) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v)),
              })}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Tổng giá trị đơn hàng (Tự động tính)
            </label>
            <div className="flex h-9 items-center justify-between rounded-md bg-surface-lifted px-3.5 font-mono text-sm font-bold text-foreground border border-hairline">
              <span>Tổng cộng:</span>
              <span className="text-primary">{formatVND(watch('totalValue') || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 rounded-xl border border-hairline bg-surface-card p-4 shadow-card">
        <Link href={orderId ? `/orders/${orderId}` : '/orders'}>
          <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
            Hủy bỏ
          </Button>
        </Link>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : mode === 'EDIT' ? 'Cập nhật đơn hàng' : 'Tạo đơn hàng'}
        </Button>
      </div>
    </form>
  );
}
