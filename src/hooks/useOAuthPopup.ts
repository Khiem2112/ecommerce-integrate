'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type UseOAuthPopupOptions = {
  readonly defaultWidth?: number;
  readonly defaultHeight?: number;
  readonly windowName?: string;
  readonly onPopupClosed?: () => void;
};

export type UseOAuthPopupReturn = {
  readonly isOpen: boolean;
  readonly preparePopup: () => Window | null;
  readonly navigatePopup: (url: string) => boolean;
  readonly openPopup: (url: string) => Window | null;
  readonly closePopup: () => void;
};

const DEFAULT_POPUP_WIDTH = 800;
const DEFAULT_POPUP_HEIGHT = 750;
const DEFAULT_WINDOW_NAME = 'ShopOAuthPopup';

function computePopupFeatures(width: number, height: number): string {
  if (typeof window === 'undefined') {
    return `width=${width},height=${height}`;
  }

  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

  return `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1,resizable=yes`;
}

export function useOAuthPopup({
  defaultWidth = DEFAULT_POPUP_WIDTH,
  defaultHeight = DEFAULT_POPUP_HEIGHT,
  windowName = DEFAULT_WINDOW_NAME,
  onPopupClosed,
}: UseOAuthPopupOptions = {}): UseOAuthPopupReturn {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onPopupClosedRef = useRef(onPopupClosed);

  useEffect(() => {
    onPopupClosedRef.current = onPopupClosed;
  }, [onPopupClosed]);

  const clearMonitor = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startMonitor = useCallback(
    (win: Window) => {
      clearMonitor();
      timerRef.current = setInterval(() => {
        if (!win || win.closed) {
          clearMonitor();
          popupRef.current = null;
          setIsOpen(false);
          onPopupClosedRef.current?.();
        }
      }, 500);
    },
    [clearMonitor],
  );

  const closePopup = useCallback(() => {
    clearMonitor();
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch {
        // Ignore cross-origin close errors
      }
    }
    popupRef.current = null;
    setIsOpen(false);
  }, [clearMonitor]);

  const preparePopup = useCallback((): Window | null => {
    if (typeof window === 'undefined') return null;

    closePopup();

    try {
      const features = computePopupFeatures(defaultWidth, defaultHeight);
      const win = window.open('about:blank', windowName, features);

      if (win) {
        popupRef.current = win;
        setIsOpen(true);
        startMonitor(win);
      }

      return win;
    } catch {
      return null;
    }
  }, [closePopup, defaultHeight, defaultWidth, startMonitor, windowName]);

  const openPopup = useCallback(
    (url: string): Window | null => {
      if (typeof window === 'undefined') return null;

      closePopup();

      try {
        const features = computePopupFeatures(defaultWidth, defaultHeight);
        const win = window.open(url, windowName, features);

        if (win) {
          popupRef.current = win;
          setIsOpen(true);
          startMonitor(win);
          win.focus();
        }

        return win;
      } catch {
        return null;
      }
    },
    [closePopup, defaultHeight, defaultWidth, startMonitor, windowName],
  );

  const navigatePopup = useCallback(
    (url: string): boolean => {
      const win = popupRef.current;

      if (win && !win.closed) {
        try {
          win.location.href = url;
          win.focus();
          return true;
        } catch {
          // If cross-origin or direct assignment fails, fallback to openPopup
          return Boolean(openPopup(url));
        }
      }

      return Boolean(openPopup(url));
    },
    [openPopup],
  );

  useEffect(() => {
    return () => {
      clearMonitor();
    };
  }, [clearMonitor]);

  return {
    isOpen,
    preparePopup,
    navigatePopup,
    openPopup,
    closePopup,
  };
}
