export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-SA');
}

export function getAlertState(current: number, min: number, reorder: number): string {
  if (current <= 0) return 'out_of_stock';
  if (current <= min) return 'low';
  if (current <= reorder) return 'reorder_required';
  return 'normal';
}

export const ALERT_STATE_LABELS: Record<string, string> = {
  out_of_stock: 'نفد المخزون',
  low: 'مخزون منخفض',
  reorder_required: 'يتطلب طلب',
  normal: 'طبيعي',
};
