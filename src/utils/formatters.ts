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
