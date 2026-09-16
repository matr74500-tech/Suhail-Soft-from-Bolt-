import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/constants';
import type { Customer, Currency, Document } from '@/types/database';
import { Plus, Pencil, X, Users, Phone, Download } from 'lucide-react';
import SmartSearch from '@/components/utilities/SmartSearch';

interface CustForm {
  code: string;
  name_ar: string;
  name_en: string;
  phone: string;
  email: string;
  address: string;
  opening_balance: number;
  currency_id: string;
  usual_cycle_days: number;
  is_active: boolean;
}

const emptyForm: CustForm = {
  code: '', name_ar: '', name_en: '', phone: '', email: '', address: '',
  opening_balance: 0, currency_id: '', usual_cycle_days: 0, is_active: true,
};

export default function Customers() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCust, setEditCust] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailCust, setDetailCust] = useState<Customer | null>(null);
  const [custDocs, setCustDocs] = useState<Document[]>([]);

  useEffect(() => {
    loadCustomers();
    supabase.from('currencies').select('*').eq('is_active', true).then(({ data }) => setCurrencies(data || []));
  }, []);

  async function loadCustomers() {
    let q = supabase.from('customers').select('*').order('name_ar');
    if (search) q = q.or(`name_ar.ilike.%${search}%,code.ilike.%${search}%,phone.ilike.%${search}%`);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setCustomers(data || []);
  }

  const openAdd = useCallback(() => {
    setEditCust(null);
    setForm(emptyForm);
    setShowModal(true);
  }, []);

  function openEdit(c: Customer) {
    setEditCust(c);
    setForm({
      code: c.code, name_ar: c.name_ar, name_en: c.name_en || '', phone: c.phone || '',
      email: c.email || '', address: c.address || '',
      opening_balance: Number(c.opening_balance) || 0,
      currency_id: c.currency_id || '', usual_cycle_days: c.usual_cycle_days || 0,
      is_active: c.is_active,
    });
    setShowModal(true);
  }

  async function openDetail(c: Customer) {
    setDetailCust(c);
    const { data } = await supabase.from('documents')
      .select('*').eq('customer_id', c.id).order('document_date', { ascending: false }).limit(20);
    setCustDocs(data || []);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!form.code || !form.name_ar) { setError('الاسم والكود مطلوبان'); setSaving(false); return; }
      const payload = {
        code: form.code, name_ar: form.name_ar, name_en: form.name_en || null,
        phone: form.phone || null, email: form.email || null, address: form.address || null,
        opening_balance: form.opening_balance, current_balance: editCust ? undefined : form.opening_balance,
        currency_id: form.currency_id || null,
        usual_cycle_days: form.usual_cycle_days || null, is_active: form.is_active,
      };
      if (editCust) {
        const { error: e } = await supabase.from('customers').update(payload).eq('id', editCust.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('customers').insert(payload);
        if (e) throw e;
      }
      setShowModal(false);
      loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const headers = ['الكود', 'الاسم', 'الهاتف', 'الإيميل', 'العنوان', 'الرصيد', 'الحالة'];
    const rows = customers.map(c => [c.code, c.name_ar, c.phone || '', c.email || '', c.address || '', c.current_balance, STATUS_LABELS[c.status] || c.status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    late: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={loadCustomers}
          placeholder="بحث بالاسم, الكود, الهاتف..."
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('customers')
              .select('*')
              .or(`name_ar.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%`)
              .limit(8);
            return (data || []).map((c: Customer) => ({
              id: c.id, primary: c.name_ar, secondary: c.phone || c.code,
              badge: formatCurrency(Number(c.current_balance)),
              badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
              data: c,
            }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); loadCustomers(); }}
        />
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="late">متأخر</option>
        </select>
        <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> تصدير</button>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> عميل جديد</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">الكود</th>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">الهاتف</th>
              <th className="px-4 py-3 font-medium">الرصيد</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">آخر طلب</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {customers.map(c => (
              <tr key={c.id} className="table-row-hover cursor-pointer" onClick={() => openDetail(c)}>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{c.code}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.name_ar}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell" dir="ltr">{c.phone || '-'}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(c.current_balance))}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`badge ${statusColors[c.status]}`}>{STATUS_LABELS[c.status] || c.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell">{c.last_order_date ? formatDate(c.last_order_date) : '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="btn-ghost p-1.5 text-blue-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا يوجد عملاء</p>
          </div>
        )}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editCust ? 'تعديل عميل' : 'عميل جديد'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الكود"><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="الاسم (عربي)"><input className="input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} /></Field>
            <Field label="الاسم (إنجليزي)"><input className="input" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} dir="ltr" /></Field>
            <Field label="الهاتف"><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
            <Field label="الإيميل"><input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
            <Field label="العنوان"><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="الرصيد الافتتاحي"><input type="number" step="0.01" className="input" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) })} /></Field>
            <Field label="العملة">
              <select className="input" value={form.currency_id} onChange={e => setForm({ ...form, currency_id: e.target.value })}>
                <option value="">افتراضي</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </Field>
            <Field label="دورة الشراء (أيام)"><input type="number" className="input" value={form.usual_cycle_days} onChange={e => setForm({ ...form, usual_cycle_days: Number(e.target.value) })} /></Field>
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

      {detailCust && (
        <Modal onClose={() => setDetailCust(null)} title={detailCust.name_ar}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card p-3"><p className="text-xs text-gray-400">الرصيد الحالي</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(Number(detailCust.current_balance))}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الرصيد الافتتاحي</p><p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(Number(detailCust.opening_balance))}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الهاتف</p><p className="text-sm font-medium text-gray-700 dark:text-gray-300" dir="ltr">{detailCust.phone || '-'}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الحالة</p><span className={`badge ${statusColors[detailCust.status]}`}>{STATUS_LABELS[detailCust.status]}</span></div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">آخر الفواتير</h4>
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr className="text-right text-xs text-gray-500">
                      <th className="px-3 py-2">الرقم</th>
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">النوع</th>
                      <th className="px-3 py-2">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {custDocs.map(d => (
                      <tr key={d.id} className="text-sm table-row-hover">
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{d.document_number}</td>
                        <td className="px-3 py-2 text-gray-500">{formatDate(d.document_date)}</td>
                        <td className="px-3 py-2 text-gray-500">{d.doc_type}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{formatCurrency(Number(d.total))}</td>
                      </tr>
                    ))}
                    {custDocs.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">لا توجد فواتير</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}</div>;
}

export function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}