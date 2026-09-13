'use client';

import { ReactNode } from 'react';

export default function CustomersLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="custom-scrollbar flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
