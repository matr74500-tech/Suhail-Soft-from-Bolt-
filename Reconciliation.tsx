import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { Modal, Field } from '@/pages/Customers';
import type { FinancialAccount, BankReconciliation } from '@/types/database';
import { Banknote, Plus, Eye, CheckCircle, AlertTriangle } from 'lucide-react';

export default function Reconciliation() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [detail, setDetail] = useState<BankReconciliation | null>(null);
  const [form, setForm] = useState({ financial_account_id: '', opening_balance: 0, bank_closing_balance: 0, reconciliation_date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    supabase.from('financial_accounts').select('*').eq('account_type', 'bank').eq('is_active', true).then(({ data }) => setAccounts(data || []));
    loadReconciliations();
  }, []);

  async function loadReconciliations() {
    const { data } = await supabase.from('bank_reconciliations').select(`*, financial_account:financial_accounts(*)`).order('created_at', { ascending: false });
    setReconciliations(data || []);
  }

  async function save() {
    if (!form.financial_account_id) return;
    const acc = accounts.find(a => a.id === form.financial_account_id);
    const closing = Number(acc?.current_balance) || 0;
    const diff = form.bank_closing_balance - closing;
    await supabase.from('bank_reconciliations').insert({
      financial_account_id: form.financial_account_id,
      reconciliation_date: form.reconciliation_date,
      opening_balance: form.opening_balance,
      closing_balance: closing,
      bank_closing_balance: form.bank_closing_balance,
      difference: diff,
      status: diff === 0 ? 'approved' : 'pending',
    });
    setShowModal(false);
    setForm({ financial_account_id: '', opening_balance: 0, bank_closing_balance: 0, reconciliation_date: new Date().toISOString().split('T')[0] });
    loadReconciliations();
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> تسوية جديدة</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحساب</th>
              <th className="px-4 py-3 font-medium">رصيد النظام</th>
              <th className="px-4 py-3 font-medium">رصيد البنك</th>
              <th className="px-4 py-3 font-medium">الفرق</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {reconciliations.map(r => (
              <tr key={r.id} className="table-row-hover cursor-pointer" onClick={() => setDetail(r)}>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDate(r.reconciliation_date)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">{r.financial_account?.name_ar}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(Number(r.closing_balance))}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatCurrency(Number(r.bank_closing_balance))}</td>
                <td className={`px-4 py-3 text-sm font-bold ${Number(r.difference) === 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(Number(r.difference))}</td>
                <td className="px-4 py-3 hidden sm:table-cell"><span className={`badge ${statusColors[r.status]}`}>{r.status === 'approved' ? 'معتمد' : r.status === 'pending' ? 'قيد الانتظار' : 'مسودة'}</span></td>
                <td className="px-4 py-3"><button className="btn-ghost p-1.5 text-blue-500"><Eye className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {reconciliations.length === 0 && <div className="text-center py-12 text-gray-400"><Banknote className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد تسويات بنكية</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title="تسوية بنكية جديدة">
          <div className="space-y-4">
            <Field label="الحساب البنكي">
              <select className="input" value={form.financial_account_id} onChange={e => {
                const acc = accounts.find(a => a.id === e.target.value);
                setForm({ ...form, financial_account_id: e.target.value, opening_balance: Number(acc?.current_balance) || 0 });
              }}>
                <option value="">اختر</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}
              </select>
            </Field>
            <Field label="رصيد البنك (كشف)"><input type="number" step="0.01" className="input" value={form.bank_closing_balance || ''} onChange={e => setForm({ ...form, bank_closing_balance: Number(e.target.value) })} /></Field>
            <Field label="التاريخ"><input type="date" className="input" value={form.reconciliation_date} onChange={e => setForm({ ...form, reconciliation_date: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
              <button onClick={save} className="btn-primary">حفظ</button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)} title="تفاصيل التسوية">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3"><p className="text-xs text-gray-400">رصيد افتتاحي</p><p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(detail.opening_balance))}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">رصيد ختامي</p><p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(detail.closing_balance))}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">رصيد البنك</p><p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(detail.bank_closing_balance))}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الفرق</p><p className={`text-sm font-bold ${Number(detail.difference) === 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(Number(detail.difference))}</p></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
