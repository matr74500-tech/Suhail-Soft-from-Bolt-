import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/format';
import { DOC_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants';
import type { Transfer, Warehouse, Product } from '@/types/database';
import { Modal, Field } from '@/pages/Customers';
import { Plus, ArrowLeftRight, Eye, Trash2 } from 'lucide-react';

export default function Transfers() {
  const { profile } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [detailTr, setDetailTr] = useState<Transfer | null>(null);
  const [fromWh, setFromWh] = useState('');
  const [toWh, setToWh] = useState('');
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTransfers();
    supabase.from('warehouses').select('*').eq('is_active', true).then(({ data }) => setWarehouses(data || []));
    supabase.from('products').select('*').eq('is_active', true).order('name_ar').then(({ data }) => setProducts(data || []));
  }, []);

  async function loadTransfers() {
    const { data } = await supabase.from('transfers').select(`
      *, from_warehouse:warehouses!transfers_from_warehouse_id_fkey(*),
      to_warehouse:warehouses!transfers_to_warehouse_id_fkey(*),
      items:transfer_items(*, product:products(*))
    `).order('created_at', { ascending: false });
    setTransfers(data || []);
  }

  async function save() {
    if (!fromWh || !toWh || fromWh === toWh || items.length === 0) return;
    setSaving(true);
    const trNumber = `TR-${Date.now()}`;
    const { data, error } = await supabase.from('transfers').insert({
      transfer_number: trNumber,
      from_warehouse_id: fromWh,
      to_warehouse_id: toWh,
      branch_id: profile?.branch_id || null,
      status: 'completed',
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    }).select().single();

    if (!error && data) {
      await supabase.from('transfer_items').insert(
        items.map(i => ({ transfer_id: data.id, product_id: i.product_id, quantity: i.quantity }))
      );

      for (const item of items) {
        const { data: fromStock } = await supabase.from('stock_levels')
          .select('id, quantity').eq('product_id', item.product_id).eq('warehouse_id', fromWh).maybeSingle();
        if (fromStock) {
          await supabase.from('stock_levels').update({ quantity: Number(fromStock.quantity) - item.quantity }).eq('id', fromStock.id);
        }
        await supabase.from('stock_movements').insert({
          product_id: item.product_id, warehouse_id: fromWh,
          movement_type: 'transfer_out', quantity: -item.quantity,
          reference_type: 'transfer', reference_id: data.id,
          user_id: profile?.id, user_name: profile?.full_name_ar,
        });

        const { data: toStock } = await supabase.from('stock_levels')
          .select('id, quantity').eq('product_id', item.product_id).eq('warehouse_id', toWh).maybeSingle();
        if (toStock) {
          await supabase.from('stock_levels').update({ quantity: Number(toStock.quantity) + item.quantity }).eq('id', toStock.id);
        } else {
          await supabase.from('stock_levels').insert({ product_id: item.product_id, warehouse_id: toWh, quantity: item.quantity });
        }
        await supabase.from('stock_movements').insert({
          product_id: item.product_id, warehouse_id: toWh,
          movement_type: 'transfer_in', quantity: item.quantity,
          reference_type: 'transfer', reference_id: data.id,
          user_id: profile?.id, user_name: profile?.full_name_ar,
        });
      }

      setShowModal(false);
      setItems([]);
      setFromWh('');
      setToWh('');
      loadTransfers();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus className="w-4 h-4" /> تحويل جديد</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">رقم التحويل</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">من</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">إلى</th>
              <th className="px-4 py-3 font-medium">الأصناف</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {transfers.map(t => (
              <tr key={t.id} className="table-row-hover cursor-pointer" onClick={() => setDetailTr(t)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{t.transfer_number}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{t.from_warehouse?.name_ar}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{t.to_warehouse?.name_ar}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{t.items?.length || 0}</td>
                <td className="px-4 py-3 hidden sm:table-cell"><span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{STATUS_LABELS[t.status]}</span></td>
                <td className="px-4 py-3"><button className="btn-ghost p-1.5 text-blue-500"><Eye className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {transfers.length === 0 && <div className="text-center py-12 text-gray-400"><ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد تحويلات</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title="تحويل بين المستودعات">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="من مستودع">
                <select className="input" value={fromWh} onChange={e => setFromWh(e.target.value)}>
                  <option value="">اختر</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                </select>
              </Field>
              <Field label="إلى مستودع">
                <select className="input" value={toWh} onChange={e => setToWh(e.target.value)}>
                  <option value="">اختر</option>
                  {warehouses.filter(w => w.id !== fromWh).map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                </select>
              </Field>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <Field label="المنتج" className="flex-1">
                    <select className="input" value={item.product_id} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, product_id: e.target.value } : x))}>
                      <option value="">اختر</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                    </select>
                  </Field>
                  <Field label="الكمية">
                    <input type="number" step="0.01" className="input w-24" value={item.quantity} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                  </Field>
                  <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="btn p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setItems([...items, { product_id: '', quantity: 1 }])} className="btn-secondary w-full"><Plus className="w-4 h-4" /> إضافة صنف</button>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
              <button onClick={save} disabled={saving || !fromWh || !toWh || items.length === 0} className="btn-primary">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
            </div>
          </div>
        </Modal>
      )}

      {detailTr && (
        <Modal onClose={() => setDetailTr(null)} title={detailTr.transfer_number}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">من:</span><span className="font-medium">{detailTr.from_warehouse?.name_ar}</span>
              <ArrowLeftRight className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">إلى:</span><span className="font-medium">{detailTr.to_warehouse?.name_ar}</span>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50"><tr className="text-right text-xs text-gray-500"><th className="px-3 py-2">الصنف</th><th className="px-3 py-2">الكمية</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(detailTr.items || []).map(it => (
                    <tr key={it.id} className="text-sm"><td className="px-3 py-2 text-gray-700 dark:text-gray-300">{it.product?.name_ar}</td><td className="px-3 py-2 text-gray-500">{it.quantity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
