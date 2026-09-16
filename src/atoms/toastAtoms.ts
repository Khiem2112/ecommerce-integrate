import { atom } from 'jotai';

export type ToastVariant = 'default' | 'destructive' | 'warning' | 'success' | 'info' | 'error';

export type ToastAction = {
  readonly label: string;
  readonly onClick: () => void;
};

export type ToastItem = {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly variant?: ToastVariant;
  readonly duration?: number;
  readonly dismissible?: boolean;
  readonly action?: ToastAction;
};

export const toastsAtom = atom<readonly ToastItem[]>([]);
