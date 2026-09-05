'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';

export type DatePickerProps = {
  readonly value?: string; // YYYY-MM-DD format
  readonly onChange?: (dateStr: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly size?: 'sm' | 'md';
  readonly icon?: ReactNode;
};

export type DateRangeValue = {
  readonly from: string; // YYYY-MM-DD
  readonly to: string;   // YYYY-MM-DD
};

export type DateRangePreset = {
  readonly label: string;
  readonly days: number;
};

export type DateRangePickerProps = {
  readonly from?: string;
  readonly to?: string;
  readonly onChange?: (range: DateRangeValue) => void;
  readonly presets?: readonly DateRangePreset[];
  readonly placeholder?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly size?: 'sm' | 'md';
};

const DEFAULT_PRESETS: readonly DateRangePreset[] = [
  { label: '7 ngày qua', days: 7 },
  { label: '30 ngày qua', days: 30 },
  { label: '90 ngày qua', days: 90 },
];

const DAYS_OF_WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const padZero = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

export const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  return `${y}-${m}-${d}`;
};

export const formatDateDisplay = (dateStr?: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

export function DatePicker({
  value,
  onChange,
  placeholder = 'Chọn ngày…',
  label,
  disabled = false,
  className,
  minDate,
  maxDate,
  size = 'md',
  icon,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();

  const selectedDateObj = useMemo(() => {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }, [value]);

  const [viewDate, setViewDate] = useState<Date>(() => selectedDateObj ?? new Date());

  useEffect(() => {
    if (selectedDateObj) {
      setViewDate(selectedDateObj);
    }
  }, [selectedDateObj]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const daysGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNumber = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNumber);
      days.push({
        dateStr: formatDateToISO(prevDate),
        dayNumber,
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const thisDate = new Date(currentYear, currentMonth, i);
      days.push({
        dateStr: formatDateToISO(thisDate),
        dayNumber: i,
        isCurrentMonth: true,
      });
    }

    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      days.push({
        dateStr: formatDateToISO(nextDate),
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const todayStr = useMemo(() => formatDateToISO(new Date()), []);

  const handleSelectDay = (dateStr: string) => {
    onChange?.(dateStr);
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={buttonId}
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          {label}
        </label>
      )}

      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-surface-card px-3 text-left text-foreground shadow-xs transition duration-150 outline-none hover:border-foreground/30 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10 cursor-pointer',
          size === 'sm' ? 'h-8 text-xs' : 'h-9 text-xs',
          disabled && 'cursor-not-allowed opacity-50',
          isOpen && 'border-foreground ring-2 ring-foreground/10',
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon ?? (
            <svg
              aria-hidden="true"
              className="size-4 shrink-0 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          )}
          <span className={cn('truncate', !value && 'text-muted')}>
            {value ? formatDateDisplay(value) : placeholder}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-2xl border border-hairline bg-surface-card p-3 shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex size-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer"
              aria-label="Tháng trước"
            >
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-xs font-semibold text-foreground">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="flex size-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer"
              aria-label="Tháng sau"
            >
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-muted mb-1">
            {DAYS_OF_WEEK.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {daysGrid.map((item) => {
              const isSelected = item.dateStr === value;
              const isToday = item.dateStr === todayStr;
              const isPastMin = minDate ? item.dateStr < minDate : false;
              const isFutureMax = maxDate ? item.dateStr > maxDate : false;
              const isDayDisabled = isPastMin || isFutureMax;

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  disabled={isDayDisabled}
                  onClick={() => handleSelectDay(item.dateStr)}
                  className={cn(
                    'size-7 text-[11px] rounded-lg font-medium flex items-center justify-center transition cursor-pointer',
                    item.isCurrentMonth ? 'text-foreground' : 'text-muted/40',
                    isToday && !isSelected && 'border border-primary/40 font-bold',
                    isSelected
                      ? 'bg-foreground text-background font-bold shadow-xs'
                      : 'hover:bg-surface-lifted',
                    isDayDisabled && 'cursor-not-allowed opacity-20 hover:bg-transparent',
                  )}
                >
                  {item.dayNumber}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-hairline flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => handleSelectDay(todayStr)}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              Hôm nay
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange?.('');
                  setIsOpen(false);
                }}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DateRangePicker({
  from = '',
  to = '',
  onChange,
  presets = DEFAULT_PRESETS,
  placeholder = 'Chọn khoảng ngày…',
  label,
  disabled = false,
  className,
  size = 'md',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();

  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const [viewDate, setViewDate] = useState<Date>(() => {
    if (from) {
      const [y, m, d] = from.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  });

  useEffect(() => {
    if (from) {
      const [y, m, d] = from.split('-').map(Number);
      if (y && m && d) setViewDate(new Date(y, m - 1, d));
    }
  }, [from]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const daysGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNumber = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNumber);
      days.push({
        dateStr: formatDateToISO(prevDate),
        dayNumber,
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const thisDate = new Date(currentYear, currentMonth, i);
      days.push({
        dateStr: formatDateToISO(thisDate),
        dayNumber: i,
        isCurrentMonth: true,
      });
    }

    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      days.push({
        dateStr: formatDateToISO(nextDate),
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const handleSelectDay = (dateStr: string) => {
    if (!from || (from && to)) {
      onChange?.({ from: dateStr, to: '' });
      return;
    }

    if (from && !to) {
      if (dateStr < from) {
        onChange?.({ from: dateStr, to: '' });
      } else {
        onChange?.({ from, to: dateStr });
        setIsOpen(false);
      }
    }
  };

  const handleApplyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    onChange?.({
      from: formatDateToISO(start),
      to: formatDateToISO(end),
    });
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const displayText = useMemo(() => {
    if (from && to) {
      return `${formatDateDisplay(from)} — ${formatDateDisplay(to)}`;
    }
    if (from) {
      return `${formatDateDisplay(from)} — Chọn ngày kết thúc`;
    }
    return placeholder;
  }, [from, to, placeholder]);

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={buttonId}
          className="mb-1.5 block text-xs font-semibold text-foreground"
        >
          {label}
        </label>
      )}

      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-surface-card px-3 text-left text-foreground shadow-xs transition duration-150 outline-none hover:border-foreground/30 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10 cursor-pointer',
          size === 'sm' ? 'h-8 text-xs' : 'h-9 text-xs',
          disabled && 'cursor-not-allowed opacity-50',
          isOpen && 'border-foreground ring-2 ring-foreground/10',
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <svg
            aria-hidden="true"
            className="size-4 shrink-0 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <span className={cn('truncate', !from && 'text-muted')}>
            {displayText}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-2xl border border-hairline bg-surface-card p-3.5 shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95">
          {presets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 pb-2.5 border-b border-hairline">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset.days)}
                  className="px-2 py-1 rounded-md text-[10px] font-medium border border-hairline bg-surface-lifted text-muted hover:text-foreground hover:bg-surface-card transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex size-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer"
              aria-label="Tháng trước"
            >
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span className="text-xs font-semibold text-foreground">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="flex size-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer"
              aria-label="Tháng sau"
            >
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-muted mb-1">
            {DAYS_OF_WEEK.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {daysGrid.map((item) => {
              const isStart = item.dateStr === from;
              const isEnd = item.dateStr === to;
              const inRange = from && to && item.dateStr > from && item.dateStr < to;
              const isHoveredRange =
                from && !to && hoverDate && hoverDate > from && item.dateStr > from && item.dateStr <= hoverDate;

              return (
                <div
                  key={item.dateStr}
                  className={cn(
                    'p-0 flex items-center justify-center',
                    (inRange || isHoveredRange) && 'bg-foreground/5',
                    isStart && to && 'rounded-l-lg bg-foreground/5',
                    isEnd && from && 'rounded-r-lg bg-foreground/5',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectDay(item.dateStr)}
                    onMouseEnter={() => setHoverDate(item.dateStr)}
                    className={cn(
                      'size-7 text-[11px] font-medium flex items-center justify-center transition cursor-pointer rounded-lg',
                      item.isCurrentMonth ? 'text-foreground' : 'text-muted/40',
                      (isStart || isEnd) && 'bg-foreground text-background font-bold shadow-xs',
                      !isStart && !isEnd && !inRange && !isHoveredRange && 'hover:bg-surface-lifted',
                    )}
                  >
                    {item.dayNumber}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-hairline flex items-center justify-between text-[11px]">
            <span className="text-muted text-[10px]">
              {!from ? 'Chọn ngày bắt đầu' : !to ? 'Chọn ngày kết thúc' : 'Đã chọn khoảng'}
            </span>
            {(from || to) && (
              <button
                type="button"
                onClick={() => onChange?.({ from: '', to: '' })}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                Xóa khoảng
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
