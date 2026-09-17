import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/atoms';

export function UserDirectorySkeleton() {
  return (
    <div
      data-testid="user-directory-skeleton"
      className="overflow-hidden rounded-2xl border border-hairline bg-surface-card shadow-card"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[260px]">
              <div className="h-4 w-24 rounded bg-surface-lifted animate-pulse" />
            </TableHead>
            <TableHead className="w-36">
              <div className="h-4 w-16 rounded bg-surface-lifted animate-pulse" />
            </TableHead>
            <TableHead className="w-32">
              <div className="h-4 w-20 rounded bg-surface-lifted animate-pulse" />
            </TableHead>
            <TableHead className="w-32 text-right">
              <div className="ml-auto h-4 w-16 rounded bg-surface-lifted animate-pulse" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={`skeleton-row-${index}`} className="animate-pulse">
              {/* Member */}
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <div className="size-9 shrink-0 rounded-full bg-surface-lifted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 rounded bg-surface-lifted" />
                    <div className="h-3 w-48 rounded bg-surface-lifted/70" />
                  </div>
                </div>
              </TableCell>

              {/* Role */}
              <TableCell className="py-3.5">
                <div className="h-6 w-20 rounded-full bg-surface-lifted" />
              </TableCell>

              {/* Status */}
              <TableCell className="py-3.5">
                <div className="h-6 w-20 rounded-full bg-surface-lifted" />
              </TableCell>

              {/* Actions */}
              <TableCell className="py-3.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <div className="size-8 rounded-full bg-surface-lifted" />
                  <div className="size-8 rounded-full bg-surface-lifted" />
                  <div className="size-8 rounded-full bg-surface-lifted" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

