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

export type DateTimePickerProps = {
  readonly value?: Date | string | null;
  readonly onChange?: (date: Date | undefined, dateString: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;
  readonly size?: 'sm' | 'md';
  readonly icon?: ReactNode;
  readonly minuteStep?: number;
};

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

export const formatDateTimeDisplay = (date?: Date | null): string => {
  if (!date || isNaN(date.getTime())) return '';
  const d = padZero(date.getDate());
  const m = padZero(date.getMonth() + 1);
  const y = date.getFullYear();
  const hr = padZero(date.getHours());
  const min = padZero(date.getMinutes());
  return `${d}/${m}/${y} ${hr}:${min}`;
};

export const parseDateValue = (val?: Date | string | null): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Chọn ngày & giờ…',
  label,
  disabled = false,
  className,
  minDate,
  maxDate,
  size = 'md',
  icon,
  minuteStep = 5,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minuteScrollRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();

  const selectedDateObj = useMemo(() => parseDateValue(value), [value]);

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

    const days: { date: Date; dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNumber = daysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNumber);
      days.push({
        date: prevDate,
        dateStr: `${prevDate.getFullYear()}-${padZero(prevDate.getMonth() + 1)}-${padZero(dayNumber)}`,
        dayNumber,
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const thisDate = new Date(currentYear, currentMonth, i);
      days.push({
        date: thisDate,
        dateStr: `${currentYear}-${padZero(currentMonth + 1)}-${padZero(i)}`,
        dayNumber: i,
        isCurrentMonth: true,
      });
    }

    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      days.push({
        date: nextDate,
        dateStr: `${nextDate.getFullYear()}-${padZero(nextDate.getMonth() + 1)}-${padZero(i)}`,
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < 60; i += Math.max(1, minuteStep)) {
      list.push(i);
    }
    return list;
  }, [minuteStep]);

  const handleSelectDay = (targetDay: Date) => {
    const baseDate = selectedDateObj ? new Date(selectedDateObj) : new Date();
    const newDate = new Date(
      targetDay.getFullYear(),
      targetDay.getMonth(),
      targetDay.getDate(),
      baseDate.getHours(),
      baseDate.getMinutes(),
      baseDate.getSeconds(),
    );
    onChange?.(newDate, newDate.toISOString());
  };

  const handleTimeChange = (type: 'hour' | 'minute', val: number) => {
    const baseDate = selectedDateObj ? new Date(selectedDateObj) : new Date();
    const newDate = new Date(baseDate);
    if (type === 'hour') {
      newDate.setHours(val);
    } else {
      newDate.setMinutes(val);
    }
    onChange?.(newDate, newDate.toISOString());
  };

  const handleSetNow = () => {
    const now = new Date();
    onChange?.(now, now.toISOString());
    setViewDate(now);
  };

  const handleSetStartOfDay = () => {
    const base = selectedDateObj ? new Date(selectedDateObj) : new Date();
    base.setHours(0, 0, 0, 0);
    onChange?.(base, base.toISOString());
  };

  const handleSetEndOfDay = () => {
    const base = selectedDateObj ? new Date(selectedDateObj) : new Date();
    base.setHours(23, 59, 59, 999);
    onChange?.(base, base.toISOString());
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange?.(undefined, '');
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

  const minDateObj = useMemo(() => parseDateValue(minDate), [minDate]);
  const maxDateObj = useMemo(() => parseDateValue(maxDate), [maxDate]);

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
          <span className={cn('truncate font-medium', !selectedDateObj && 'text-muted font-normal')}>
            {selectedDateObj ? formatDateTimeDisplay(selectedDateObj) : placeholder}
          </span>
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {selectedDateObj && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear()}
              className="p-0.5 text-muted hover:text-foreground rounded transition cursor-pointer"
              title="Xóa lựa chọn"
            >
              <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            aria-hidden="true"
            className={cn('size-3.5 text-muted transition-transform duration-200', isOpen && 'rotate-180')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1.5 w-auto min-w-[320px] rounded-2xl border border-hairline bg-surface-card p-3 shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-hairline gap-3 sm:gap-3">
            {/* Left: Date Calendar */}
            <div className="w-full sm:w-60 shrink-0">
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
                  const isSelected =
                    selectedDateObj &&
                    item.date.getFullYear() === selectedDateObj.getFullYear() &&
                    item.date.getMonth() === selectedDateObj.getMonth() &&
                    item.date.getDate() === selectedDateObj.getDate();

                  const isPastMin = minDateObj ? item.date < new Date(minDateObj.setHours(0, 0, 0, 0)) : false;
                  const isFutureMax = maxDateObj ? item.date > new Date(maxDateObj.setHours(23, 59, 59, 999)) : false;
                  const isDayDisabled = isPastMin || isFutureMax;

                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      disabled={isDayDisabled}
                      onClick={() => handleSelectDay(item.date)}
                      className={cn(
                        'flex h-7 w-full items-center justify-center rounded-lg text-xs font-medium transition cursor-pointer',
                        !item.isCurrentMonth && 'text-muted/40',
                        item.isCurrentMonth && !isSelected && 'text-foreground hover:bg-surface-lifted',
                        isSelected && 'bg-primary text-on-primary font-bold shadow-xs',
                        isDayDisabled && 'cursor-not-allowed opacity-25 hover:bg-transparent',
                      )}
                    >
                      {item.dayNumber}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: 24h Time Selector */}
            <div className="sm:pl-3 pt-3 sm:pt-0 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-1.5 border-b border-hairline mb-2">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <svg aria-hidden="true" className="size-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Thời gian (24h)
                </span>
                <span className="text-[11px] font-mono font-bold text-foreground">
                  {padZero(selectedDateObj?.getHours() ?? 0)}:{padZero(selectedDateObj?.getMinutes() ?? 0)}
                </span>
              </div>

              <div className="flex gap-2 h-44 sm:h-52">
                {/* Hours column */}
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-semibold text-muted text-center uppercase tracking-wider mb-1">
                    Giờ
                  </span>
                  <div
                    ref={hourScrollRef}
                    className="flex-1 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5 border border-hairline/60 rounded-xl bg-surface-lifted/40"
                  >
                    {hours.map((hour) => {
                      const isHourSelected = selectedDateObj?.getHours() === hour;
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => handleTimeChange('hour', hour)}
                          className={cn(
                            'w-full py-1 text-center font-mono text-xs rounded-md transition cursor-pointer',
                            isHourSelected
                              ? 'bg-primary text-on-primary font-bold shadow-xs'
                              : 'text-muted hover:text-foreground hover:bg-surface-lifted',
                          )}
                        >
                          {padZero(hour)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Minutes column */}
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-semibold text-muted text-center uppercase tracking-wider mb-1">
                    Phút
                  </span>
                  <div
                    ref={minuteScrollRef}
                    className="flex-1 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5 border border-hairline/60 rounded-xl bg-surface-lifted/40"
                  >
                    {minutes.map((minute) => {
                      const isMinuteSelected = (selectedDateObj?.getMinutes() ?? 0) === minute;
                      return (
                        <button
                          key={minute}
                          type="button"
                          onClick={() => handleTimeChange('minute', minute)}
                          className={cn(
                            'w-full py-1 text-center font-mono text-xs rounded-md transition cursor-pointer',
                            isMinuteSelected
                              ? 'bg-primary text-on-primary font-bold shadow-xs'
                              : 'text-muted hover:text-foreground hover:bg-surface-lifted',
                          )}
                        >
                          {padZero(minute)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick time shortcuts */}
              <div className="flex items-center justify-between gap-1 pt-2.5 mt-2 border-t border-hairline text-[11px]">
                <button
                  type="button"
                  onClick={handleSetNow}
                  className="px-2 py-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer font-medium"
                >
                  Bây giờ
                </button>
                <button
                  type="button"
                  onClick={handleSetStartOfDay}
                  className="px-2 py-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer font-medium"
                >
                  00:00
                </button>
                <button
                  type="button"
                  onClick={handleSetEndOfDay}
                  className="px-2 py-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-lifted transition cursor-pointer font-medium"
                >
                  23:59
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-hover transition cursor-pointer shadow-xs"
                >
                  Xong
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
