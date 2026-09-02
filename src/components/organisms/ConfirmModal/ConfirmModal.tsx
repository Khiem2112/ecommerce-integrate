'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/atoms';

export type ConfirmModalProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string | ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly isDestructive?: boolean;
  readonly isLoading?: boolean;
  readonly onConfirm: () => void | Promise<void>;
  readonly onClose: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas-deep/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface-card p-6 shadow-elevated transition-all">
        <div className="flex items-start gap-3">
          {isDestructive && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-semantic-error/10 text-semantic-error">
              <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && (
              <div className="mt-2 text-xs leading-relaxed text-muted">{description}</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Đang xử lý...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
