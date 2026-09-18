'use client';

import { useMemo, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Select, Input, RadioGroup, SelectionCard } from '@/components/atoms';
import { cn } from '@/lib/cn';
import { useManageableOrganizations, useStartShopAuthorization } from '@/hooks';
import {
  getShopConnectionStartAuthorizationSchema,
  type ShopConnectionStartAuthorizationValues,
} from '@/forms';
import type { SupportedShopPlatformCode } from '@/types';

export type ShopConnectionAuthorizationFormProps = {
  readonly defaultPlatform?: SupportedShopPlatformCode;
  readonly fixedOrganizationId?: number;
  readonly fixedOrganizationName?: string;
  readonly reconnectConnectionId?: number;
  readonly embedded?: boolean;
  readonly onSuccess?: (result: { authorizationUrl: string }) => void;
  readonly onCancel?: () => void;
};

export function ShopConnectionAuthorizationForm({
  defaultPlatform = 'lazada',
  fixedOrganizationId,
  fixedOrganizationName,
  reconnectConnectionId,
  embedded = false,
  onSuccess,
  onCancel,
}: ShopConnectionAuthorizationFormProps): JSX.Element {
  const t = useTranslations('shops.connectDialog');
  const tCommon = useTranslations('common');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: manageableOrgs, isLoading: isLoadingOrgs } = useManageableOrganizations();
  const startAuthMutation = useStartShopAuthorization();

  const schema = useMemo(
    () =>
      getShopConnectionStartAuthorizationSchema({
        invalidPlatform: t('errors.failedToStart'),
        organizationRequired: t('errors.missingOrg'),
        invalidShopDomain: t('errors.missingShopDomain'),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShopConnectionStartAuthorizationValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      platformCode: defaultPlatform,
      organizationId: fixedOrganizationId ?? (undefined as unknown as number),
      connectionId: reconnectConnectionId,
      shopDomain: '',
    },
  });

  const currentPlatform = watch('platformCode');
  const selectedOrgId = watch('organizationId');

  const onSubmit = async (values: ShopConnectionStartAuthorizationValues) => {
    setErrorMsg(null);
    try {
      const result = await startAuthMutation.mutateAsync({
        ...values,
        idempotencyKey: `auth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      if (result.authorizationUrl) {
        if (onSuccess) {
          onSuccess(result);
        } else {
          window.location.href = result.authorizationUrl;
        }
      } else {
        setErrorMsg(t('errors.failedToStart'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.failedToStart');
      setErrorMsg(message);
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

      {/* Platform Choice via RadioGroup and SelectionCard */}
      <RadioGroup
        name="platformCode"
        value={currentPlatform}
        label={t('platformLabel')}
        onChange={(val) => setValue('platformCode', val as SupportedShopPlatformCode, { shouldValidate: true })}
        disabled={Boolean(reconnectConnectionId)}
        error={errors.platformCode?.message}
      >
        <div className="grid grid-cols-2 gap-2">
          <SelectionCard
            value="lazada"
            title="Lazada"
            description={t('lazadaDesc')}
            icon="L"
            disabled={Boolean(reconnectConnectionId)}
          />
          <SelectionCard
            value="shopify"
            title="Shopify"
            description={t('shopifyDesc')}
            icon="S"
            disabled={Boolean(reconnectConnectionId)}
          />
        </div>
      </RadioGroup>

      {/* Organization Selection / Locked Display */}
      <div className="space-y-1.5">
        <label htmlFor="shop-auth-org-select" className="text-xs font-semibold text-foreground">
          {t('organizationLabel')}
        </label>
        {fixedOrganizationName ? (
          <div className="rounded-xl border border-hairline bg-surface-lifted px-3.5 py-2.5 text-sm font-medium text-foreground">
            {fixedOrganizationName}
          </div>
        ) : (
          <Select
            id="shop-auth-org-select"
            {...register('organizationId', { valueAsNumber: true })}
            disabled={isLoadingOrgs}
            aria-invalid={Boolean(errors.organizationId)}
            aria-describedby={errors.organizationId ? 'shop-auth-org-error' : undefined}
          >
            <option value="">{t('selectOrgPlaceholder')}</option>
            {manageableOrgs?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.displayName}
              </option>
            ))}
          </Select>
        )}
        {errors.organizationId && (
          <p id="shop-auth-org-error" className="text-xs text-semantic-error" role="alert">
            {errors.organizationId.message}
          </p>
        )}
      </div>

      {/* Shopify domain input if platform === shopify */}
      {currentPlatform === 'shopify' && (
        <div className="space-y-1.5">
          <label htmlFor="shop-domain-input" className="text-xs font-semibold text-foreground">
            {t('shopDomainLabel')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="shop-domain-input"
              {...register('shopDomain')}
              placeholder={t('shopDomainPlaceholder')}
              aria-invalid={Boolean(errors.shopDomain)}
              aria-describedby={errors.shopDomain ? 'shop-domain-error' : undefined}
              rounded={false}
            />
            <span className="text-muted text-xs font-mono shrink-0">.myshopify.com</span>
          </div>
          {errors.shopDomain && (
            <p id="shop-domain-error" className="text-xs text-semantic-error" role="alert">
              {errors.shopDomain.message}
            </p>
          )}
        </div>
      )}

      {/* Handoff Notice */}
      <div className="rounded-xl border border-hairline bg-surface-lifted/70 p-3 text-xs text-muted">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <svg
            aria-hidden="true"
            className="size-3.5 text-primary shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          {t('handoffNoticeTitle')}
        </p>
        <p className="mt-1">{t('handoffNoticeDescription')}</p>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end gap-2 pt-3 border-t border-hairline">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={startAuthMutation.isPending || isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={
            startAuthMutation.isPending ||
            isSubmitting ||
            (!fixedOrganizationId && !selectedOrgId)
          }
        >
          {startAuthMutation.isPending || isSubmitting
            ? t('authorizing')
            : reconnectConnectionId
              ? t('reconnect')
              : t('submit')}
        </Button>
      </div>
    </form>
  );
}
