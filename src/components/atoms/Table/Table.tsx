import {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export type TableProps = HTMLAttributes<HTMLTableElement> & {
  readonly containerClassName?: string;
};

export function Table({
  className,
  containerClassName,
  ...props
}: TableProps) {
  return (
    <div className={cn('custom-scrollbar relative w-full overflow-auto', containerClassName)}>
      <table
        className={cn('w-full caption-bottom text-xs text-foreground', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-hairline bg-surface-lifted font-medium', className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

export function TableFooter({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        'border-t border-hairline bg-surface-lifted font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-hairline transition-colors hover:bg-surface-lifted/60 data-[state=selected]:bg-foreground/5',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-8 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'p-3 align-middle text-xs leading-4.5 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-3 text-xs text-muted', className)}
      {...props}
    />
  );
}
