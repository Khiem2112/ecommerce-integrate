export function OrganizationDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Back Link Skeleton */}
      <div className="h-4 w-36 animate-pulse rounded bg-hairline" />

      {/* Header Card Skeleton */}
      <div className="animate-pulse rounded-2xl border border-hairline bg-surface-card p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-hairline" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-48 rounded bg-hairline" />
                <div className="h-5 w-20 rounded-full bg-hairline-soft" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 rounded bg-hairline-soft" />
                <div className="h-4 w-20 rounded bg-hairline-soft" />
                <div className="h-4 w-16 rounded bg-hairline-soft" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg bg-hairline" />
            <div className="h-8 w-20 rounded-lg bg-hairline-soft" />
          </div>
        </div>
      </div>

      {/* Section 1 Skeleton: Workspace information */}
      <div className="space-y-3">
        <div className="h-6 w-44 animate-pulse rounded bg-hairline" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Basic Info Skeleton */}
          <div className="lg:col-span-5 animate-pulse rounded-2xl border border-hairline bg-surface-card p-5 shadow-card space-y-4">
            <div className="h-5 w-32 rounded bg-hairline" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex justify-between py-1">
                  <div className="h-4 w-24 rounded bg-hairline-soft" />
                  <div className="h-4 w-28 rounded bg-hairline" />
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Connected Shops Skeleton */}
          <div className="lg:col-span-7 animate-pulse rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div className="h-5 w-36 rounded bg-hairline" />
              <div className="h-5 w-8 rounded-full bg-hairline-soft" />
            </div>
            <div className="divide-y divide-hairline">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-hairline" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 rounded bg-hairline" />
                      <div className="h-3 w-24 rounded bg-hairline-soft" />
                    </div>
                  </div>
                  <div className="h-6 w-16 rounded-full bg-hairline-soft" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 Skeleton: User list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-44 animate-pulse rounded bg-hairline" />
          <div className="h-5 w-8 animate-pulse rounded-full bg-hairline-soft" />
        </div>
        <div className="animate-pulse rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
          <div className="border-b border-hairline bg-surface-lifted/40 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_13rem_auto]">
              <div className="h-9 rounded-lg bg-hairline" />
              <div className="h-9 rounded-lg bg-hairline" />
              <div className="h-9 w-20 rounded-lg bg-hairline" />
            </div>
          </div>
          <div className="divide-y divide-hairline">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-hairline" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 rounded bg-hairline" />
                    <div className="h-3 w-28 rounded bg-hairline-soft" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-32 rounded-lg bg-hairline-soft" />
                  <div className="h-8 w-12 rounded-lg bg-hairline-soft" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
