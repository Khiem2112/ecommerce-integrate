'use client';

import { useMemo, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/atoms';
import { cn } from '@/lib/cn';
import { useDisconnectShopConnection } from '@/hooks';
import {
  getShopConnectionDisconnectSchema,
  type ShopConnectionDisconnectValues,
} from '@/forms';
import type { ShopConnectionDetail, ShopConnectionSummary } from '@/types';

export type ShopConnectionDisconnectFormProps = {
  readonly connection: ShopConnectionSummary | ShopConnectionDetail;
  readonly embedded?: boolean;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
};

export function ShopConnectionDisconnectForm({
  connection,
  embedded = false,
  onSuccess,
  onCancel,
}: ShopConnectionDisconnectFormProps): JSX.Element {
  const t = useTranslations('shops.disconnectDialog');
  const tCommon = useTranslations('common');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const disconnectMutation = useDisconnectShopConnection();

  const schema = useMemo(
    () =>
      getShopConnectionDisconnectSchema({
        invalidConnectionId: t('errors.failed'),
        invalidVersion: t('errors.failed'),
      }),
    [t],
  );

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ShopConnectionDisconnectValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      connectionId: connection.id,
      expectedVersion: connection.version,
    },
  });

  const onSubmit = async (values: ShopConnectionDisconnectValues) => {
    setErrorMsg(null);
    try {
      await disconnectMutation.mutateAsync({
        connectionId: values.connectionId,
        expectedVersion: values.expectedVersion,
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

      <div className="rounded-xl border border-hairline bg-surface-lifted/70 p-3 text-xs text-muted space-y-1">
        <p className="font-semibold text-foreground">{t('consequencesTitle')}</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>{t('consequence1')}</li>
          <li>{t('consequence2')}</li>
          <li>{t('consequence3')}</li>
        </ul>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={disconnectMutation.isPending || isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          variant="destructive"
          type="submit"
          disabled={disconnectMutation.isPending || isSubmitting}
        >
          {disconnectMutation.isPending || isSubmitting ? t('disconnecting') : t('confirm')}
        </Button>
      </div>
    </form>
  );
}
