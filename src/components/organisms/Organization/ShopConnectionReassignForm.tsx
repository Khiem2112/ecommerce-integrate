'use client';

import { useMemo, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Combobox, type ComboboxItem } from '@/components/atoms';
import { cn } from '@/lib/cn';
import {
  useManageableOrganizations,
  useReassignShopConnection,
} from '@/hooks';
import {
  getShopConnectionReassignSchema,
  type ShopConnectionReassignValues,
} from '@/forms';
import type { ShopConnectionDetail, ShopConnectionSummary } from '@/types';

export type ShopConnectionReassignFormProps = {
  readonly connection: ShopConnectionSummary | ShopConnectionDetail;
  readonly embedded?: boolean;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
};

export function ShopConnectionReassignForm({
  connection,
  embedded = false,
  onSuccess,
  onCancel,
}: ShopConnectionReassignFormProps): JSX.Element {
  const t = useTranslations('shops.reassignDialog');
  const tCommon = useTranslations('common');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: manageableOrgs, isLoading: isLoadingOrgs } = useManageableOrganizations();
  const reassignMutation = useReassignShopConnection();

  const availableOrgs = manageableOrgs?.filter((o) => o.id !== connection.organizationId) ?? [];

  const schema = useMemo(
    () =>
      getShopConnectionReassignSchema({
        targetOrganizationRequired: t('errors.missingTargetOrg'),
        invalidVersion: t('errors.failed'),
      }),
    [t],
  );

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ShopConnectionReassignValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      connectionId: connection.id,
      targetOrganizationId: undefined,
      expectedVersion: connection.version,
    },
  });

  const selectedTargetOrgId = watch('targetOrganizationId');

  const orgItems: readonly ComboboxItem[] = useMemo(
    () =>
      availableOrgs.map((org) => ({
        value: String(org.id),
        label: org.displayName,
      })),
    [availableOrgs],
  );

  const onSubmit = async (values: ShopConnectionReassignValues) => {
    setErrorMsg(null);
    try {
      await reassignMutation.mutateAsync({
        connectionId: connection.id,
        targetOrganizationId: values.targetOrganizationId,
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

      {/* Warning if sync batches queued/running */}
      {connection.syncBatchCount > 0 && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-status-warning">
          <p className="font-semibold">{t('syncWarningTitle')}</p>
          <p className="mt-0.5">{t('syncWarningDescription')}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="shop-reassign-org-combobox" className="text-xs font-semibold text-foreground block">
          {t('targetOrgLabel')}
        </label>
        <div id="shop-reassign-org-combobox">
          <Combobox
            items={orgItems}
            value={selectedTargetOrgId ? String(selectedTargetOrgId) : ''}
            onChange={(val) => {
              setValue(
                'targetOrganizationId',
                val ? Number(val) : (undefined as unknown as number),
                {
                  shouldValidate: true,
                  shouldDirty: true,
                },
              );
            }}
            placeholder={t('selectTargetOrgPlaceholder')}
            disabled={isLoadingOrgs || availableOrgs.length === 0}
            size="md"
            ariaLabel={t('targetOrgLabel')}
          />
        </div>
        {errors.targetOrganizationId && (
          <p id="shop-reassign-org-error" className="text-xs text-semantic-error" role="alert">
            {errors.targetOrganizationId.message}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-lifted/70 p-3 text-xs text-muted space-y-1">
        <p className="font-semibold text-foreground">{t('dataTransferNoticeTitle')}</p>
        <p>{t('dataTransferNotice')}</p>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={reassignMutation.isPending || isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={reassignMutation.isPending || isSubmitting || !selectedTargetOrgId}
        >
          {reassignMutation.isPending || isSubmitting ? t('reassigning') : t('confirm')}
        </Button>
      </div>
    </form>
  );
}
