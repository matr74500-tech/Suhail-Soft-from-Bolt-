import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime, getAlertState, ALERT_STATE_LABELS } from '@/lib/format';
import { Modal } from '@/pages/Customers';
import type { StockLevel, StockMovement, Warehouse, ProductCategory } from '@/types/database';
import {
  Download, Package, ArrowUpDown, History, X, AlertTriangle,
} from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

export default function Inventory() {
  const { profile } = useAuth();
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [alertFilter, setAlertFilter] = useState('');
  const [adjustModal, setAdjustModal] = useState<StockLevel | null>(null);
  const [historyModal, setHistoryModal] = useState<StockLevel | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStock();
    supabase.from('warehouses').select('*, branch:branches(*)').eq('is_active', true).then(({ data }) => setWarehouses(data || []));
    supabase.from('product_categories').select('*').eq('is_active', true).then(({ data }) => setCategories(data || []));
  }, []);

  async function loadStock() {
    let q = supabase.from('stock_levels').select(`
      *,
      product:products(*, category:product_categories(*)),
      warehouse:warehouses(*)
    `);
    if (warehouseFilter) q = q.eq('warehouse_id', warehouseFilter);
    if (search) {
      q = q.or(`product.name_ar.ilike.%${search}%,product.code.ilike.%${search}%`);
    }
    const { data } = await q.order('updated_at', { ascending: false });
    let filtered = data || [];
    if (categoryFilter) {
      filtered = filtered.filter(sl => sl.product?.category_id === categoryFilter);
    }
    if (alertFilter) {
      filtered = filtered.filter(sl => {
        if (!sl.product) return false;
        const state = getAlertState(Number(sl.quantity), Number(sl.product.min_stock), Number(sl.product.reorder_point));
        return state === alertFilter;
      });
    }
    setStockLevels(filtered);
  }

  async function openHistory(sl: StockLevel) {
    setHistoryModal(sl);
    const { data } = await supabase.from('stock_movements')
      .select(`*, user_name, created_at`).eq('product_id', sl.product_id).eq('warehouse_id', sl.warehouse_id)
      .order('created_at', { ascending: false }).limit(30);
    setMovements(data || []);
  }

  function openAdjust(sl: StockLevel) {
    setAdjustModal(sl);
    setAdjustQty(Number(sl.quantity));
    setAdjustNotes('');
  }

  async function saveAdjust() {
    if (!adjustModal) return;
    setSaving(true);
    const oldQty = Number(adjustModal.quantity);
    const newQty = adjustQty;
    const diff = newQty - oldQty;

    await supabase.from('stock_levels').update({ quantity: newQty }).eq('id', adjustModal.id);
    await supabase.from('stock_movements').insert({
      product_id: adjustModal.product_id,
      warehouse_id: adjustModal.warehouse_id,
      movement_type: 'adjustment',
      quantity: diff,
      unit_cost: 0,
      total_cost: 0,
      reference_type: 'adjustment',
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
      branch_id: profile?.branch_id || null,
      notes: adjustNotes || 'تعديل مخزون',
    });

    setSaving(false);
    setAdjustModal(null);
    loadStock();
  }

  function exportCSV() {
    const headers = ['الكود', 'المنتج', 'الكمية', 'المستودع', 'الحد الأدنى', 'نقطة الطلب', 'الحالة'];
    const rows = stockLevels.map(sl => {
      const p = sl.product as { code: string; name_ar: string; min_stock: number; reorder_point: number } | undefined;
      const state = p ? getAlertState(Number(sl.quantity), Number(p.min_stock), Number(p.reorder_point)) : 'normal';
      return [p?.code || '', p?.name_ar || '', sl.quantity, sl.warehouse?.name_ar || '', p?.min_stock || 0, p?.reorder_point || 0, ALERT_STATE_LABELS[state]];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'inventory.csv'; a.click();
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
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={loadStock}
          placeholder="بحث عن منتج..."
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('products')
              .select('id, name_ar, code')
              .eq('is_active', true)
              .or(`name_ar.ilike.%${q}%,code.ilike.%${q}%`)
              .limit(8);
            return (data || []).map((p: { id: string; name_ar: string; code: string }) => ({
              id: p.id, primary: p.name_ar, secondary: p.code, data: p,
            }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); loadStock(); }}
        />
        <select className="input w-auto" value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}>
          <option value="">كل المستودعات</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
        </select>
        <select className="input w-auto" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <select className="input w-auto" value={alertFilter} onChange={e => setAlertFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="normal">عادي</option>
          <option value="near_reorder">قرب نقطة الطلب</option>
          <option value="reorder_required">يتطلب طلبًا</option>
          <option value="low">منخفض</option>
          <option value="out_of_stock">نفد</option>
        </select>
        <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> تصدير</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">الكود</th>
              <th className="px-4 py-3 font-medium">المنتج</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">المستودع</th>
              <th className="px-4 py-3 font-medium">الكمية</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {stockLevels.map(sl => {
              const p = sl.product as { code: string; name_ar: string; min_stock: number; reorder_point: number } | undefined;
              const state = p ? getAlertState(Number(sl.quantity), Number(p.min_stock), Number(p.reorder_point)) : 'normal';
              return (
                <tr key={sl.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p?.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p?.name_ar}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{sl.warehouse?.name_ar}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{Number(sl.quantity)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell"><span className={`badge ${alertColors[state]}`}>{ALERT_STATE_LABELS[state]}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openHistory(sl)} className="btn-ghost p-1.5 text-blue-500" title="السجل"><History className="w-4 h-4" /></button>
                      <button onClick={() => openAdjust(sl)} className="btn-ghost p-1.5 text-amber-500" title="تعديل"><ArrowUpDown className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {stockLevels.length === 0 && <div className="text-center py-12 text-gray-400"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد بيانات مخزون</p></div>}
      </div>

      {adjustModal && (
        <Modal onClose={() => setAdjustModal(null)} title="تعديل المخزون">
          <div className="space-y-4">
            <div className="card p-4 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-sm text-gray-500">المنتج</p>
              <p className="font-bold text-gray-900 dark:text-white">{(adjustModal.product as { name_ar: string })?.name_ar}</p>
              <p className="text-sm text-gray-500 mt-2">الكمية الحالية: <span className="font-bold">{Number(adjustModal.quantity)}</span></p>
            </div>
            <div>
              <label className="label">الكمية الجديدة</label>
              <input type="number" step="0.01" className="input text-lg" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">سبب التعديل</label>
              <textarea className="input min-h-[60px]" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} placeholder="سبب تعديل المخزون..." />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdjustModal(null)} className="btn-secondary">إلغاء</button>
              <button onClick={saveAdjust} disabled={saving} className="btn-primary">{saving ? 'جارٍ الحفظ...' : 'حفظ التعديل'}</button>
            </div>
          </div>
        </Modal>
      )}

      {historyModal && (
        <Modal onClose={() => setHistoryModal(null)} title={`سجل الحركة — ${(historyModal.product as { name_ar: string })?.name_ar}`}>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {movements.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${Number(m.quantity) > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <span className="text-xs font-bold">{Number(m.quantity) > 0 ? '+' : ''}{Number(m.quantity)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{m.movement_type}</p>
                  <p className="text-xs text-gray-400">{m.notes} — {m.user_name}</p>
                </div>
                <span className="text-xs text-gray-400">{formatDateTime(m.created_at)}</span>
              </div>
            ))}
            {movements.length === 0 && <p className="text-center py-6 text-gray-400">لا توجد حركات</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
