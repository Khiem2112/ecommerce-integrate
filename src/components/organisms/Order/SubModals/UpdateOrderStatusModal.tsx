'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderStatusUpdateSchema, type OrderStatusUpdateValues } from '@/forms';
import { useUpdateOrder } from '@/hooks';
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

export type UpdateOrderStatusModalProps = {
  readonly open: boolean;
  readonly order: OrderWithHistory;
  readonly lookups?: OrderLookupOptions;
  readonly onClose: () => void;
  readonly onSaveSuccess?: () => void;
};

export function UpdateOrderStatusModal({
  open,
  order,
  lookups,
  onClose,
  onSaveSuccess,
}: UpdateOrderStatusModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: updateOrder, isPending } = useUpdateOrder();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderStatusUpdateValues>({
    resolver: zodResolver(orderStatusUpdateSchema),
    defaultValues: {
      orderId: order.id,
      statusId: order.currentStatusId,
      changedBy: 'agent',
      note: '',
      updatedAt: String(order.updatedAt),
    },
  });

  const statusOptions: readonly AutocompleteOption[] = useMemo(() => {
    return (lookups?.statuses || []).map((st) => ({
      value: String(st.id),
      label: st.name,
      subLabel: st.isFinal ? 'Trạng thái kết thúc' : undefined,
    }));
  }, [lookups?.statuses]);

  useEffect(() => {
    if (open) {
      reset({
        orderId: order.id,
        statusId: order.currentStatusId,
        changedBy: 'agent',
        note: '',
        updatedAt: String(order.updatedAt),
      });
    }
  }, [open, order, reset]);

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const onSubmit = async (values: OrderStatusUpdateValues) => {
    setErrorMessage(null);
    try {
      await updateOrder({
        id: values.orderId,
        currentStatusId: values.statusId,
        statusChangedBy: values.changedBy,
        statusChangeNote: values.note,
        updatedAt: values.updatedAt,
      });
      onSaveSuccess?.();
      handleClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent hideCloseButton className="max-w-md p-6">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div>
            <DialogTitle className="text-sm font-semibold text-foreground">
              Cập nhật trạng thái đơn hàng
            </DialogTitle>
            <DialogDescription className="text-xs text-muted mt-0.5 font-mono">
              #{order.platformOrderId}
            </DialogDescription>
          </div>
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
              Trạng thái mới <span className="text-semantic-error">*</span>
            </label>
            <Controller
              control={control}
              name="statusId"
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
            {errors.statusId && (
              <p className="mt-1 text-xs text-semantic-error">{errors.statusId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Người thực hiện thay đổi
            </label>
            <Input
              {...register('changedBy')}
              placeholder="VD: agent, system, seller..."
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Ghi chú chuyển trạng thái
            </label>
            <textarea
              {...register('note')}
              rows={3}
              placeholder="Lý do hoặc thông tin cập nhật trạng thái..."
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
      </DialogContent>
    </Dialog>
  );
}
