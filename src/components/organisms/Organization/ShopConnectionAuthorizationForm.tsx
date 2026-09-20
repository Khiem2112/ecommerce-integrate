'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Combobox, type ComboboxItem, Input, RadioGroup, RadioGroupItem } from '@/components/atoms';
import { cn } from '@/lib/cn';
import {
  useConnectLazadaSandboxShop,
  useManageableOrganizations,
  useOAuthPopup,
  useStartShopAuthorization,
} from '@/hooks';
import {
  getShopConnectionStartAuthorizationSchema,
  type ShopConnectionStartAuthorizationValues,
} from '@/forms';
import type { ShopAuthMethod, ShopEnvironment, SupportedShopPlatformCode } from '@/types';
import { LazadaSelectionCard } from './LazadaSelectionCard';
import { ShopifySelectionCard } from './ShopifySelectionCard';

export type ShopConnectionAuthorizationFormProps = {
  readonly defaultPlatform?: SupportedShopPlatformCode;
  readonly fixedOrganizationId?: number;
  readonly fixedOrganizationName?: string;
  readonly reconnectConnectionId?: number;
  readonly embedded?: boolean;
  readonly onAuthorizationStarted?: (result: { authorizationUrl: string }) => void;
  readonly onSuccess?: (result: { authorizationUrl: string }) => void;
  readonly onCancel?: () => void;
};

export function ShopConnectionAuthorizationForm({
  defaultPlatform = 'lazada',
  fixedOrganizationId,
  fixedOrganizationName,
  reconnectConnectionId,
  embedded = false,
  onAuthorizationStarted,
  onSuccess,
  onCancel,
}: ShopConnectionAuthorizationFormProps): JSX.Element {
  const t = useTranslations('shops.connectDialog');
  const tCommon = useTranslations('common');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isFixedOrg = Boolean(fixedOrganizationId);
  const { data: manageableOrgs, isLoading: isLoadingOrgs } = useManageableOrganizations({
    enabled: !isFixedOrg,
  });
  const startAuthMutation = useStartShopAuthorization();
  const connectSandboxMutation = useConnectLazadaSandboxShop();
  const { preparePopup, navigatePopup, closePopup } = useOAuthPopup();

  const schema = useMemo(
    () =>
      getShopConnectionStartAuthorizationSchema({
        invalidPlatform: t('errors.failedToStart'),
        organizationRequired: t('errors.missingOrg'),
        invalidShopDomain: t('errors.missingShopDomain'),
        sandboxTokenRequired: t('errors.missingSandboxToken'),
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
      environment: 'production',
      authMethod: 'oauth',
      sandboxAccessToken: '',
      sandboxShopName: '',
    },
  });

  const currentPlatform = watch('platformCode');
  const currentEnvironment: ShopEnvironment = watch('environment') ?? 'production';
  const currentAuthMethod: ShopAuthMethod = watch('authMethod') ?? 'oauth';
  const selectedOrgId = watch('organizationId');

  useEffect(() => {
    if (fixedOrganizationId) {
      setValue('organizationId', fixedOrganizationId, { shouldValidate: true });
    }
  }, [fixedOrganizationId, setValue]);

  const orgItems: readonly ComboboxItem[] = useMemo(
    () =>
      manageableOrgs?.map((org) => ({
        value: String(org.id),
        label: org.displayName,
      })) ?? [],
    [manageableOrgs],
  );

  const onSubmit = async (values: ShopConnectionStartAuthorizationValues) => {
    setErrorMsg(null);

    // If sandbox mode with manual token entry: directly save connection via server action
    if (
      values.platformCode === 'lazada' &&
      values.environment === 'sandbox' &&
      values.authMethod === 'manual_token'
    ) {
      try {
        await connectSandboxMutation.mutateAsync(values);
        onSuccess?.({ authorizationUrl: '' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('errors.failedToStart');
        setErrorMsg(message);
      }
      return;
    }

    // Standard OAuth flow (used for production and for sandbox OAuth):
    preparePopup();

    try {
      const normalizedValues: ShopConnectionStartAuthorizationValues = {
        ...values,
        shopDomain:
          values.platformCode === 'shopify' && values.shopDomain?.trim()
            ? values.shopDomain.trim()
            : undefined,
        idempotencyKey: `auth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };

      const result = await startAuthMutation.mutateAsync(normalizedValues);

      if (result.authorizationUrl) {
        navigatePopup(result.authorizationUrl);

        const handleStarted = onAuthorizationStarted ?? onSuccess;
        handleStarted?.(result);
      } else {
        closePopup();
        setErrorMsg(t('errors.failedToStart'));
      }
    } catch (err: unknown) {
      closePopup();
      const message = err instanceof Error ? err.message : t('errors.failedToStart');
      setErrorMsg(message);
    }
  };

  const isActionLoading =
    startAuthMutation.isPending || connectSandboxMutation.isPending || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className={cn('space-y-6', embedded && 'pt-1.5')}>
      {errorMsg && (
        <div
          className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3.5 text-xs text-semantic-error"
          role="alert"
        >
          {errorMsg}
        </div>
      )}

      {/* Organization Selection (Visible only to Admin tổng / when organization is not fixed) */}
      {!isFixedOrg && (
        <div className="space-y-2">
          <label htmlFor="shop-auth-org-combobox" className="text-xs font-semibold text-foreground block">
            {t('organizationLabel')} <span className="text-semantic-error">*</span>
          </label>
          <div id="shop-auth-org-combobox">
            <Combobox
              items={orgItems}
              value={selectedOrgId ? String(selectedOrgId) : ''}
              onChange={(val) => {
                setValue(
                  'organizationId',
                  val ? Number(val) : (undefined as unknown as number),
                  {
                    shouldValidate: true,
                    shouldDirty: true,
                  },
                );
              }}
              placeholder={t('selectOrgPlaceholder')}
              disabled={isLoadingOrgs || orgItems.length === 0}
              size="md"
              ariaLabel={t('organizationLabel')}
            />
          </div>
          {errors.organizationId && (
            <p id="shop-auth-org-error" className="text-xs text-semantic-error" role="alert">
              {errors.organizationId.message}
            </p>
          )}
        </div>
      )}

      {/* Platform Selection with Dedicated Cards */}
      <div className="space-y-2.5">
        <RadioGroup
          name="platformCode"
          value={currentPlatform}
          label={t('platformLabel')}
          onChange={(val) =>
            setValue('platformCode', val as SupportedShopPlatformCode, { shouldValidate: true })
          }
          disabled={Boolean(reconnectConnectionId)}
          error={errors.platformCode?.message}
        >
          <div className="grid grid-cols-2 gap-3 pt-1">
            <LazadaSelectionCard
              isSelected={currentPlatform === 'lazada'}
              disabled={Boolean(reconnectConnectionId)}
              environment={currentEnvironment}
              onEnvironmentChange={(env) => setValue('environment', env, { shouldValidate: true })}
              onSelect={() => setValue('platformCode', 'lazada', { shouldValidate: true })}
            />
            <ShopifySelectionCard
              isSelected={currentPlatform === 'shopify'}
              disabled={Boolean(reconnectConnectionId)}
              onSelect={() => setValue('platformCode', 'shopify', { shouldValidate: true })}
            />
          </div>
        </RadioGroup>
      </div>

      {/* Shopify domain input if platform === shopify */}
      {currentPlatform === 'shopify' && (
        <div className="space-y-2 pt-1">
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

      {/* Sandbox Connection Options if platform === lazada && environment === sandbox */}
      {currentPlatform === 'lazada' && currentEnvironment === 'sandbox' && (
        <div className="space-y-4 rounded-xl border border-hairline bg-surface-lifted/60 p-4 animate-in fade-in-50 duration-150">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground block">
              {t('authMethodLabel')}
            </span>
            <RadioGroup
              name="authMethod"
              value={currentAuthMethod}
              onChange={(val) =>
                setValue('authMethod', val as ShopAuthMethod, { shouldValidate: true })
              }
              className="flex flex-col gap-2.5 pt-1"
            >
              <RadioGroupItem
                value="oauth"
                label={t('authMethodOAuth')}
              />
              <RadioGroupItem
                value="manual_token"
                label={t('authMethodManual')}
              />
            </RadioGroup>
          </div>

          {currentAuthMethod === 'manual_token' && (
            <div className="space-y-3.5 pt-3.5 border-t border-hairline animate-in fade-in-50 duration-150">
              <div className="space-y-2">
                <label htmlFor="sandbox-token-input" className="text-xs font-semibold text-foreground">
                  {t('sandboxTokenLabel')} <span className="text-semantic-error">*</span>
                </label>
                <Input
                  id="sandbox-token-input"
                  {...register('sandboxAccessToken')}
                  placeholder={t('sandboxTokenPlaceholder')}
                  aria-invalid={Boolean(errors.sandboxAccessToken)}
                  aria-describedby={errors.sandboxAccessToken ? 'sandbox-token-error' : undefined}
                />
                {errors.sandboxAccessToken && (
                  <p id="sandbox-token-error" className="text-xs text-semantic-error" role="alert">
                    {errors.sandboxAccessToken.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="sandbox-shop-name-input" className="text-xs font-semibold text-foreground">
                  {t('sandboxShopNameLabel')}
                </label>
                <Input
                  id="sandbox-shop-name-input"
                  {...register('sandboxShopName')}
                  placeholder={t('sandboxShopNamePlaceholder')}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guidance Notice */}
      <div className="rounded-xl border border-hairline bg-surface-lifted/70 p-3.5 text-xs text-muted space-y-1">
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
          {currentPlatform === 'lazada' && currentEnvironment === 'sandbox'
            ? currentAuthMethod === 'manual_token'
              ? t('sandboxNoticeTitle')
              : t('sandboxOAuthNoticeTitle')
            : t('handoffNoticeTitle')}
        </p>
        <p className="mt-1 leading-relaxed">
          {currentPlatform === 'lazada' && currentEnvironment === 'sandbox'
            ? currentAuthMethod === 'manual_token'
              ? t('sandboxNoticeDescription')
              : t('sandboxOAuthNoticeDescription')
            : t('handoffNoticeDescription')}
        </p>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end gap-2.5 pt-4 border-t border-hairline">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={isActionLoading}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isActionLoading || (!fixedOrganizationId && !selectedOrgId)}
        >
          {isActionLoading
            ? currentPlatform === 'lazada' &&
              currentEnvironment === 'sandbox' &&
              currentAuthMethod === 'manual_token'
              ? t('connectingSandbox')
              : t('connecting')
            : currentPlatform === 'lazada' &&
              currentEnvironment === 'sandbox' &&
              currentAuthMethod === 'manual_token'
              ? t('connectSandbox')
              : reconnectConnectionId
                ? t('reconnect')
                : t('submit')}
        </Button>
      </div>
    </form>
  );
}
