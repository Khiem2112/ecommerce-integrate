'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button, Combobox, type ComboboxItem, Input } from '@/components/atoms';
import { ErrorBanner, SuccessBanner } from '@/components/molecules';
import {
  organizationFormSchema,
  type OrganizationFormValues,
} from '@/forms';
import { useCreateOrganization, useUpdateOrganization } from '@/hooks';
import type { OrganizationDetail } from '@/types';

export type OrganizationFormProps = {
  readonly organization?: OrganizationDetail;
};

const COMMON_TIMEZONES: readonly { value: string; label: string }[] = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (UTC+7)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+7)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
];

const COMMON_CURRENCIES: readonly { value: string; label: string }[] = [
  { value: 'VND', label: 'VND - Vietnamese Dong' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

const COMMON_COUNTRIES: readonly { value: string; label: string }[] = [
  { value: 'VN', label: 'VN - Vietnam' },
  { value: 'US', label: 'US - United States' },
  { value: 'SG', label: 'SG - Singapore' },
  { value: 'JP', label: 'JP - Japan' },
  { value: 'GB', label: 'GB - United Kingdom' },
];

export function OrganizationForm({ organization }: OrganizationFormProps) {
  const t = useTranslations('organizations');
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();
  const isEditing = organization !== undefined;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      displayName: organization?.displayName ?? '',
      slug: organization?.slug ?? '',
      timezone: organization?.timezone ?? 'Asia/Ho_Chi_Minh',
      baseCurrency: organization?.baseCurrency ?? 'VND',
      logoUrl: organization?.logoUrl ?? '',
      legalName: organization?.legalName ?? '',
      countryCode: organization?.countryCode ?? 'VN',
    },
  });

  const currentTimezone = watch('timezone');
  const currentCurrency = watch('baseCurrency');
  const currentCountry = watch('countryCode');

  const timezoneOptions: readonly ComboboxItem[] = useMemo(() => {
    const list = [...COMMON_TIMEZONES];
    if (currentTimezone && !list.some((tz) => tz.value === currentTimezone)) {
      list.unshift({ value: currentTimezone, label: currentTimezone });
    }
    return list;
  }, [currentTimezone]);

  const currencyOptions: readonly ComboboxItem[] = useMemo(() => {
    const list = [...COMMON_CURRENCIES];
    if (currentCurrency && !list.some((c) => c.value === currentCurrency)) {
      list.unshift({ value: currentCurrency, label: currentCurrency });
    }
    return list;
  }, [currentCurrency]);

  const countryOptions: readonly ComboboxItem[] = useMemo(() => {
    const list = [...COMMON_COUNTRIES];
    if (currentCountry && !list.some((c) => c.value === currentCountry)) {
      list.unshift({ value: currentCountry, label: currentCountry });
    }
    return list;
  }, [currentCountry]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error ?? updateMutation.error;

  const handleFormSubmit = async (values: OrganizationFormValues): Promise<void> => {
    setSaved(false);
    try {
      if (organization) {
        const updated = await updateMutation.mutateAsync({
          ...values,
          id: organization.id,
          expectedVersion: organization.version,
        });
        setSaved(true);
        router.push(`/organizations/${updated.id}`);
        return;
      }

      const created = await createMutation.mutateAsync({
        ...values,
        idempotencyKey: crypto.randomUUID(),
      });
      router.push(`/organizations/${created.id}`);
    } catch {
      // Handled by error banner
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-hairline bg-surface-card p-5 shadow-card sm:p-8"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {isEditing ? t('edit') : t('new')}
        </h1>
        <p className="mt-1 text-sm text-muted">{t('description')}</p>
      </div>

      {error && <ErrorBanner message={t('errors.save')} />}
      {saved && <SuccessBanner message={t('updated')} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Display Name */}
        <label className="space-y-1.5 text-sm font-medium text-foreground">
          <span>{t('form.name')} *</span>
          <Input
            {...register('displayName')}
            aria-invalid={Boolean(errors.displayName)}
            disabled={isPending}
            className="w-full"
          />
          {errors.displayName && (
            <span className="block text-xs text-semantic-error">
              {t('form.required')}
            </span>
          )}
        </label>

        {/* Slug */}
        <label className="space-y-1.5 text-sm font-medium text-foreground">
          <span>{t('form.slug')} *</span>
          <Input
            {...register('slug')}
            aria-invalid={Boolean(errors.slug)}
            disabled={isPending}
            placeholder="my-org-slug"
            className="w-full font-mono"
          />
          {errors.slug && (
            <span className="block text-xs text-semantic-error">
              {t('form.invalid')}
            </span>
          )}
        </label>

        {/* Timezone Combobox */}
        <div className="space-y-1.5 text-sm font-medium text-foreground">
          <span>{t('form.timezone')} *</span>
          <Combobox
            items={timezoneOptions}
            value={currentTimezone}
            onChange={(val) => setValue('timezone', val, { shouldValidate: true })}
            disabled={isPending}
            searchable
            placeholder={t('form.timezone')}
            ariaLabel={t('form.timezone')}
            size="md"
          />
        </div>

        {/* Base Currency Combobox */}
        <div className="space-y-1.5 text-sm font-medium text-foreground">
          <span>{t('form.currency')} *</span>
          <Combobox
            items={currencyOptions}
            value={currentCurrency}
            onChange={(val) => setValue('baseCurrency', val, { shouldValidate: true })}
            disabled={isPending}
            searchable
            placeholder={t('form.currency')}
            ariaLabel={t('form.currency')}
            size="md"
          />
        </div>

        {/* Logo URL */}
        <label className="space-y-1.5 text-sm font-medium text-foreground">
          <span>{t('form.logo')}</span>
          <Input
            {...register('logoUrl')}
            type="url"
            aria-invalid={Boolean(errors.logoUrl)}
            disabled={isPending}
            placeholder="https://example.com/logo.png"
            className="w-full"
          />
        </label>

        {/* Country Code Combobox */}
        <div className="space-y-1.5 text-sm font-medium text-foreground">
          <span>{t('form.country')}</span>
          <Combobox
            items={countryOptions}
            value={currentCountry ?? ''}
            onChange={(val) => setValue('countryCode', val, { shouldValidate: true })}
            disabled={isPending}
            searchable
            placeholder={t('form.country')}
            ariaLabel={t('form.country')}
            size="md"
          />
        </div>
      </div>

      {/* Legal Name */}
      <label className="block space-y-1.5 text-sm font-medium text-foreground">
        <span>{t('form.legalName')}</span>
        <Input
          {...register('legalName')}
          aria-invalid={Boolean(errors.legalName)}
          disabled={isPending}
          className="w-full"
        />
      </label>

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-xs text-semantic-error">
          {t('form.required')}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" size="md" isLoading={isPending}>
          {isPending ? t('saving') : isEditing ? t('save') : t('create')}
        </Button>
      </div>
    </form>
  );
}
