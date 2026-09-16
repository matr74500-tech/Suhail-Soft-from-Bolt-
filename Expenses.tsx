import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { EXPENSE_TYPES } from '@/lib/constants';
import { Modal, Field } from '@/pages/Customers';
import type { Expense, FinancialAccount } from '@/types/database';
import { Plus, Receipt, Download, Trash2 } from 'lucide-react';

export default function Expenses() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    expense_type: 'lunch', amount: 0, beneficiary: '', reason: '', notes: '',
    financial_account_id: '', expense_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExpenses();
    supabase.from('financial_accounts').select('*').eq('is_active', true).then(({ data }) => setAccounts(data || []));
  }, []);

  async function loadExpenses() {
    const { data } = await supabase.from('expenses').select(`
      *, financial_account:financial_accounts(*)
    `).order('created_at', { ascending: false });
    setExpenses(data || []);
  }

  async function save() {
    setSaving(true);
    const expenseTypeLabel = EXPENSE_TYPES.find(e => e.value === form.expense_type)?.labelAr || form.expense_type;
    const { error } = await supabase.from('expenses').insert({
      expense_type: expenseTypeLabel,
      amount: form.amount,
      expense_date: form.expense_date,
      beneficiary: form.beneficiary || null,
      reason: form.reason || null,
      notes: form.notes || null,
      financial_account_id: form.financial_account_id || null,
      branch_id: profile?.branch_id || null,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    });

    if (!error && form.financial_account_id) {
      const acc = accounts.find(a => a.id === form.financial_account_id);
      if (acc) {
        await supabase.from('financial_accounts').update({
          current_balance: Number(acc.current_balance) - form.amount,
        }).eq('id', acc.id);
      }
    }

    setSaving(false);
    setShowModal(false);
    setForm({ expense_type: 'lunch', amount: 0, beneficiary: '', reason: '', notes: '', financial_account_id: '', expense_date: new Date().toISOString().split('T')[0] });
    loadExpenses();
  }

  const totalToday = expenses
    .filter(e => e.expense_date === new Date().toISOString().split('T')[0])
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="card p-4 flex items-center gap-3">
          <Receipt className="w-5 h-5 text-red-500" />
          <div>
            <p className="text-xs text-gray-400">مصروفات اليوم</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalToday)}</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> مصروف جديد</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">النوع</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">لمن</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">السبب</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">التاريخ</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">بواسطة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {expenses.map(e => (
              <tr key={e.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{e.expense_type}</td>
                <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(Number(e.amount))}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{e.beneficiary || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{e.reason || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{formatDate(e.expense_date)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{e.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && <div className="text-center py-12 text-gray-400"><Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد مصروفات</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title="مصروف جديد">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="نوع المصروف">
              <select className="input" value={form.expense_type} onChange={e => setForm({ ...form, expense_type: e.target.value })}>
                {EXPENSE_TYPES.map(t => <option key={t.value} value={t.value}>{t.labelAr}</option>)}
              </select>
            </Field>
            <Field label="المبلغ"><input type="number" step="0.01" className="input" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
            <Field label="لمن؟"><input className="input" value={form.beneficiary} onChange={e => setForm({ ...form, beneficiary: e.target.value })} /></Field>
            <Field label="السبب"><input className="input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></Field>
            <Field label="الحساب المالي">
              <select className="input" value={form.financial_account_id} onChange={e => setForm({ ...form, financial_account_id: e.target.value })}>
                <option value="">افتراضي</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
              </select>
            </Field>
            <Field label="التاريخ"><input type="date" className="input" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} /></Field>
            <div className="md:col-span-2">
              <Field label="ملاحظات"><textarea className="input min-h-[60px]" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
