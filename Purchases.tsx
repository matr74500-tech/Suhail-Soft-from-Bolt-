import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { STATUS_LABELS } from '@/lib/constants';
import { Modal, Field } from '@/pages/Customers';
import type { Document, Supplier, Warehouse, Product } from '@/types/database';
import {
  ShoppingCart, Plus, Trash2, Eye, FileText, Download,
} from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

interface PurchaseItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export default function Purchases() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('purchase');
  const [showModal, setShowModal] = useState(false);
  const [detailDoc, setDetailDoc] = useState<Document | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDocs();
    supabase.from('suppliers').select('*').eq('is_active', true).then(({ data }) => setSuppliers(data || []));
    supabase.from('warehouses').select('*').eq('is_active', true).then(({ data }) => setWarehouses(data || []));
    supabase.from('products').select('*').eq('is_active', true).order('name_ar').then(({ data }) => setProducts(data || []));
  }, [typeFilter]);

  async function loadDocs() {
    let q = supabase.from('documents').select(`
      *, supplier:suppliers(*), warehouse:warehouses(*),
      items:document_items(*, product:products(*))
    `).in('doc_type', ['purchase', 'purchase_order', 'purchase_request']).order('created_at', { ascending: false });
    if (typeFilter) q = q.eq('doc_type', typeFilter);
    if (search) q = q.ilike('document_number', `%${search}%`);
    const { data } = await q;
    setDocs(data || []);
  }

  function openNew() {
    setItems([]);
    setSelectedSupplier('');
    setSelectedWarehouse('');
    setShowModal(true);
  }

  async function savePurchase() {
    if (!selectedSupplier || items.length === 0) return;
    setSaving(true);
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const totalCost = items.reduce((s, i) => s + (Number(i.product?.purchase_price) || 0) * i.quantity, 0);
    const docNumber = `PUR-${Date.now()}`;

    const { data, error } = await supabase.from('documents').insert({
      document_number: docNumber,
      doc_type: typeFilter as 'purchase' | 'purchase_order' | 'purchase_request',
      status: 'approved',
      document_date: new Date().toISOString().split('T')[0],
      party_type: 'supplier',
      supplier_id: selectedSupplier,
      warehouse_id: selectedWarehouse || null,
      branch_id: profile?.branch_id || null,
      subtotal,
      total: subtotal,
      total_cost: totalCost,
      paid_amount: subtotal,
      remaining_amount: 0,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    }).select().single();

    if (!error && data) {
      await supabase.from('document_items').insert(
        items.map(i => ({
          document_id: data.id,
          product_id: i.product_id,
          item_type: 'product',
          description: i.product?.name_ar,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: Number(i.product?.purchase_price) || 0,
          line_total: i.unit_price * i.quantity,
          line_cost: (Number(i.product?.purchase_price) || 0) * i.quantity,
        }))
      );

      if (typeFilter === 'purchase') {
        for (const item of items) {
          const { data: stockData } = await supabase.from('stock_levels')
            .select('id, quantity').eq('product_id', item.product_id).eq('warehouse_id', selectedWarehouse).maybeSingle();
          const currentQty = stockData ? Number(stockData.quantity) : 0;
          if (stockData) {
            await supabase.from('stock_levels').update({ quantity: currentQty + item.quantity }).eq('id', stockData.id);
          } else {
            await supabase.from('stock_levels').insert({ product_id: item.product_id, warehouse_id: selectedWarehouse, quantity: item.quantity });
          }
          await supabase.from('stock_movements').insert({
            product_id: item.product_id, warehouse_id: selectedWarehouse,
            movement_type: 'purchase', quantity: item.quantity,
            unit_cost: item.unit_price, total_cost: item.unit_price * item.quantity,
            reference_type: 'document', reference_id: data.id,
            user_id: profile?.id, user_name: profile?.full_name_ar,
            branch_id: profile?.branch_id || null,
          });
        }
        const sup = suppliers.find(s => s.id === selectedSupplier);
        if (sup) {
          await supabase.from('suppliers').update({
            current_balance: Number(sup.current_balance) + subtotal,
          }).eq('id', sup.id);
        }
      }

      setShowModal(false);
      loadDocs();
    }
    setSaving(false);
  }

  function addItem() {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0 }]);
  }

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={loadDocs}
          placeholder="رقم المستند..."
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('documents')
              .select('id, document_number, total, doc_type')
              .in('doc_type', ['purchase', 'purchase_order', 'purchase_request'])
              .ilike('document_number', `%${q}%`)
              .order('created_at', { ascending: false })
              .limit(8);
            return (data || []).map((d: { id: string; document_number: string; total: number }) => ({
              id: d.id, primary: d.document_number,
              badge: formatCurrency(Number(d.total)),
              badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
              data: d,
            }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); loadDocs(); }}
        />
        <select className="input w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="purchase">فواتير الشراء</option>
          <option value="purchase_order">أوامر الشراء</option>
          <option value="purchase_request">طلبات الشراء</option>
        </select>
        <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> مستند جديد</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">رقم المستند</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">المورد</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {docs.map(d => (
              <tr key={d.id} className="table-row-hover cursor-pointer" onClick={() => setDetailDoc(d)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{d.document_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">{d.supplier?.name_ar || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(d.document_date)}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(d.total))}</td>
                <td className="px-4 py-3 hidden sm:table-cell"><span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{STATUS_LABELS[d.status]}</span></td>
                <td className="px-4 py-3"><button className="btn-ghost p-1.5 text-blue-500"><Eye className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && <div className="text-center py-12 text-gray-400"><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد مستندات شراء</p></div>}
      </div>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title="مستند شراء جديد">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="المورد">
                <select className="input" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                  <option value="">اختر</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
                </select>
              </Field>
              <Field label="المستودع">
                <select className="input" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
                  <option value="">اختر</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                </select>
              </Field>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <Field label="المنتج" className="flex-1">
                    <select className="input" value={item.product_id} onChange={e => {
                      const p = products.find(p => p.id === e.target.value);
                      setItems(prev => prev.map((x, idx) => idx === i ? { ...x, product_id: e.target.value, product: p, unit_price: Number(p?.purchase_price) || 0 } : x));
                    }}>
                      <option value="">اختر</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
                    </select>
                  </Field>
                  <Field label="الكمية">
                    <input type="number" step="0.01" className="input w-20" value={item.quantity} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                  </Field>
                  <Field label="السعر">
                    <input type="number" step="0.01" className="input w-24" value={item.unit_price} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, unit_price: Number(e.target.value) } : x))} />
                  </Field>
                  <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="btn p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={addItem} className="btn-secondary w-full"><Plus className="w-4 h-4" /> إضافة صنف</button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
              <span className="text-lg font-bold text-primary-600">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
              <button onClick={savePurchase} disabled={saving || !selectedSupplier || items.length === 0} className="btn-primary">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
            </div>
          </div>
        </Modal>
      )}

      {detailDoc && (
        <Modal onClose={() => setDetailDoc(null)} title={detailDoc.document_number}>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">المورد: <span className="font-medium text-gray-900 dark:text-white">{detailDoc.supplier?.name_ar}</span></p>
            <p className="text-sm text-gray-500">التاريخ: {formatDate(detailDoc.document_date)}</p>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr className="text-right text-xs text-gray-500">
                    <th className="px-3 py-2">الصنف</th>
                    <th className="px-3 py-2">الكمية</th>
                    <th className="px-3 py-2">السعر</th>
                    <th className="px-3 py-2">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(detailDoc.items || []).map(item => (
                    <tr key={item.id} className="text-sm">
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.product?.name_ar || item.description}</td>
                      <td className="px-3 py-2 text-gray-500">{item.quantity}</td>
                      <td className="px-3 py-2 text-gray-500">{formatCurrency(Number(item.unit_price))}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{formatCurrency(Number(item.line_total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
              <span className="text-lg font-bold text-primary-600">{formatCurrency(Number(detailDoc.total))}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
