import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { Modal, Field } from '@/pages/Customers';
import type { FinancialAccount, Currency } from '@/types/database';
import {
  Plus, Pencil, Wallet, Banknote, Download, TrendingUp, TrendingDown,
} from 'lucide-react';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: 'نقدية', wallet: 'محفظة إلكترونية', bank: 'حساب بنكي', local_transfer: 'حوالة محلية',
};

interface AccForm {
  code: string; name_ar: string; account_type: string; bank_name: string;
  bank_account_number: string; wallet_provider: string; wallet_number: string;
  opening_balance: number; currency_id: string; is_active: boolean;
}

const emptyForm: AccForm = {
  code: '', name_ar: '', account_type: 'cash', bank_name: '', bank_account_number: '',
  wallet_provider: '', wallet_number: '', opening_balance: 0, currency_id: '', is_active: true,
};

export default function Accounts() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editAcc, setEditAcc] = useState<FinancialAccount | null>(null);
  const [form, setForm] = useState<AccForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
    supabase.from('currencies').select('*').eq('is_active', true).then(({ data }) => setCurrencies(data || []));
  }, []);

  async function loadAccounts() {
    const { data } = await supabase.from('financial_accounts').select('*').order('name_ar');
    setAccounts(data || []);
  }

  function openAdd() { setEditAcc(null); setForm(emptyForm); setShowModal(true); }

  function openEdit(a: FinancialAccount) {
    setEditAcc(a);
    setForm({
      code: a.code, name_ar: a.name_ar, account_type: a.account_type,
      bank_name: a.bank_name || '', bank_account_number: a.bank_account_number || '',
      wallet_provider: a.wallet_provider || '', wallet_number: a.wallet_number || '',
      opening_balance: Number(a.opening_balance) || 0, currency_id: a.currency_id || '', is_active: a.is_active,
    });
    setShowModal(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!form.code || !form.name_ar) { setError('الاسم والكود مطلوبان'); setSaving(false); return; }
      const payload = {
        code: form.code, name_ar: form.name_ar, account_type: form.account_type,
        bank_name: form.bank_name || null, bank_account_number: form.bank_account_number || null,
        wallet_provider: form.wallet_provider || null, wallet_number: form.wallet_number || null,
        opening_balance: form.opening_balance,
        current_balance: editAcc ? undefined : form.opening_balance,
        currency_id: form.currency_id || null, is_active: form.is_active,
      };
      if (editAcc) {
        const { error: e } = await supabase.from('financial_accounts').update(payload).eq('id', editAcc.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('financial_accounts').insert(payload);
        if (e) throw e;
      }
      setShowModal(false);
      loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  }

  const typeColors: Record<string, string> = {
    cash: 'from-emerald-500 to-teal-600',
    wallet: 'from-purple-500 to-violet-600',
    bank: 'from-blue-500 to-indigo-600',
    local_transfer: 'from-amber-500 to-orange-600',
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="card p-4 flex items-center gap-3">
          <Wallet className="w-5 h-5 text-primary-500" />
          <div>
            <p className="text-xs text-gray-400">إجمالي الأرصدة</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalBalance)}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> حساب جديد</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(a => (
          <div key={a.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeColors[a.account_type]} flex items-center justify-center`}>
                <Banknote className="w-6 h-6 text-white" />
              </div>
              <button onClick={() => openEdit(a)} className="btn-ghost p-1.5 text-blue-500"><Pencil className="w-4 h-4" /></button>
            </div>
            <p className="font-bold text-gray-900 dark:text-white mt-3">{a.name_ar}</p>
            <p className="text-xs text-gray-400">{ACCOUNT_TYPE_LABELS[a.account_type]} — {a.code}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{formatCurrency(Number(a.current_balance))}</p>
            {a.bank_name && <p className="text-xs text-gray-400 mt-1">{a.bank_name}</p>}
            {a.wallet_provider && <p className="text-xs text-gray-400 mt-1">{a.wallet_provider}</p>}
          </div>
        ))}
        {accounts.length === 0 && <div className="col-span-full text-center py-12 text-gray-400"><Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد حسابات مالية</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editAcc ? 'تعديل حساب' : 'حساب مالي جديد'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الكود"><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="الاسم"><input className="input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} /></Field>
            <Field label="نوع الحساب">
              <select className="input" value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
                <option value="cash">نقدية</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="bank">حساب بنكي</option>
                <option value="local_transfer">حوالة محلية</option>
              </select>
            </Field>
            <Field label="الرصيد الافتتاحي"><input type="number" step="0.01" className="input" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) })} /></Field>
            {form.account_type === 'bank' && <>
              <Field label="اسم البنك"><input className="input" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></Field>
              <Field label="رقم الحساب"><input className="input" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} dir="ltr" /></Field>
            </>}
            {form.account_type === 'wallet' && <>
              <Field label="مزود المحفظة"><input className="input" value={form.wallet_provider} onChange={e => setForm({ ...form, wallet_provider: e.target.value })} /></Field>
              <Field label="رقم المحفظة"><input className="input" value={form.wallet_number} onChange={e => setForm({ ...form, wallet_number: e.target.value })} dir="ltr" /></Field>
            </>}
            <Field label="العملة">
              <select className="input" value={form.currency_id} onChange={e => setForm({ ...form, currency_id: e.target.value })}>
                <option value="">افتراضي</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 cursor-pointer pt-6">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded text-primary-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">نشط</span>
            </label>
          </div>
          {error && <div className="mt-4 bg-red-50 dark:bg-red-900/30 text-red-600 text-sm rounded-lg p-3">{error}</div>}
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
