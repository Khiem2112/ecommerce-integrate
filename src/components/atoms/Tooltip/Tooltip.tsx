'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export type TooltipProps = {
  readonly content: ReactNode;
  readonly children: ReactNode;
  readonly side?: TooltipSide;
  readonly delayDuration?: number;
  readonly className?: string;
};

export function Tooltip({
  content,
  children,
  side = 'top',
  delayDuration = 400,
  className,
}: TooltipProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!content || !isMounted) {
    return <>{children}</>;
  }

  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md',
            'animate-in fade-in-0 zoom-in-95 duration-150',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-foreground" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TooltipProvider({ children }: { readonly children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}
