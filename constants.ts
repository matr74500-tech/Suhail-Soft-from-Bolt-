import type { PaymentMethod } from '@/types/database';

export const PAYMENT_METHODS: { value: PaymentMethod; labelAr: string }[] = [
  { value: 'cash', labelAr: 'نقدًا' },
  { value: 'wallet', labelAr: 'محفظة إلكترونية' },
  { value: 'bank_account', labelAr: 'حساب بنكي' },
  { value: 'bank_transfer', labelAr: 'حوالة بنكية' },
  { value: 'local_transfer', labelAr: 'حوالة شبكة محلية' },
  { value: 'credit', labelAr: 'الآجل' },
  { value: 'split', labelAr: 'دفع متعدد' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدًا',
  wallet: 'محفظة إلكترونية',
  bank_account: 'حساب بنكي',
  bank_transfer: 'حوالة بنكية',
  local_transfer: 'حوالة شبكة محلية',
  credit: 'الآجل',
  split: 'دفع متعدد',
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  sales: 'فاتورة بيع',
  purchase: 'فاتورة شراء',
  quotation: 'عرض سعر',
  sales_order: 'أمر بيع',
  purchase_request: 'طلب شراء',
  purchase_order: 'أمر شراء',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  pending: 'قيد الانتظار',
  approved: 'معتمد',
  cancelled: 'ملغي',
  completed: 'مكتمل',
  rejected: 'مرفوض',
};

export const ALERT_STATE_LABELS: Record<string, string> = {
  normal: 'عادي',
  near_reorder: 'قرب نقطة الطلب',
  reorder_required: 'يتطلب طلبًا',
  low: 'مخزون منخفض',
  out_of_stock: 'نفد المخزون',
};

export const EXPENSE_TYPES: { value: string; labelAr: string }[] = [
  { value: 'lunch', labelAr: 'غداء' },
  { value: 'dinner', labelAr: 'عشاء' },
  { value: 'suhoor', labelAr: 'سحور' },
  { value: 'transportation', labelAr: 'مواصلات' },
  { value: 'fuel', labelAr: 'وقود' },
  { value: 'hospitality', labelAr: 'ضيافة' },
  { value: 'maintenance', labelAr: 'صيانة' },
  { value: 'communications', labelAr: 'اتصالات' },
  { value: 'electricity', labelAr: 'كهرباء' },
  { value: 'water', labelAr: 'مياه' },
  { value: 'rent', labelAr: 'إيجار' },
  { value: 'salaries', labelAr: 'رواتب' },
  { value: 'other', labelAr: 'مصروفات أخرى' },
];

export const ACCOUNT_TYPES: { value: string; labelAr: string }[] = [
  { value: 'cash', labelAr: 'نقدية' },
  { value: 'wallet', labelAr: 'محفظة إلكترونية' },
  { value: 'bank', labelAr: 'حساب بنكي' },
  { value: 'local_transfer', labelAr: 'حوالة شبكة محلية' },
];

export const COMMUNICATION_TYPES: { value: string; labelAr: string }[] = [
  { value: 'whatsapp', labelAr: 'واتساب' },
  { value: 'sms', labelAr: 'رسالة نصية' },
  { value: 'call', labelAr: 'مكالمة' },
  { value: 'note', labelAr: 'ملاحظة' },
];

export function formatCurrency(amount: number, currencyCode: string = 'YER'): string {
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
