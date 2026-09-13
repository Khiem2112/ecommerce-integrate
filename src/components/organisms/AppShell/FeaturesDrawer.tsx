'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogClose,
  IconButton,
} from '@/components/atoms';
import { cn } from '@/lib/cn';

interface FeaturesDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function FeaturesDrawer({ open, onClose }: FeaturesDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPortal>
        {/* Backdrop using atom overlay */}
        <DialogOverlay />

        {/* Slide-in panel from right */}
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-80 flex-col',
            'border-l border-hairline bg-surface-card shadow-elevated outline-none',
            'transition-transform duration-300 ease-in-out',
            open ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {/* Header */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-hairline px-4">
            <DialogTitle className="text-sm font-semibold text-foreground">
              Feature Menu
            </DialogTitle>
            <DialogClose asChild>
              <IconButton
                ariaLabel="Close feature menu"
                tooltip="Close feature menu"
                variant="ghost"
                size="sm"
                icon={
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18 18 6M6 6l12 12" />
                  </svg>
                }
              />
            </DialogClose>
          </div>

          {/* Body — stub */}
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-hairline bg-surface-lifted">
              <svg
                aria-hidden="true"
                className="size-6 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">Feature Menu</p>
            <p className="text-xs text-muted">Coming soon</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
