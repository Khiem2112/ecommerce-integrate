'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Combobox, type ComboboxItem, Input, RadioGroup, RadioGroupItem } from '@/components/atoms';
import { cn } from '@/lib/cn';
import {
  useConnectLazadaSandboxShop,
  useManageableOrganizations,
  useOAuthPopup,
  useStartShopAuthorization,
  useUpdateShopConnectionLabel,
  useToast,
} from '@/hooks';
import {
  getShopConnectionStartAuthorizationSchema,
  type ShopConnectionStartAuthorizationValues,
} from '@/forms';
import type {
  ShopAuthMethod,
  ShopConnectionAuthState,
  ShopConnectionStepperStep,
  ShopEnvironment,
  ShopOAuthCallbackMessage,
  ShopVerifiedIdentity,
  SupportedShopPlatformCode,
} from '@/types';
import { LazadaSelectionCard } from './LazadaSelectionCard';
import { ShopifySelectionCard } from './ShopifySelectionCard';
import { ShopConnectionVerifiedCard } from './ShopConnectionVerifiedCard';

export type ShopConnectionAuthorizationFormProps = {
  readonly defaultPlatform?: SupportedShopPlatformCode;
  readonly fixedOrganizationId?: number;
  readonly fixedOrganizationName?: string;
  readonly reconnectConnectionId?: number;
  readonly embedded?: boolean;
  readonly currentStep?: ShopConnectionStepperStep;
  readonly onStepChange?: (step: ShopConnectionStepperStep) => void;
  readonly authState?: ShopConnectionAuthState;
  readonly onAuthStateChange?: (state: ShopConnectionAuthState) => void;
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
  currentStep: controlledStep,
  onStepChange: controlledOnStepChange,
  authState: controlledAuthState,
  onAuthStateChange: controlledOnAuthStateChange,
  onAuthorizationStarted,
  onSuccess,
  onCancel,
}: ShopConnectionAuthorizationFormProps): JSX.Element {
  const t = useTranslations('shops.connectDialog');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [internalStep, setInternalStep] = useState<ShopConnectionStepperStep>(1);
  const currentStep = controlledStep ?? internalStep;
  const setStep = (step: ShopConnectionStepperStep) => {
    setInternalStep(step);
    controlledOnStepChange?.(step);
  };

  const [internalAuthState, setInternalAuthState] = useState<ShopConnectionAuthState>('idle');
  const authState = controlledAuthState ?? internalAuthState;
  const setAuthState = (state: ShopConnectionAuthState) => {
    setInternalAuthState(state);
    controlledOnAuthStateChange?.(state);
  };

  const [verifiedIdentity, setVerifiedIdentity] = useState<ShopVerifiedIdentity | null>(null);
  const [customDisplayLabel, setCustomDisplayLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const isFixedOrg = Boolean(fixedOrganizationId);
  const { data: manageableOrgs, isLoading: isLoadingOrgs } = useManageableOrganizations({
    enabled: !isFixedOrg,
  });
  const startAuthMutation = useStartShopAuthorization();
  const connectSandboxMutation = useConnectLazadaSandboxShop();
  const updateLabelMutation = useUpdateShopConnectionLabel();

  const handleOAuthMessage = (message: ShopOAuthCallbackMessage) => {
    if (message.type === 'OMNICART_SHOP_AUTH_SUCCESS') {
      const identity: ShopVerifiedIdentity = {
        connectionId: message.connectionId ?? 0,
        platformCode: (message.platformCode as SupportedShopPlatformCode) ?? watch('platformCode'),
        platformName: message.platformCode === 'shopify' ? 'Shopify' : 'Lazada',
        externalShopId: message.externalShopId ?? '',
        shopName: message.shopName ?? '',
        tokenExpiresAt: message.tokenExpiresAt ?? null,
        refreshTokenExpiresAt: null,
      };
      setVerifiedIdentity(identity);
      setCustomDisplayLabel(message.shopName ?? '');
      setAuthState('verified');
      setErrorMsg(null);
    } else if (message.type === 'OMNICART_SHOP_AUTH_ERROR') {
      setAuthState('error');
      setErrorMsg(message.error ?? t('errors.failedToStart'));
    }
  };

  const { preparePopup, navigatePopup, closePopup } = useOAuthPopup({
    onOAuthMessage: handleOAuthMessage,
    onPopupClosed: () => {
      setInternalAuthState((prev) => {
        if (prev === 'authenticating') {
          controlledOnAuthStateChange?.('idle');
          return 'idle';
        }
        return prev;
      });
    },
  });

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
    trigger,
    setError,
    formState: { errors },
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
  const shopDomainValue = watch('shopDomain');

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

  const selectedOrgName = useMemo(() => {
    if (fixedOrganizationName) return fixedOrganizationName;
    const match = manageableOrgs?.find((org) => org.id === selectedOrgId);
    return match ? match.displayName : '';
  }, [fixedOrganizationName, manageableOrgs, selectedOrgId]);

  // Step 1: Advance to Step 2 with validation gate
  const handleGoToStep2 = async () => {
    setErrorMsg(null);
    const valid = await trigger([
      'organizationId',
      'platformCode',
      'shopDomain',
      'sandboxAccessToken',
    ]);

    if (!valid) return;

    if (currentPlatform === 'shopify') {
      const domain = shopDomainValue?.trim();
      if (!domain) {
        setError('shopDomain', {
          type: 'manual',
          message: t('errors.missingShopDomain'),
        });
        return;
      }
    }

    setStep(2);
  };

  // Step 2: Trigger OAuth window
  const handleTriggerOAuth = async () => {
    setErrorMsg(null);
    setAuthState('authenticating');
    preparePopup();

    try {
      const values = watch();
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
        setAuthState('error');
        setErrorMsg(t('errors.failedToStart'));
      }
    } catch (err: unknown) {
      closePopup();
      setAuthState('error');
      const message = err instanceof Error ? err.message : t('errors.failedToStart');
      setErrorMsg(message);
    }
  };

  // Step 2: Trigger Sandbox Manual Token connection
  const handleConnectSandboxManual = async () => {
    setErrorMsg(null);
    setAuthState('authenticating');

    try {
      const values = watch();
      const result = await connectSandboxMutation.mutateAsync(values);
      const identity: ShopVerifiedIdentity = {
        connectionId: result.id,
        platformCode: 'lazada',
        platformName: result.platformName || 'Lazada',
        externalShopId: result.externalShopId ?? '',
        shopName: result.shopName ?? '',
        tokenExpiresAt: result.tokenExpiresAt
          ? new Date(result.tokenExpiresAt).toISOString()
          : null,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt
          ? new Date(result.refreshTokenExpiresAt).toISOString()
          : null,
      };
      setVerifiedIdentity(identity);
      setCustomDisplayLabel(result.displayLabel || result.shopName || '');
      setAuthState('verified');
    } catch (err: unknown) {
      setAuthState('error');
      const message = err instanceof Error ? err.message : t('errors.failedToStart');
      setErrorMsg(message);
    }
  };

  // Step 2: Finish connection (update displayLabel, invalidate queries, show toast)
  const handleFinishConnection = async () => {
    if (!verifiedIdentity) return;

    setIsFinishing(true);
    const finalLabel = customDisplayLabel.trim() || verifiedIdentity.shopName;

    try {
      if (verifiedIdentity.connectionId) {
        await updateLabelMutation.mutateAsync({
          connectionId: verifiedIdentity.connectionId,
          displayLabel: finalLabel,
          expectedVersion: 1,
        });
      }
    } catch (err) {
      console.warn('Failed to update display label during finalize:', err);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['shop-connections', 'stats'] });
      toast.success(t('step2.successToast', { displayLabel: finalLabel }));
      setIsFinishing(false);
      onCancel?.();
    }
  };

  // Dev prototype helper: simulate immediate OAuth verification
  const handleSimulateOAuth = () => {
    setAuthState('authenticating');
    setTimeout(() => {
      const isLaz = currentPlatform === 'lazada';
      const mockIdentity: ShopVerifiedIdentity = {
        connectionId: 9999,
        platformCode: currentPlatform,
        platformName: isLaz ? 'Lazada' : 'Shopify',
        externalShopId: isLaz
          ? `VN_${Math.floor(10000000 + Math.random() * 90000000)}`
          : `${shopDomainValue || 'omnicart'}.myshopify.com`,
        shopName: isLaz ? 'Lazada Flagship Store Vietnam' : `${shopDomainValue || 'OmniCart'} Official Store`,
        tokenExpiresAt: isLaz
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        refreshTokenExpiresAt: null,
      };
      setVerifiedIdentity(mockIdentity);
      setCustomDisplayLabel(
        isLaz ? t('step2.displayLabelPlaceholder') : 'Shopify Store',
      );
      setAuthState('verified');
    }, 750);
  };

  const isLazadaSandboxManual =
    currentPlatform === 'lazada' &&
    currentEnvironment === 'sandbox' &&
    currentAuthMethod === 'manual_token';

  return (
    <form
      onSubmit={handleSubmit(() => {})}
      noValidate
      className={cn('space-y-6', embedded && 'pt-1')}
    >
      {errorMsg && (
        <div
          className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-3.5 text-xs text-semantic-error"
          role="alert"
        >
          {errorMsg}
        </div>
      )}

      {/* STEP 1: CHANNEL SETUP & SCOPE */}
      {currentStep === 1 && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Organization Selection (Super Admin) */}
          {!isFixedOrg && (
            <div className="space-y-1.5">
              <label
                htmlFor="shop-auth-org-combobox"
                className="text-xs font-bold text-ink-black flex items-center justify-between"
              >
                <span>
                  {t('organizationLabel')} <span className="text-signal-orange">*</span>
                </span>
                <span className="text-[11px] font-normal text-slate-gray">
                  {t('step1.adminOnlyBadge')}
                </span>
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

          {/* Platform Selection Cards */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink-black block">
              {t('platformLabel')} <span className="text-signal-orange">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <LazadaSelectionCard
                isSelected={currentPlatform === 'lazada'}
                disabled={Boolean(reconnectConnectionId)}
                environment={currentEnvironment}
                onEnvironmentChange={(env) =>
                  setValue('environment', env, { shouldValidate: true })
                }
                onSelect={() =>
                  setValue('platformCode', 'lazada', { shouldValidate: true })
                }
              />
              <ShopifySelectionCard
                isSelected={currentPlatform === 'shopify'}
                disabled={Boolean(reconnectConnectionId)}
                onSelect={() =>
                  setValue('platformCode', 'shopify', { shouldValidate: true })
                }
              />
            </div>
            {errors.platformCode && (
              <p className="text-xs text-semantic-error" role="alert">
                {errors.platformCode.message}
              </p>
            )}
          </div>

          {/* Shopify Domain Input if platform === shopify */}
          {currentPlatform === 'shopify' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <label
                htmlFor="shop-domain-input"
                className="text-xs font-bold text-ink-black block"
              >
                {t('shopDomainLabel')} <span className="text-signal-orange">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="shop-domain-input"
                  {...register('shopDomain')}
                  placeholder={t('shopDomainPlaceholder')}
                  aria-invalid={Boolean(errors.shopDomain)}
                  aria-describedby={errors.shopDomain ? 'shop-domain-error' : undefined}
                />
                <span className="text-xs font-mono text-slate-gray px-3 py-2.5 rounded-xl bg-canvas border border-border-subtle shrink-0">
                  .myshopify.com
                </span>
              </div>
              <p className="text-[11px] text-slate-gray">
                {t('step1.shopifyDomainHint')}
              </p>
              {errors.shopDomain && (
                <p id="shop-domain-error" className="text-xs text-semantic-error" role="alert">
                  {errors.shopDomain.message}
                </p>
              )}
            </div>
          )}

          {/* Lazada Sandbox Options */}
          {currentPlatform === 'lazada' && currentEnvironment === 'sandbox' && (
            <div className="p-4 rounded-2xl border border-warning-border bg-warning-soft/60 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-2 text-status-warning font-bold text-xs">
                <svg
                  aria-hidden="true"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{t('sandboxNoticeTitle')}</span>
              </div>

              <div className="space-y-2">
                <RadioGroup
                  name="authMethod"
                  value={currentAuthMethod}
                  onChange={(val) =>
                    setValue('authMethod', val as ShopAuthMethod, { shouldValidate: true })
                  }
                  className="flex gap-4 text-xs pt-1"
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
                <div className="pt-2 border-t border-warning-border/50 space-y-2 animate-in fade-in-50 duration-150">
                  <div>
                    <label
                      htmlFor="sandbox-token-input"
                      className="text-[11px] font-bold text-ink-black block mb-1"
                    >
                      {t('sandboxTokenLabel')} <span className="text-signal-orange">*</span>
                    </label>
                    <Input
                      id="sandbox-token-input"
                      {...register('sandboxAccessToken')}
                      placeholder={t('sandboxTokenPlaceholder')}
                      aria-invalid={Boolean(errors.sandboxAccessToken)}
                    />
                    {errors.sandboxAccessToken && (
                      <p className="text-xs text-semantic-error mt-1" role="alert">
                        {errors.sandboxAccessToken.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="sandbox-shop-name-input"
                      className="text-[11px] font-bold text-ink-black block mb-1"
                    >
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

          {/* Guidance Alert */}
          <div className="p-3.5 rounded-2xl bg-canvas border border-border-subtle flex items-start gap-2.5 text-xs text-slate-gray">
            <svg
              aria-hidden="true"
              className="size-4 text-ink-black shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{t('step1.guidanceNotice')}</span>
          </div>

          {/* Step 1 Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <Button
              variant="outline"
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-xs font-bold text-slate-gray hover:text-ink-black"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleGoToStep2}
              className="rounded-full px-5 py-2 text-xs font-bold bg-ink-black hover:bg-charcoal text-white inline-flex items-center gap-1.5 shadow-atmospheric"
            >
              <span>{t('step1.nextButton')}</span>
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: AUTHORIZE & IDENTITY */}
      {currentStep === 2 && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Summary Pill */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-border-subtle text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-gray">{t('step2.channelSummary')}:</span>
              <span className="font-bold text-ink-black flex items-center gap-1.5">
                <span
                  className={cn(
                    'size-2 rounded-full',
                    currentPlatform === 'lazada' ? 'bg-channel-lazada' : 'bg-channel-shopify',
                  )}
                />
                {currentPlatform === 'lazada'
                  ? `Lazada (${currentEnvironment === 'production' ? t('lazadaEnvProduction') : t('lazadaEnvSandbox')})`
                  : `Shopify (${shopDomainValue ? `${shopDomainValue}.myshopify.com` : 'Store'})`}
              </span>
            </div>
            {selectedOrgName && (
              <div className="text-slate-gray font-mono text-[11px] truncate max-w-[200px]">
                {selectedOrgName}
              </div>
            )}
          </div>

          {/* STATE 2A: UNVERIFIED / READY TO AUTHORIZE */}
          {authState !== 'verified' && authState !== 'authenticating' && (
            <div className="p-5 rounded-2xl border border-border-subtle bg-surface-lifted text-center space-y-3">
              <div className="size-12 rounded-2xl bg-ink-black/5 text-ink-black mx-auto flex items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink-black">
                  {t('step2.authorizeTitle')}
                </h4>
                <p className="text-xs text-slate-gray mt-1 max-w-sm mx-auto">
                  {t('step2.authorizeDescription')}
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                {isLazadaSandboxManual ? (
                  <Button
                    type="button"
                    onClick={handleConnectSandboxManual}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-ink-black hover:bg-charcoal active:scale-95 text-white text-xs font-bold transition-all shadow-atmospheric inline-flex items-center justify-center gap-2"
                  >
                    <span>{t('connectSandbox')}</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleTriggerOAuth}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-ink-black hover:bg-charcoal active:scale-95 text-white text-xs font-bold transition-all shadow-atmospheric inline-flex items-center justify-center gap-2"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    <span>{t('step2.openOAuthButton')}</span>
                  </Button>
                )}
              </div>

              {/* Dev/Prototype testing helper */}
              <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-center gap-2">
                <span className="text-[11px] text-slate-gray">{t('step2.simNotice')}</span>
                <button
                  type="button"
                  onClick={handleSimulateOAuth}
                  className="text-[11px] font-bold text-signal-orange hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {t('step2.simButton')}
                </button>
              </div>
            </div>
          )}

          {/* STATE 2B: VALIDATING SPINNER */}
          {authState === 'authenticating' && (
            <div className="p-8 rounded-2xl border border-border-subtle bg-surface-lifted text-center space-y-3 animate-in fade-in-50 duration-200">
              <div className="size-10 rounded-full border-2 border-ink-black border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-bold text-ink-black">
                {t('step2.validating')}
              </p>
              <p className="text-[11px] text-slate-gray">
                {t('step2.validatingDesc')}
              </p>
            </div>
          )}

          {/* STATE 2C: VERIFIED SUCCESS & DISPLAY LABEL SETUP */}
          {authState === 'verified' && verifiedIdentity && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Verified Card */}
              <ShopConnectionVerifiedCard identity={verifiedIdentity} />

              {/* Display Label Input */}
              <div className="space-y-2 pt-1">
                <label
                  htmlFor="shop-display-label-input"
                  className="text-xs font-bold text-ink-black flex items-center justify-between"
                >
                  <span>
                    {t('step2.displayLabelTitle')}{' '}
                    <span className="text-signal-orange">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-gray">
                    {t('labelDialog.inputPlaceholder')}
                  </span>
                </label>
                <Input
                  id="shop-display-label-input"
                  value={customDisplayLabel}
                  onChange={(e) => setCustomDisplayLabel(e.target.value)}
                  placeholder={t('step2.displayLabelPlaceholder')}
                />
                <p className="text-[11px] text-slate-gray leading-relaxed">
                  {t('step2.displayLabelTip')}
                </p>
              </div>
            </div>
          )}

          {/* Step 2 Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <Button
              variant="outline"
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full px-4 py-2 text-xs font-bold text-slate-gray hover:text-ink-black"
            >
              {t('step2.backButton')}
            </Button>
            <Button
              type="button"
              disabled={authState !== 'verified' || isFinishing}
              onClick={handleFinishConnection}
              className={cn(
                'rounded-full px-5 py-2 text-xs font-bold transition-all shadow-atmospheric inline-flex items-center gap-1.5',
                authState === 'verified'
                  ? 'bg-ink-black hover:bg-charcoal text-white cursor-pointer active:scale-95'
                  : 'bg-border-subtle text-slate-gray cursor-not-allowed opacity-60',
              )}
            >
              {isFinishing ? (
                <span>{tCommon('saving')}</span>
              ) : authState === 'verified' ? (
                <>
                  <span>{t('step2.finishButton')}</span>
                  <svg
                    aria-hidden="true"
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </>
              ) : (
                <span>{t('step2.waitingAuth')}</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
