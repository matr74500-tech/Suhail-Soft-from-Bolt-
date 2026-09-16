import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Modal, Field } from '@/pages/Customers';
import type { ServiceRevenue, Service, Customer, FinancialAccount, PaymentMethod } from '@/types/database';
import { Plus, Wrench, Download } from 'lucide-react';

export default function ServiceRevenues() {
  const { profile } = useAuth();
  const [revenues, setRevenues] = useState<ServiceRevenue[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    service_id: '', amount: 0, customer_id: '', payment_method: 'cash' as PaymentMethod,
    financial_account_id: '', notes: '', revenue_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRevenues();
    supabase.from('services').select('*').eq('is_active', true).then(({ data }) => setServices(data || []));
    supabase.from('customers').select('*').eq('is_active', true).then(({ data }) => setCustomers(data || []));
    supabase.from('financial_accounts').select('*').eq('is_active', true).then(({ data }) => setAccounts(data || []));
  }, []);

  async function loadRevenues() {
    const { data } = await supabase.from('service_revenues').select(`
      *, customer:customers(*), financial_account:financial_accounts(*)
    `).order('created_at', { ascending: false });
    setRevenues(data || []);
  }

  async function save() {
    setSaving(true);
    const svc = services.find(s => s.id === form.service_id);
    const { error } = await supabase.from('service_revenues').insert({
      service_id: form.service_id || null,
      service_name: svc?.name_ar || 'إيراد آخر',
      amount: form.amount,
      revenue_date: form.revenue_date,
      customer_id: form.customer_id || null,
      payment_method: form.payment_method,
      financial_account_id: form.financial_account_id || null,
      notes: form.notes || null,
      branch_id: profile?.branch_id || null,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    });

    if (!error && form.financial_account_id) {
      const acc = accounts.find(a => a.id === form.financial_account_id);
      if (acc) {
        await supabase.from('financial_accounts').update({
          current_balance: Number(acc.current_balance) + form.amount,
        }).eq('id', acc.id);
      }
    }

    setSaving(false);
    setShowModal(false);
    setForm({ service_id: '', amount: 0, customer_id: '', payment_method: 'cash', financial_account_id: '', notes: '', revenue_date: new Date().toISOString().split('T')[0] });
    loadRevenues();
  }

  const totalToday = revenues
    .filter(r => r.revenue_date === new Date().toISOString().split('T')[0])
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="card p-4 flex items-center gap-3">
          <Wrench className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-xs text-gray-400">إيرادات الخدمات اليوم</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalToday)}</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> إيراد جديد</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">الخدمة</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">العميل</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">طريقة الدفع</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">التاريخ</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">بواسطة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {revenues.map(r => (
              <tr key={r.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{r.service_name}</td>
                <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(r.amount))}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{r.customer?.name_ar || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{PAYMENT_METHODS.find(p => p.value === r.payment_method)?.labelAr}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{formatDate(r.revenue_date)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{r.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {revenues.length === 0 && <div className="text-center py-12 text-gray-400"><Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد إيرادات خدمات</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title="إيراد خدمة جديد">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الخدمة">
              <select className="input" value={form.service_id} onChange={e => {
                const s = services.find(s => s.id === e.target.value);
                setForm({ ...form, service_id: e.target.value, amount: Number(s?.default_price) || 0 });
              }}>
                <option value="">إيراد آخر</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
              </select>
            </Field>
            <Field label="المبلغ"><input type="number" step="0.01" className="input" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
            <Field label="العميل">
              <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">بدون</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </Field>
            <Field label="طريقة الدفع">
              <select className="input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}>
                {PAYMENT_METHODS.filter(p => p.value !== 'split').map(p => <option key={p.value} value={p.value}>{p.labelAr}</option>)}
              </select>
            </Field>
            <Field label="الحساب المالي">
              <select className="input" value={form.financial_account_id} onChange={e => setForm({ ...form, financial_account_id: e.target.value })}>
                <option value="">افتراضي</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
              </select>
            </Field>
            <Field label="التاريخ"><input type="date" className="input" value={form.revenue_date} onChange={e => setForm({ ...form, revenue_date: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="ملاحظات"><textarea className="input min-h-[60px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
            <button onClick={save} disabled={saving || form.amount <= 0} className="btn-primary">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
