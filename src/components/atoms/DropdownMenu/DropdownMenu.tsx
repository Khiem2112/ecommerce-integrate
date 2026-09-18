'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

// ============================================================
// Types & Context
// ============================================================

type DropdownMenuContextValue = {
  readonly isOpen: boolean;
  readonly setIsOpen: (open: boolean) => void;
  readonly triggerId: string;
  readonly menuId: string;
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly contentRef: RefObject<HTMLDivElement | null>;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu(): DropdownMenuContextValue {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('DropdownMenu components must be used within a DropdownMenu');
  }
  return context;
}

// ============================================================
// DropdownMenu (Root)
// ============================================================

export type DropdownMenuProps = {
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
};

export function DropdownMenu({ children, open, onOpenChange }: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const triggerId = useId();
  const menuId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const setIsOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DropdownMenuContext.Provider
      value={{
        isOpen,
        setIsOpen,
        triggerId,
        menuId,
        triggerRef,
        contentRef,
      }}
    >
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

// ============================================================
// DropdownMenuTrigger
// ============================================================

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  readonly asChild?: boolean;
};

export function DropdownMenuTrigger({
  children,
  className,
  onClick,
  onKeyDown,
  ...props
}: DropdownMenuTriggerProps) {
  const { isOpen, setIsOpen, triggerId, menuId, triggerRef, contentRef } = useDropdownMenu();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (!e.defaultPrevented) {
      setIsOpen(!isOpen);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      // Focus first item once open
      setTimeout(() => {
        const firstItem = contentRef.current?.querySelector<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        );
        firstItem?.focus();
      }, 10);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      // Focus last item once open
      setTimeout(() => {
        const items = contentRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        );
        items?.[items.length - 1]?.focus();
      }, 10);
    }
  };

  return (
    <button
      ref={triggerRef as RefObject<HTMLButtonElement>}
      id={triggerId}
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuId : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn('inline-flex items-center justify-center border-0 bg-transparent p-0 cursor-pointer', className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================================
// DropdownMenuContent
// ============================================================

export type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement> & {
  readonly align?: 'start' | 'end';
  readonly sideOffset?: number;
  readonly minWidth?: string;
  readonly portaled?: boolean;
};

export function DropdownMenuContent({
  children,
  align = 'end',
  sideOffset = 4,
  portaled = true,
  className,
  style,
  onKeyDown,
  ...props
}: DropdownMenuContentProps) {
  const { isOpen, setIsOpen, menuId, triggerId, triggerRef, contentRef } = useDropdownMenu();
  const [isMounted, setIsMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // Close menu if trigger scrolled completely out of viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const menuEl = contentRef.current;
    const menuHeight = menuEl ? menuEl.offsetHeight : 0;
    const menuWidth = menuEl ? menuEl.offsetWidth : 160;

    let top = rect.bottom + sideOffset;
    // If overflowing bottom of viewport, flip to above the trigger
    if (menuHeight > 0 && top + menuHeight > window.innerHeight - 8) {
      const topFlipped = rect.top - menuHeight - sideOffset;
      if (topFlipped >= 8) {
        top = topFlipped;
      }
    }

    if (align === 'start') {
      let left = rect.left;
      if (menuWidth > 0 && left + menuWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      setCoords({ top, left: Math.max(8, left) });
    } else {
      let right = window.innerWidth - rect.right;
      if (menuWidth > 0 && right + menuWidth > window.innerWidth - 8) {
        right = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      setCoords({ top, right: Math.max(8, right) });
    }
  }, [align, sideOffset, triggerRef, contentRef, setIsOpen]);

  useEffect(() => {
    if (!isOpen || !portaled) {
      setCoords(null);
      return;
    }

    updateCoords();

    const rafId = requestAnimationFrame(() => {
      updateCoords();
    });

    const handleScrollOrResize = (e: Event) => {
      if (contentRef.current && contentRef.current.contains(e.target as Node)) {
        return;
      }
      updateCoords();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, portaled, updateCoords, contentRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        contentRef.current &&
        !contentRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, setIsOpen, contentRef, triggerRef]);

  // Keyboard navigation within menu
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    const items = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    switch (e.key) {
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        items[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      case 'Tab': {
        // Tab closes menu and moves focus
        setIsOpen(false);
        break;
      }
      default:
        break;
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      ref={contentRef}
      id={menuId}
      role="menu"
      aria-labelledby={triggerId}
      aria-orientation="vertical"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={
        portaled
          ? {
              position: 'fixed',
              top: coords ? `${coords.top}px` : undefined,
              left: coords?.left !== undefined ? `${coords.left}px` : undefined,
              right: coords?.right !== undefined ? `${coords.right}px` : undefined,
              visibility: coords ? 'visible' : 'hidden',
              ...style,
            }
          : style
      }
      className={cn(
        portaled
          ? 'z-50 min-w-[150px] rounded-xl border border-hairline bg-surface-card p-1 shadow-elevated outline-none animate-in fade-in zoom-in-95 duration-100'
          : 'absolute z-50 mt-1 min-w-[150px] rounded-xl border border-hairline bg-surface-card p-1 shadow-elevated outline-none animate-in fade-in zoom-in-95 duration-100',
        !portaled && (align === 'end' ? 'right-0' : 'left-0'),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );

  if (portaled && isMounted) {
    return createPortal(content, document.body);
  }

  return content;
}

// ============================================================
// DropdownMenuItem
// ============================================================

export type DropdownMenuItemProps = HTMLAttributes<HTMLDivElement> & {
  readonly disabled?: boolean;
  readonly destructive?: boolean;
  readonly onSelect?: () => void;
};

export function DropdownMenuItem({
  children,
  disabled = false,
  destructive = false,
  className,
  onClick,
  onKeyDown,
  onSelect,
  ...props
}: DropdownMenuItemProps) {
  const { setIsOpen, triggerRef } = useDropdownMenu();

  const handleSelect = () => {
    if (disabled) return;
    onSelect?.();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
    handleSelect();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  };

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors',
        'focus:bg-surface-lifted focus:text-foreground',
        destructive
          ? 'text-semantic-error hover:bg-semantic-error/10 focus:bg-semantic-error/10 focus:text-semantic-error'
          : 'text-foreground hover:bg-surface-lifted',
        disabled && 'pointer-events-none opacity-50 cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================
// DropdownMenuSeparator
// ============================================================

export type DropdownMenuSeparatorProps = HTMLAttributes<HTMLDivElement>;

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn('my-1 border-t border-hairline', className)}
      {...props}
    />
  );
}
