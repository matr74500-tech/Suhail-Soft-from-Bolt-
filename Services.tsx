import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import type { Service, Currency } from '@/types/database';
import { Modal, Field } from '@/pages/Customers';
import { Plus, Pencil, Wrench, Trash2 } from 'lucide-react';

interface SvcForm {
  code: string; name_ar: string; name_en: string; default_price: number;
  currency_id: string; category: string; description: string; is_active: boolean;
}

const emptyForm: SvcForm = {
  code: '', name_ar: '', name_en: '', default_price: 0,
  currency_id: '', category: '', description: '', is_active: true,
};

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [form, setForm] = useState<SvcForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    supabase.from('currencies').select('*').eq('is_active', true).then(({ data }) => setCurrencies(data || []));
  }, []);

  async function load() {
    const { data } = await supabase.from('services').select('*').order('name_ar');
    setServices(data || []);
  }

  function openAdd() { setEditSvc(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(s: Service) {
    setEditSvc(s);
    setForm({ code: s.code, name_ar: s.name_ar, name_en: s.name_en || '', default_price: Number(s.default_price) || 0, currency_id: s.currency_id || '', category: s.category || '', description: s.description || '', is_active: s.is_active });
    setShowModal(true);
  }

  async function save() {
    setSaving(true); setError(null);
    if (!form.code || !form.name_ar) { setError('الاسم والكود مطلوبان'); setSaving(false); return; }
    const payload = { code: form.code, name_ar: form.name_ar, name_en: form.name_en || null, default_price: form.default_price, currency_id: form.currency_id || null, category: form.category || null, description: form.description || null, is_active: form.is_active };
    if (editSvc) {
      const { error: e } = await supabase.from('services').update(payload).eq('id', editSvc.id);
      if (e) setError(e.message);
    } else {
      const { error: e } = await supabase.from('services').insert(payload);
      if (e) setError(e.message);
    }
    setSaving(false);
    if (!error) { setShowModal(false); load(); }
  }

  async function del(id: string) {
    await supabase.from('services').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> خدمة جديدة</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(s => (
          <div key={s.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(s)} className="btn-ghost p-1.5 text-blue-500"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => del(s.id)} className="btn-ghost p-1.5 text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="font-bold text-gray-900 dark:text-white mt-3">{s.name_ar}</p>
            <p className="text-xs text-gray-400">{s.code} — {s.category || 'خدمة'}</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{formatCurrency(Number(s.default_price))}</p>
          </div>
        ))}
        {services.length === 0 && <div className="col-span-full text-center py-12 text-gray-400"><Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد خدمات</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={editSvc ? 'تعديل خدمة' : 'خدمة جديدة'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="الكود"><input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="الاسم (عربي)"><input className="input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} /></Field>
            <Field label="الاسم (إنجليزي)"><input className="input" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} dir="ltr" /></Field>
            <Field label="السعر الافتراضي"><input type="number" step="0.01" className="input" value={form.default_price} onChange={e => setForm({ ...form, default_price: Number(e.target.value) })} /></Field>
            <Field label="العملة">
              <select className="input" value={form.currency_id} onChange={e => setForm({ ...form, currency_id: e.target.value })}>
                <option value="">افتراضي</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </Field>
            <Field label="الفئة"><input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="الوصف"><textarea className="input min-h-[60px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field></div>
            <label className="flex items-center gap-2 cursor-pointer">
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
