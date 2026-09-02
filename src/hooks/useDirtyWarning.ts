'use client';

import { useEffect } from 'react';

export function useDirtyWarning(
  isDirty: boolean,
  message: string = 'Bạn có thay đổi chưa lưu. Bạn có chắc muốn rời khỏi trang này?',
) {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);
}
