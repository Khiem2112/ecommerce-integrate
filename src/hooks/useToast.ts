'use client';

import { useCallback } from 'react';
import { useAtom, getDefaultStore } from 'jotai';
import {
  toastsAtom,
  type ToastItem,
  type ToastVariant,
  type ToastAction,
} from '@/atoms/toastAtoms';

export type ToastOptions = {
  readonly title?: string;
  readonly description?: string;
  readonly variant?: ToastVariant;
  readonly duration?: number;
  readonly dismissible?: boolean;
  readonly action?: ToastAction;
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const store = getDefaultStore();

export function createToast(options: ToastOptions): string {
  const id = generateId();
  const duration = options.duration ?? 4500;
  const newToast: ToastItem = {
    id,
    title: options.title,
    description: options.description,
    variant: options.variant ?? 'default',
    duration,
    dismissible: options.dismissible ?? true,
    action: options.action,
  };

  store.set(toastsAtom, (prev) => [...prev, newToast]);

  if (duration > 0) {
    setTimeout(() => {
      store.set(toastsAtom, (prev) => prev.filter((item) => item.id !== id));
    }, duration);
  }

  return id;
}

export function dismissToast(id: string): void {
  store.set(toastsAtom, (prev) => prev.filter((item) => item.id !== id));
}

export const toast = Object.assign(
  (options: ToastOptions): string => createToast(options),
  {
    warning: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      createToast({ ...options, description, variant: 'warning' }),
    error: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      createToast({ ...options, description, variant: 'error' }),
    success: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      createToast({ ...options, description, variant: 'success' }),
    info: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      createToast({ ...options, description, variant: 'info' }),
    dismiss: dismissToast,
  },
);

export function useToast(): {
  readonly toasts: readonly ToastItem[];
  readonly toast: ((options: ToastOptions) => string) & {
    readonly warning: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>) => string;
    readonly error: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>) => string;
    readonly success: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>) => string;
    readonly info: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>) => string;
    readonly dismiss: (id: string) => void;
  };
  readonly dismiss: (id: string) => void;
} {
  const [toasts, setToasts] = useAtom(toastsAtom);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, [setToasts]);

  const toastBase = useCallback(
    (options: ToastOptions): string => {
      const id = generateId();
      const duration = options.duration ?? 4500;
      const newToast: ToastItem = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? 'default',
        duration,
        dismissible: options.dismissible ?? true,
        action: options.action,
      };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== id));
        }, duration);
      }

      return id;
    },
    [setToasts],
  );

  const toastFn = Object.assign(toastBase, {
    warning: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      toastBase({ ...options, description, variant: 'warning' }),
    error: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      toastBase({ ...options, description, variant: 'error' }),
    success: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      toastBase({ ...options, description, variant: 'success' }),
    info: (description: string, options?: Omit<ToastOptions, 'description' | 'variant'>): string =>
      toastBase({ ...options, description, variant: 'info' }),
    dismiss,
  });

  return {
    toasts,
    toast: toastFn,
    dismiss,
  };
}
