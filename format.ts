export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('ar-YE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCurrency(amount: number, currencyCode: string = 'ر.ي'): string {
  const formatted = new Intl.NumberFormat('ar-YE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currencyCode}`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-YE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('ar-YE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getAlertState(
  quantity: number,
  minStock: number,
  reorderPoint: number,
): 'normal' | 'near_reorder' | 'reorder_required' | 'low' | 'out_of_stock' {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= minStock) return 'low';
  if (quantity <= reorderPoint) return 'reorder_required';
  if (quantity <= reorderPoint * 1.5) return 'near_reorder';
  return 'normal';
}

export const ALERT_STATE_LABELS: Record<string, string> = {
  normal: 'عادي',
  near_reorder: 'قرب نقطة الطلب',
  reorder_required: 'يتطلب طلبًا',
  low: 'مخزون منخفض',
  out_of_stock: 'نفد المخزون',
};
