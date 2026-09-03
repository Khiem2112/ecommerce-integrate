/**
 * Shared utility functions for formatting dates, status badges, and VIP tiers.
 */

export function formatDate(
  dateString: Date | string | null | undefined,
  fallback: string = '—',
): string {
  if (!dateString) return fallback;
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(
  dateString: Date | string | null | undefined,
  fallback: string = '—',
): string {
  if (!dateString) return fallback;
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getStatusBadgeVariant(statusCode: string): {
  readonly variant: 'secondary' | 'success' | 'warning' | 'error' | 'info';
  readonly label: string;
} {
  switch (statusCode) {
    case 'delivered':
      return { variant: 'success', label: 'Giao thành công' };
    case 'shipped':
      return { variant: 'info', label: 'Đang vận chuyển' };
    case 'paid':
      return { variant: 'info', label: 'Đã thanh toán' };
    case 'unpaid':
      return { variant: 'warning', label: 'Chờ thanh toán' };
    case 'cancelled':
      return { variant: 'error', label: 'Đã hủy' };
    case 'returned':
    case 'refunded':
      return { variant: 'error', label: 'Hoàn tiền / Trả hàng' };
    default:
      return { variant: 'secondary', label: statusCode };
  }
}

export function getVipBadgeVariant(tierCode?: string): 'secondary' | 'purple' | 'pink' | 'teal' | 'cyan' {
  switch (tierCode?.toLowerCase()) {
    case 'platinum':
      return 'purple';
    case 'gold':
      return 'pink';
    case 'silver':
      return 'teal';
    default:
      return 'secondary';
  }
}

/**
 * Parse frequent categories JSON or Array safely into a list of trimmed strings.
 */
export function parseCategoryList(frequentCategories: unknown): readonly string[] {
  if (!frequentCategories) return [];
  if (Array.isArray(frequentCategories)) {
    return frequentCategories
      .map((c) => (typeof c === 'string' ? c.trim() : ''))
      .filter((c) => c.length > 0);
  }
  if (typeof frequentCategories === 'string') {
    const trimmed = frequentCategories.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((c) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c) => c.length > 0);
      }
    } catch {
      // Not JSON, treat as comma-separated
    }
    return trimmed
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  return [];
}
