import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getAlertState, ALERT_STATE_LABELS } from '@/lib/format';
import type { Supplier, Currency, SupplierNote, Product } from '@/types/database';
import { Modal, Field } from '@/pages/Customers';
import {
  Plus, Pencil, X, Truck, Download, Phone, StickyNote,
  Package, CheckSquare, Square, ShoppingCart,
} from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

interface SupForm {
  code: string; name_ar: string; name_en: string; phone: string;
  email: string; address: string; contact_person: string;
  opening_balance: number; currency_id: string; is_active: boolean;
}

const emptyForm: SupForm = {
  code: '', name_ar: '', name_en: '', phone: '', email: '', address: '',
  contact_person: '', opening_balance: 0, currency_id: '', is_active: true,
};

export default function Suppliers() {
  const { profile } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSup, setEditSup] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailSup, setDetailSup] = useState<Supplier | null>(null);
  const [detailTab, setDetailTab] = useState<'all' | 'needed'>('all');
  const [supProducts, setSupProducts] = useState<{ product: Product; stock_qty: number; alert: string; selected: boolean }[]>([]);
  const [supNotes, setSupNotes] = useState<SupplierNote[]>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    loadSuppliers();
    supabase.from('currencies').select('*').eq('is_active', true).then(({ data }) => setCurrencies(data || []));
  }, []);

  async function loadSuppliers() {
    let q = supabase.from('suppliers').select('*').order('name_ar');
    if (search) q = q.or(`name_ar.ilike.%${search}%,code.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data } = await q;
    setSuppliers(data || []);
  }

  const openAdd = useCallback(() => { setEditSup(null); setForm(emptyForm); setShowModal(true); }, []);

  function openEdit(s: Supplier) {
    setEditSup(s);
    setForm({
      code: s.code, name_ar: s.name_ar, name_en: s.name_en || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', contact_person: s.contact_person || '',
      opening_balance: Number(s.opening_balance) || 0, currency_id: s.currency_id || '', is_active: s.is_active,
    });
    setShowModal(true);
  }

  async function openDetail(s: Supplier) {
    setDetailSup(s);
    setDetailTab('all');
    const { data: psData } = await supabase.from('product_suppliers')
      .select(`product:products(*, barcodes:product_barcodes(*))`).eq('supplier_id', s.id);
    const products = (psData || []).map((ps: { product: Product | Product[] }) => Array.isArray(ps.product) ? ps.product[0] : ps.product).filter(Boolean) as Product[];

    const productsWithStock = await Promise.all((products as Product[]).map(async p => {
      const { data: stockData } = await supabase.from('stock_levels')
        .select('quantity').eq('product_id', p.id);
      const totalQty = (stockData || []).reduce((s, sl) => s + Number(sl.quantity), 0);
      const alert = getAlertState(totalQty, Number(p.min_stock), Number(p.reorder_point));
      return { product: p, stock_qty: totalQty, alert, selected: false };
    }));
    setSupProducts(productsWithStock);

    const { data: notesData } = await supabase.from('supplier_notes')
      .select('*').eq('supplier_id', s.id).order('created_at', { ascending: false });
    setSupNotes(notesData || []);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!form.code || !form.name_ar) { setError('الاسم والكود مطلوبان'); setSaving(false); return; }
      const payload = {
        code: form.code, name_ar: form.name_ar, name_en: form.name_en || null,
        phone: form.phone || null, email: form.email || null, address: form.address || null,
        contact_person: form.contact_person || null,
        opening_balance: form.opening_balance,
        current_balance: editSup ? undefined : form.opening_balance,
        currency_id: form.currency_id || null, is_active: form.is_active,
      };
      if (editSup) {
        const { error: e } = await supabase.from('suppliers').update(payload).eq('id', editSup.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('suppliers').insert(payload);
        if (e) throw e;
      }
      setShowModal(false);
      loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!newNote.trim() || !detailSup) return;
    await supabase.from('supplier_notes').insert({
      supplier_id: detailSup.id,
      note_type: 'general',
      content: newNote,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    });
    setNewNote('');
    const { data } = await supabase.from('supplier_notes').select('*').eq('supplier_id', detailSup.id).order('created_at', { ascending: false });
    setSupNotes(data || []);
  }

  async function resolveNote(id: string) {
    await supabase.from('supplier_notes').update({ is_resolved: true }).eq('id', id);
    if (detailSup) {
      const { data } = await supabase.from('supplier_notes').select('*').eq('supplier_id', detailSup.id).order('created_at', { ascending: false });
      setSupNotes(data || []);
    }
  }

  function exportCSV() {
    const headers = ['الكود', 'الاسم', 'الهاتف', 'الشخص المسؤول', 'الرصيد'];
    const rows = suppliers.map(s => [s.code, s.name_ar, s.phone || '', s.contact_person || '', s.current_balance]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'suppliers.csv'; a.click();
  }

  const neededProducts = supProducts.filter(p => p.alert !== 'normal');

  function toggleSelectAll() {
    setSupProducts(prev => prev.map(p => p.alert !== 'normal' ? { ...p, selected: true } : p));
  }

  function toggleSelect(idx: number) {
    setSupProducts(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
  }

  const alertColors: Record<string, string> = {
    normal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    near_reorder: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    reorder_required: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    out_of_stock: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={loadSuppliers}
          placeholder="بحث بالاسم، الكود، الهاتف..."
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('suppliers')
              .select('*')
              .or(`name_ar.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%`)
              .limit(8);
            return (data || []).map((s: Supplier) => ({
              id: s.id, primary: s.name_ar, secondary: s.phone || s.code,
              badge: formatCurrency(Number(s.current_balance)),
              badgeColor: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              data: s,
            }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); loadSuppliers(); }}
        />
        <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> تصدير</button>
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> مورد جديد</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">الكود</th>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">الهاتف</th>
              <th className="px-4 py-3 font-medium">الرصيد</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {suppliers.map(s => (
              <tr key={s.id} className="table-row-hover cursor-pointer" onClick={() => openDetail(s)}>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.code}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{s.name_ar}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell" dir="ltr">{s.phone || '-'}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(s.current_balance))}</td>
                <td className="px-4 py-3">
                  <button onClick={e => { e.stopPropagation(); openEdit(s); }} className="btn-ghost p-1.5 text-blue-500"><Pencil className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {suppliers.length === 0 && <div className="text-center py-12 text-gray-400"><Truck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا يوجد موردون</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editSup ? 'تعديل مورد' : 'مورد جديد'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الكود"><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="الاسم (عربي)"><input className="input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} /></Field>
            <Field label="الاسم (إنجليزي)"><input className="input" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} dir="ltr" /></Field>
            <Field label="الهاتف"><input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" /></Field>
            <Field label="الإيميل"><input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" /></Field>
            <Field label="الشخص المسؤول"><input className="input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="العنوان"><input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="الرصيد الافتتاحي"><input type="number" step="0.01" className="input" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) })} /></Field>
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

      {detailSup && (
        <Modal onClose={() => setDetailSup(null)} title={detailSup.name_ar}>
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <button onClick={() => setDetailTab('all')} className={`flex-1 py-2 rounded-md text-sm font-medium ${detailTab === 'all' ? 'bg-white dark:bg-gray-700 text-primary-700' : 'text-gray-500'}`}>كل الأصناف</button>
              <button onClick={() => setDetailTab('needed')} className={`flex-1 py-2 rounded-md text-sm font-medium ${detailTab === 'needed' ? 'bg-white dark:bg-gray-700 text-primary-700' : 'text-gray-500'}`}>
                تحتاج توريد ({neededProducts.length})
              </button>
            </div>

            <div className="space-y-1">
              {detailTab === 'needed' && neededProducts.length > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <button onClick={toggleSelectAll} className="text-sm text-primary-600">تحديد الكل</button>
                  <button className="btn-primary text-sm py-1.5 px-3"><ShoppingCart className="w-4 h-4" /> إنشاء طلب توريد</button>
                </div>
              )}
              {(detailTab === 'all' ? supProducts : neededProducts).map((item, idx) => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  {detailTab === 'needed' && (
                    <button onClick={() => toggleSelect(supProducts.indexOf(item))}>
                      {item.selected ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                    </button>
                  )}
                  <Package className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product.name_ar}</p>
                    <p className="text-xs text-gray-400">{item.product.code}</p>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.stock_qty}</span>
                  <span className={`badge ${alertColors[item.alert]}`}>{ALERT_STATE_LABELS[item.alert]}</span>
                </div>
              ))}
              {(detailTab === 'all' ? supProducts : neededProducts).length === 0 && (
                <p className="text-center py-6 text-gray-400 text-sm">لا توجد أصناف</p>
              )}
            </div>

            {/* Notes */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> الملاحظات والمتابعة
              </h4>
              <div className="flex gap-2 mb-3">
                <input className="input" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="أضف ملاحظة..." onKeyDown={e => e.key === 'Enter' && addNote()} />
                <button onClick={addNote} className="btn-primary"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {supNotes.map(n => (
                  <div key={n.id} className={`p-3 rounded-lg text-sm ${n.is_resolved ? 'bg-gray-50 dark:bg-gray-800/50 opacity-60' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                    <div className="flex justify-between items-start">
                      <span className="text-gray-700 dark:text-gray-300">{n.content}</span>
                      {!n.is_resolved && <button onClick={() => resolveNote(n.id)} className="text-xs text-emerald-600">تم الحل</button>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{n.user_name} — {formatDate(n.created_at)}</p>
                  </div>
                ))}
                {supNotes.length === 0 && <p className="text-center text-gray-400 text-sm py-2">لا توجد ملاحظات</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
