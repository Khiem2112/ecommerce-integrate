'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerUpdateSchema, type CustomerUpdateFormValues } from '@/forms';
import { useUpdateCustomer } from '@/hooks';
import {
  Button,
  Input,
  IconButton,
  Combobox,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  type ComboboxItem,
} from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';
import { parseCategoryList } from '@/utils';
import type { CustomerWithRelations, CustomerFullDetail } from '@/types';

export type UpdateCustomerModalProps = {
  readonly open: boolean;
  readonly customer: CustomerWithRelations | CustomerFullDetail;
  readonly onClose: () => void;
  readonly onSaveSuccess?: () => void;
};

const formatIsoUpdatedAt = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  if (date instanceof Date) return date.toISOString();
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toISOString();
};

export function UpdateCustomerModal({
  open,
  customer,
  onClose,
  onSaveSuccess,
}: UpdateCustomerModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutateAsync: updateCustomer, isPending } = useUpdateCustomer();
  const t = useTranslations('customers');
  const consentOptions: readonly ComboboxItem[] = [
    { value: 'granted', label: t('update.consentGranted') },
    { value: 'revoked', label: t('update.consentRevoked') },
  ];
  const languageOptions: readonly ComboboxItem[] = [
    { value: 'vi', label: t('update.vietnamese') },
    { value: 'en', label: t('update.english') },
  ];

  const initialCategories = parseCategoryList(customer.frequentCategories);
  const [categoriesInput, setCategoriesInput] = useState(initialCategories.join(', '));

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerUpdateFormValues>({
    resolver: zodResolver(customerUpdateSchema),
    defaultValues: {
      id: customer.id,
      preferredLanguage: customer.preferredLanguage ?? 'vi',
      consentStatus: (customer.consentStatus as 'granted' | 'revoked') ?? 'granted',
      frequentCategories: initialCategories as string[],
      updatedAt: formatIsoUpdatedAt(customer.updatedAt),
    },
  });

  useEffect(() => {
    if (open) {
      const catArr = parseCategoryList(customer.frequentCategories) as string[];

      setCategoriesInput(catArr.join(', '));
      reset({
        id: customer.id,
        preferredLanguage: customer.preferredLanguage ?? 'vi',
        consentStatus: (customer.consentStatus as 'granted' | 'revoked') ?? 'granted',
        frequentCategories: catArr,
        updatedAt: formatIsoUpdatedAt(customer.updatedAt),
      });
    }
  }, [open, customer, reset]);

  if (!open) return null;

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const onSubmit = async (values: CustomerUpdateFormValues) => {
    setErrorMessage(null);
    try {
      const parsedCategories = parseCategoryList(categoriesInput);

      await updateCustomer({
        id: values.id,
        preferredLanguage: values.preferredLanguage,
        consentStatus: values.consentStatus,
        frequentCategories: parsedCategories as string[],
        updatedAt: values.updatedAt,
      });
      onSaveSuccess?.();
      handleClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('update.failed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent hideCloseButton className="max-w-md p-6">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div>
            <DialogTitle className="text-sm font-semibold text-foreground">
              {t('update.title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted mt-0.5 font-mono">
              {customer.platformBuyerId} ({customer.platform.name})
            </DialogDescription>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            ariaLabel={t('update.close')}
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
          {/* Consent Status */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {t('update.consentLabel')}
            </label>
            <Controller
              control={control}
              name="consentStatus"
              render={({ field }) => (
                <Combobox
                  items={consentOptions}
                  value={field.value ?? 'granted'}
                  onChange={(val) => field.onChange(val as 'granted' | 'revoked')}
                  placeholder={t('update.consentPlaceholder')}
                  ariaLabel={t('update.consentAria')}
                />
              )}
            />
            {errors.consentStatus && (
              <p className="mt-1 text-xs text-semantic-error">{errors.consentStatus.message}</p>
            )}
          </div>

          {/* Preferred Language */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {t('update.languageLabel')}
            </label>
            <Controller
              control={control}
              name="preferredLanguage"
              render={({ field }) => (
                <Combobox
                  items={languageOptions}
                  value={field.value ?? 'vi'}
                  onChange={(val) => field.onChange(val)}
                  placeholder={t('update.languagePlaceholder')}
                  ariaLabel={t('update.languageAria')}
                />
              )}
            />
            {errors.preferredLanguage && (
              <p className="mt-1 text-xs text-semantic-error">{errors.preferredLanguage.message}</p>
            )}
          </div>

          {/* Frequent Categories */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              {t('update.categoriesLabel')}
            </label>
            <Controller
              control={control}
              name="frequentCategories"
              render={({ field }) => (
                <Input
                  value={categoriesInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategoriesInput(val);
                    const parsed = parseCategoryList(val);
                    field.onChange(parsed as string[]);
                  }}
                  placeholder={t('update.categoriesPlaceholder')}
                  className="text-xs font-mono"
                />
              )}
            />
            <p className="mt-1 text-[11px] text-muted">
              {t('update.categoriesDescription')}
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isPending}
            >
              {t('update.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isPending}
            >
              {isPending ? t('update.saving') : t('update.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
