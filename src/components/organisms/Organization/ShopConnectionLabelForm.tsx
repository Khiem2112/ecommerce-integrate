'use client';

import { useMemo, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@/components/atoms';
import { cn } from '@/lib/cn';
import { useUpdateShopConnectionLabel } from '@/hooks';
import {
  getShopConnectionLabelUpdateSchema,
  type ShopConnectionLabelUpdateValues,
} from '@/forms';
import type { ShopConnectionDetail, ShopConnectionSummary } from '@/types';

export type ShopConnectionLabelFormProps = {
  readonly connection: ShopConnectionSummary | ShopConnectionDetail;
  readonly embedded?: boolean;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
};

export function ShopConnectionLabelForm({
  connection,
  embedded = false,
  onSuccess,
  onCancel,
}: ShopConnectionLabelFormProps): JSX.Element {
  const t = useTranslations('shops.labelDialog');
  const tCommon = useTranslations('common');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateMutation = useUpdateShopConnectionLabel();

  const schema = useMemo(
    () =>
      getShopConnectionLabelUpdateSchema({
        emptyLabel: t('errors.emptyLabel'),
        invalidVersion: t('errors.failed'),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShopConnectionLabelUpdateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      connectionId: connection.id,
      displayLabel: connection.displayLabel ?? connection.shopName ?? '',
      expectedVersion: connection.version,
    },
  });

  const onSubmit = async (values: ShopConnectionLabelUpdateValues) => {
    setErrorMsg(null);
    try {
      await updateMutation.mutateAsync({
        connectionId: connection.id,
        displayLabel: values.displayLabel.trim(),
        expectedVersion: connection.version,
      });
      onSuccess?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('errors.failed'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn('space-y-4', embedded && 'pt-1')}>
      {errorMsg && (
        <div
          className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3 text-xs text-semantic-error"
          role="alert"
        >
          {errorMsg}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="shop-label-input" className="text-xs font-semibold text-foreground">
          {t('inputLabel')}
        </label>
        <Input
          id="shop-label-input"
          {...register('displayLabel')}
          placeholder={connection.shopName ?? t('inputPlaceholder')}
          aria-invalid={Boolean(errors.displayLabel)}
          aria-describedby={errors.displayLabel ? 'shop-label-error' : undefined}
          rounded={false}
        />
        {errors.displayLabel && (
          <p id="shop-label-error" className="text-xs text-semantic-error" role="alert">
            {errors.displayLabel.message}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={updateMutation.isPending || isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={updateMutation.isPending || isSubmitting}>
          {updateMutation.isPending || isSubmitting ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </form>
  );
}
