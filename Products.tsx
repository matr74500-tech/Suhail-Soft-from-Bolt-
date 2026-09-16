import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/format';
import type { Product, ProductCategory, ProductUnit, Supplier, Currency, ProductBarcode, ProductSupplier } from '@/types/database';
import {
  Plus, Pencil, Trash2, X, Package, Barcode, Truck,
  Download, Upload, Image as ImageIcon, Check, Star, Printer,
} from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';
import BarcodePrinter from '@/components/BarcodePrinter';
import ExcelImport from '@/components/ExcelImport';

interface ProductForm {
  code: string;
  name_ar: string;
  name_en: string;
  category_id: string;
  base_unit_id: string;
  selling_unit_id: string;
  conversion_factor: number;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  currency_id: string;
  min_stock: number;
  reorder_point: number;
  shelf_number: string;
  location: string;
  description: string;
  is_active: boolean;
  requires_serial: boolean;
  image_url: string;
}

const emptyForm: ProductForm = {
  code: '', name_ar: '', name_en: '', category_id: '', base_unit_id: '',
  selling_unit_id: '', conversion_factor: 1, purchase_price: 0, retail_price: 0,
  wholesale_price: 0, currency_id: '', min_stock: 0, reorder_point: 0,
  shelf_number: '', location: '', description: '', is_active: true,
  requires_serial: false, image_url: '',
};

export default function Products() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [tab, setTab] = useState<'info' | 'barcodes' | 'suppliers'>('info');
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [productSuppliers, setProductSuppliers] = useState<ProductSupplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    loadProducts();
    loadMetadata();
  }, []);

  async function loadProducts() {
    let query = supabase.from('products').select(`
      *,
      category:product_categories(*),
      base_unit:product_units!products_base_unit_id_fkey(*),
      selling_unit:product_units!products_selling_unit_id_fkey(*),
      barcodes:product_barcodes(*),
      images:product_images(*)
    `).eq('is_active', true);

    if (search) {
      query = query.or(`name_ar.ilike.%${search}%,code.ilike.%${search}%`);
    }
    if (categoryFilter) {
      query = query.eq('category_id', categoryFilter);
    }
    const { data } = await query.order('name_ar');
    setProducts(data || []);
  }

  async function loadMetadata() {
    const [cats, unts, sups, curs] = await Promise.all([
      supabase.from('product_categories').select('*').eq('is_active', true).order('name_ar'),
      supabase.from('product_units').select('*').eq('is_active', true).order('name_ar'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name_ar'),
      supabase.from('currencies').select('*').eq('is_active', true),
    ]);
    setCategories(cats.data || []);
    setUnits(unts.data || []);
    setSuppliers(sups.data || []);
    setCurrencies(curs.data || []);
  }

  const openAdd = useCallback(() => {
    setEditProduct(null);
    setForm(emptyForm);
    setBarcodes([]);
    setProductSuppliers([]);
    setTab('info');
    setShowModal(true);
  }, []);

  async function openEdit(product: Product) {
    setEditProduct(product);
    setForm({
      code: product.code, name_ar: product.name_ar, name_en: product.name_en || '',
      category_id: product.category_id || '', base_unit_id: product.base_unit_id || '',
      selling_unit_id: product.selling_unit_id || '',
      conversion_factor: Number(product.conversion_factor) || 1,
      purchase_price: Number(product.purchase_price) || 0,
      retail_price: Number(product.retail_price) || 0,
      wholesale_price: Number(product.wholesale_price) || 0,
      currency_id: product.currency_id || '', min_stock: Number(product.min_stock) || 0,
      reorder_point: Number(product.reorder_point) || 0,
      shelf_number: product.shelf_number || '', location: product.location || '',
      description: product.description || '', is_active: product.is_active,
      requires_serial: product.requires_serial,
      image_url: product.images?.find(i => i.is_primary)?.image_url || '',
    });
    setBarcodes(product.barcodes || []);
    const { data: psData } = await supabase.from('product_suppliers')
      .select(`*, supplier:suppliers(*)`).eq('product_id', product.id);
    setProductSuppliers(psData || []);
    setTab('info');
    setShowModal(true);
  }

  async function saveProduct() {
    setSaving(true);
    setError(null);
    try {
      if (!form.code || !form.name_ar) {
        setError('الاسم والكود مطلوبان');
        setSaving(false);
        return;
      }
      const payload = {
        code: form.code, name_ar: form.name_ar, name_en: form.name_en || null,
        category_id: form.category_id || null,
        base_unit_id: form.base_unit_id || null,
        selling_unit_id: form.selling_unit_id || null,
        conversion_factor: form.conversion_factor,
        purchase_price: form.purchase_price, retail_price: form.retail_price,
        wholesale_price: form.wholesale_price,
        currency_id: form.currency_id || null,
        min_stock: form.min_stock, reorder_point: form.reorder_point,
        shelf_number: form.shelf_number || null, location: form.location || null,
        description: form.description || null, is_active: form.is_active,
        requires_serial: form.requires_serial,
      };

      let productId: string;
      if (editProduct) {
        const { error: e } = await supabase.from('products').update(payload).eq('id', editProduct.id);
        if (e) throw e;
        productId = editProduct.id;
      } else {
        const { data, error: e } = await supabase.from('products').insert(payload).select().single();
        if (e) throw e;
        productId = data.id;
      }

      // Save image
      if (form.image_url) {
        const existingImg = editProduct?.images?.find(i => i.is_primary);
        if (existingImg) {
          await supabase.from('product_images').update({ image_url: form.image_url }).eq('id', existingImg.id);
        } else {
          await supabase.from('product_images').insert({
            product_id: productId, image_url: form.image_url, is_primary: true,
          });
        }
      }

      // Save barcodes
      if (editProduct) {
        await supabase.from('product_barcodes').delete().eq('product_id', productId);
      }
      if (barcodes.length > 0) {
        await supabase.from('product_barcodes').insert(
          barcodes.map(b => ({
            product_id: productId, barcode: b.barcode,
            unit_id: b.unit_id || null,
            conversion_factor: Number(b.conversion_factor) || 1,
            is_primary: b.is_primary, is_active: b.is_active,
            barcode_type: b.barcode_type || 'internal',
          }))
        );
      }

      // Save suppliers
      if (editProduct) {
        await supabase.from('product_suppliers').delete().eq('product_id', productId);
      }
      if (productSuppliers.length > 0) {
        await supabase.from('product_suppliers').insert(
          productSuppliers.map(ps => ({
            product_id: productId, supplier_id: ps.supplier_id,
            supplier_product_code: ps.supplier_product_code || null,
            last_purchase_price: ps.last_purchase_price || null,
            is_preferred: ps.is_preferred, is_alternative: ps.is_alternative,
            notes: ps.notes || null,
          }))
        );
      }

      setShowModal(false);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  }

  function exportCSV() {
    const headers = ['الكود', 'الباركود', 'الاسم', 'الفئة', 'وحدة القياس', 'سعر الشراء', 'سعر القطعة', 'سعر الجملة', 'العملة', 'الحد الأدنى', 'الموقع', 'الوصف', 'الحالة'];
    const rows = products.map(p => [
      p.code, p.barcodes?.[0]?.barcode || '', p.name_ar,
      p.category?.name_ar || '', p.base_unit?.name_ar || '',
      p.purchase_price, p.retail_price, p.wholesale_price,
      currencies.find(c => c.id === p.currency_id)?.code || 'YER',
      p.min_stock, p.shelf_number || p.location || '', p.description || '',
      p.is_active ? 'نشط' : 'غير نشط',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products.csv'; a.click();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 flex gap-2">
          <SmartSearch
            value={search}
            onChange={setSearch}
            onSearch={loadProducts}
            placeholder="بحث بالاسم أو الكود..."
            fetchSuggestions={async (q) => {
              const { data } = await supabase.from('products')
                .select('id, name_ar, code, retail_price, barcodes:product_barcodes(barcode)')
                .eq('is_active', true)
                .or(`name_ar.ilike.%${q}%,code.ilike.%${q}%`)
                .limit(8);
              return (data || []).map((p: { id: string; name_ar: string; code: string; retail_price: number; barcodes?: { barcode: string }[] }) => ({
                id: p.id, primary: p.name_ar, secondary: p.code,
                badge: formatCurrency(Number(p.retail_price)),
                badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
                data: p,
              }));
            }}
            onSuggestionSelect={(item) => { setSearch(item.primary); loadProducts(); }}
          />
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); }} className="input w-40">
            <option value="">كل الفئات</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <Upload className="w-4 h-4" /> استيراد
          </button>
          <button onClick={exportCSV} className="btn-secondary">
            <Download className="w-4 h-4" /> تصدير
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus className="w-4 h-4" /> منتج جديد
          </button>
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {product.images?.find(i => i.is_primary)?.image_url ? (
                  <img src={product.images.find(i => i.is_primary)?.image_url} alt={product.name_ar} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{product.name_ar}</p>
                <p className="text-xs text-gray-400">{product.code}</p>
                <div className="flex items-center gap-2 mt-1">
                  {product.barcodes && product.barcodes.length > 0 && (
                    <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Barcode className="w-3 h-3 ml-1" />{product.barcodes.length}
                    </span>
                  )}
                  {product.requires_serial && (
                    <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">تسلسلي</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(Number(product.retail_price))}</p>
                <p className="text-xs text-gray-400">{product.category?.name_ar || 'بدون فئة'}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setBarcodeProduct(product)} className="btn-ghost p-2 text-teal-500" title="طباعة باركود">
                  <Barcode className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(product)} className="btn-ghost p-2 text-blue-500">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد منتجات — أضف منتجًا للبدء</p>
          </div>
        )}
      </div>

      {/* Product modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editProduct ? 'تعديل منتج' : 'منتج جديد'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-3 border-b border-gray-100 dark:border-gray-800">
              {[
                { key: 'info', label: 'بيانات المنتج', icon: Package },
                { key: 'barcodes', label: 'الباركود', icon: Barcode },
                { key: 'suppliers', label: 'الموردون', icon: Truck },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key as 'info' | 'barcodes' | 'suppliers')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      tab === t.key ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="كود المنتج">
                    <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                  </Field>
                  <Field label="الاسم (عربي)">
                    <input className="input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} />
                  </Field>
                  <Field label="الاسم (إنجليزي)">
                    <input className="input" value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} dir="ltr" />
                  </Field>
                  <Field label="الفئة">
                    <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                      <option value="">بدون</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                    </select>
                  </Field>
                  <Field label="وحدة القياس الأساسية">
                    <select className="input" value={form.base_unit_id} onChange={e => setForm({ ...form, base_unit_id: e.target.value })}>
                      <option value="">اختر</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name_ar}</option>)}
                    </select>
                  </Field>
                  <Field label="وحدة البيع">
                    <select className="input" value={form.selling_unit_id} onChange={e => setForm({ ...form, selling_unit_id: e.target.value })}>
                      <option value="">اختر</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name_ar}</option>)}
                    </select>
                  </Field>
                  <Field label="معامل التحويل">
                    <input type="number" step="0.01" className="input" value={form.conversion_factor} onChange={e => setForm({ ...form, conversion_factor: Number(e.target.value) })} />
                  </Field>
                  <Field label="العملة">
                    <select className="input" value={form.currency_id} onChange={e => setForm({ ...form, currency_id: e.target.value })}>
                      <option value="">اختر</option>
                      {currencies.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                    </select>
                  </Field>
                  <Field label="سعر الشراء">
                    <input type="number" step="0.01" className="input" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: Number(e.target.value) })} />
                  </Field>
                  <Field label="سعر القطعة">
                    <input type="number" step="0.01" className="input" value={form.retail_price} onChange={e => setForm({ ...form, retail_price: Number(e.target.value) })} />
                  </Field>
                  <Field label="سعر الجملة">
                    <input type="number" step="0.01" className="input" value={form.wholesale_price} onChange={e => setForm({ ...form, wholesale_price: Number(e.target.value) })} />
                  </Field>
                  <Field label="الحد الأدنى للمخزون">
                    <input type="number" step="0.01" className="input" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })} />
                  </Field>
                  <Field label="نقطة إعادة الطلب">
                    <input type="number" step="0.01" className="input" value={form.reorder_point} onChange={e => setForm({ ...form, reorder_point: Number(e.target.value) })} />
                  </Field>
                  <Field label="رقم الرف">
                    <input className="input" value={form.shelf_number} onChange={e => setForm({ ...form, shelf_number: e.target.value })} />
                  </Field>
                  <Field label="الموقع">
                    <input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                  </Field>
                  <Field label="رابط الصورة">
                    <input className="input" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} dir="ltr" placeholder="https://..." />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="الوصف">
                      <textarea className="input min-h-[60px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded text-primary-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">منتج نشط</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.requires_serial} onChange={e => setForm({ ...form, requires_serial: e.target.checked })} className="w-4 h-4 rounded text-primary-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">يتطلب رقم تسلسلي</span>
                  </label>
                </div>
              )}

              {tab === 'barcodes' && (
                <div className="space-y-3">
                  {barcodes.map((b, i) => (
                    <div key={i} className="flex gap-2 items-end">
                      <Field label="الباركود" className="flex-1">
                        <input className="input" value={b.barcode} onChange={e => setBarcodes(prev => prev.map((x, idx) => idx === i ? { ...x, barcode: e.target.value } : x))} dir="ltr" />
                      </Field>
                      <Field label="الوحدة">
                        <select className="input" value={b.unit_id || ''} onChange={e => setBarcodes(prev => prev.map((x, idx) => idx === i ? { ...x, unit_id: e.target.value || null } : x))}>
                          <option value="">افتراضي</option>
                          {units.map(u => <option key={u.id} value={u.id}>{u.name_ar}</option>)}
                        </select>
                      </Field>
                      <Field label="معامل التحويل">
                        <input type="number" step="0.01" className="input w-20" value={b.conversion_factor} onChange={e => setBarcodes(prev => prev.map((x, idx) => idx === i ? { ...x, conversion_factor: Number(e.target.value) } : x))} />
                      </Field>
                      <button
                        onClick={() => setBarcodes(prev => prev.map((x, idx) => idx === i ? { ...x, is_primary: true } : { ...x, is_primary: false }))}
                        className={`btn p-2 ${b.is_primary ? 'text-amber-500' : 'text-gray-400'}`}
                        title="باركود رئيسي"
                      >
                        <Star className={`w-5 h-5 ${b.is_primary ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => setBarcodes(prev => prev.map((x, idx) => idx === i ? { ...x, is_active: !x.is_active } : x))}
                        className={`btn p-2 ${b.is_active ? 'text-emerald-500' : 'text-gray-400'}`}
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => setBarcodes(prev => prev.filter((_, idx) => idx !== i))} className="btn p-2 text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setBarcodes([...barcodes, { id: '', product_id: '', barcode: '', unit_id: null, conversion_factor: 1, is_primary: barcodes.length === 0, is_active: true, barcode_type: 'internal' }])}
                    className="btn-secondary w-full"
                  >
                    <Plus className="w-4 h-4" /> إضافة باركود
                  </button>
                </div>
              )}

              {tab === 'suppliers' && (
                <div className="space-y-3">
                  {productSuppliers.map((ps, i) => (
                    <div key={i} className="flex gap-2 items-end flex-wrap">
                      <Field label="المورد" className="flex-1 min-w-[150px]">
                        <select className="input" value={ps.supplier_id} onChange={e => setProductSuppliers(prev => prev.map((x, idx) => idx === i ? { ...x, supplier_id: e.target.value } : x))}>
                          <option value="">اختر</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}
                        </select>
                      </Field>
                      <Field label="كود المورد">
                        <input className="input w-28" value={ps.supplier_product_code || ''} onChange={e => setProductSuppliers(prev => prev.map((x, idx) => idx === i ? { ...x, supplier_product_code: e.target.value } : x))} dir="ltr" />
                      </Field>
                      <Field label="آخر سعر">
                        <input type="number" step="0.01" className="input w-24" value={ps.last_purchase_price || ''} onChange={e => setProductSuppliers(prev => prev.map((x, idx) => idx === i ? { ...x, last_purchase_price: Number(e.target.value) } : x))} />
                      </Field>
                      <button
                        onClick={() => setProductSuppliers(prev => prev.map((x, idx) => idx === i ? { ...x, is_preferred: !x.is_preferred } : x))}
                        className={`btn p-2 ${ps.is_preferred ? 'text-amber-500' : 'text-gray-400'}`}
                        title="مورد مفضل"
                      >
                        <Star className={`w-5 h-5 ${ps.is_preferred ? 'fill-current' : ''}`} />
                      </button>
                      <button onClick={() => setProductSuppliers(prev => prev.filter((_, idx) => idx !== i))} className="btn p-2 text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setProductSuppliers([...productSuppliers, { id: '', product_id: '', supplier_id: '', supplier_product_code: '', last_purchase_price: 0, last_purchase_date: null, is_preferred: false, is_alternative: false, notes: '' }])}
                    className="btn-secondary w-full"
                  >
                    <Plus className="w-4 h-4" /> إضافة مورد
                  </button>
                </div>
              )}

              {error && <div className="mt-4 bg-red-50 dark:bg-red-900/30 text-red-600 text-sm rounded-lg p-3">{error}</div>}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setShowModal(false)} className="btn-secondary">إلغاء</button>
              <button onClick={saveProduct} disabled={saving} className="btn-primary">
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
