import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/lib/format';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import type { Product, ProductBarcode, Customer, FinancialAccount, PaymentMethod, ProductUnit } from '@/types/database';
import {
  ScanLine, Search, Trash2, Plus, Minus, X, CheckCircle2,
  ShoppingCart, Printer, User, Wallet, AlertCircle, Loader2,
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
  unit_id: string | null;
  unit_name: string;
  unit_price: number;
  unit_cost: number;
  conversion_factor: number;
  line_total: number;
  barcode_used: string;
}

export default function POS() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitPayments, setSplitPayments] = useState<{ method: PaymentMethod; amount: number; account_id: string | null }[]>([
    { method: 'cash', amount: 0, account_id: null },
  ]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    barcodeRef.current?.focus();
    loadCustomers();
    loadAccounts();
    loadWarehouse();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase.from('customers').select('*').eq('is_active', true).order('name_ar');
    setCustomers(data || []);
  }

  async function loadAccounts() {
    const { data } = await supabase.from('financial_accounts').select('*').eq('is_active', true);
    setAccounts(data || []);
  }

  async function loadWarehouse() {
    const { data } = await supabase.from('warehouses').select('*').limit(1).maybeSingle();
    if (data) setWarehouseId(data.id);
  }

  // Barcode scanner: rapid key input detected
  const lastKeyTime = useRef<number>(0);
  const barcodeBuffer = useRef<string>('');

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (code) {
        lookupBarcode(code);
        setBarcodeInput('');
        barcodeBuffer.current = '';
      }
      return;
    }
    const now = Date.now();
    if (now - lastKeyTime.current > 100) {
      barcodeBuffer.current = '';
    }
    lastKeyTime.current = now;
    barcodeBuffer.current += e.key;
  };

  const lookupBarcode = useCallback(async (code: string) => {
    setError(null);
    const { data: barcodeData } = await supabase
      .from('product_barcodes')
      .select(`
        *,
        product:products(*),
        unit:product_units(*)
      `)
      .eq('barcode', code)
      .eq('is_active', true)
      .maybeSingle();

    if (!barcodeData) {
      setError(`لم يتم العثور على منتج بالباركود: ${code}`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    const product = Array.isArray(barcodeData.product) ? barcodeData.product[0] : barcodeData.product;
    const unit = Array.isArray(barcodeData.unit) ? barcodeData.unit[0] : barcodeData.unit;
    if (!product) {
      setError(`لم يتم العثور على منتج بالباركود: ${code}`);
      setTimeout(() => setError(null), 3000);
      return;
    }
    const conversionFactor = Number(barcodeData.conversion_factor) || 1;

    addToCart(product as Product, conversionFactor, (unit as ProductUnit | null) ?? null, code);
  }, []);

  function addToCart(product: Product, conversionFactor: number, unit: ProductUnit | null, barcode: string) {
    const unitPrice = Number(product.retail_price) * conversionFactor;
    const unitCost = Number(product.purchase_price) * conversionFactor;
    const unitName = unit?.name_ar || 'قطعة';

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.unit_id === (unit?.id ?? null));
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.unit_id === (unit?.id ?? null)
            ? { ...item, quantity: item.quantity + 1, line_total: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [...prev, {
        product,
        quantity: 1,
        unit_id: unit?.id ?? null,
        unit_name: unitName,
        unit_price: unitPrice,
        unit_cost: unitCost,
        conversion_factor: conversionFactor,
        line_total: unitPrice,
        barcode_used: barcode,
      }];
    });
  }

  function updateQuantity(index: number, delta: number) {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      return { ...item, quantity: newQty, line_total: newQty * item.unit_price };
    }));
  }

  function setQuantity(index: number, qty: number) {
    if (qty <= 0) return;
    setCart(prev => prev.map((item, i) =>
      i === index ? { ...item, quantity: qty, line_total: qty * item.unit_price } : item
    ));
  }

  function removeFromCart(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  const subtotal = cart.reduce((s, item) => s + item.line_total, 0);
  const total = subtotal - discountAmount;
  const remaining = total - paidAmount;

  // Search products
  useEffect(() => {
    if (!searchQuery.trim() || !settings.product_search_enabled) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          barcodes:product_barcodes(*)
        `)
        .eq('is_active', true)
        .or(`name_ar.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`)
        .limit(10);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, settings.product_search_enabled]);

  async function completeSale() {
    if (cart.length === 0) return;
    setCompleting(true);
    setError(null);

    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const userName = profile?.full_name_ar || 'غير معروف';

      // Generate document number
      const { data: docData, error: docError } = await supabase.from('documents').insert({
        document_number: invoiceNumber,
        doc_type: 'sales',
        status: 'approved',
        document_date: new Date().toISOString().split('T')[0],
        party_type: 'customer',
        customer_id: selectedCustomer?.id || null,
        warehouse_id: warehouseId,
        branch_id: profile?.branch_id || null,
        subtotal,
        discount_amount: discountAmount,
        total,
        paid_amount: paidAmount,
        remaining_amount: remaining,
        total_cost: cart.reduce((s, item) => s + item.unit_cost * item.quantity, 0),
        gross_profit: total - cart.reduce((s, item) => s + item.unit_cost * item.quantity, 0),
        payment_method: paymentMethod === 'split' ? 'split' : paymentMethod,
        user_id: profile?.id,
        user_name: userName,
      }).select().single();

      if (docError) throw new Error(docError.message);
      const docId = docData.id;

      // Insert items
      const items = cart.map(item => ({
        document_id: docId,
        product_id: item.product.id,
        item_type: 'product',
        description: item.product.name_ar,
        unit_id: item.unit_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        line_total: item.line_total,
        line_cost: item.unit_cost * item.quantity,
        barcode_used: item.barcode_used,
      }));
      await supabase.from('document_items').insert(items);

      // Insert payments
      if (paymentMethod === 'split') {
        const payments = splitPayments
          .filter(p => p.amount > 0)
          .map(p => ({
            document_id: docId,
            payment_method: p.method,
            amount: p.amount,
            financial_account_id: p.account_id,
            user_id: profile?.id,
            user_name: userName,
          }));
        if (payments.length > 0) {
          await supabase.from('document_payments').insert(payments);
        }
      } else {
        await supabase.from('document_payments').insert({
          document_id: docId,
          payment_method: paymentMethod,
          amount: paidAmount || total,
          user_id: profile?.id,
          user_name: userName,
        });
      }

      // Deduct stock and create stock movements
      for (const item of cart) {
        if (!warehouseId) continue;

        const { data: stockData } = await supabase
          .from('stock_levels')
          .select('id, quantity')
          .eq('product_id', item.product.id)
          .eq('warehouse_id', warehouseId)
          .maybeSingle();

        const currentQty = stockData ? Number(stockData.quantity) : 0;
        const deductQty = item.quantity * item.conversion_factor;
        const newQty = currentQty - deductQty;

        if (stockData) {
          await supabase.from('stock_levels').update({
            quantity: newQty,
          }).eq('id', stockData.id);
        } else {
          await supabase.from('stock_levels').insert({
            product_id: item.product.id,
            warehouse_id: warehouseId,
            quantity: newQty,
          });
        }

        await supabase.from('stock_movements').insert({
          product_id: item.product.id,
          warehouse_id: warehouseId,
          movement_type: 'sale',
          quantity: -deductQty,
          unit_cost: item.unit_cost,
          total_cost: item.unit_cost * item.quantity,
          reference_type: 'document',
          reference_id: docId,
          user_id: profile?.id,
          user_name: userName,
          branch_id: profile?.branch_id || null,
        });
      }

      // Update customer balance if credit
      if (selectedCustomer && remaining > 0 && paymentMethod === 'credit') {
        await supabase.from('customers').update({
          current_balance: Number(selectedCustomer.current_balance) + remaining,
          last_order_date: new Date().toISOString(),
        }).eq('id', selectedCustomer.id);
      } else if (selectedCustomer) {
        await supabase.from('customers').update({
          last_order_date: new Date().toISOString(),
        }).eq('id', selectedCustomer.id);
      }

      // Update financial account balances
      if (paymentMethod !== 'credit' && paymentMethod !== 'split') {
        const account = accounts.find(a => a.account_type ===
          (paymentMethod === 'cash' ? 'cash' :
           paymentMethod === 'wallet' ? 'wallet' :
           paymentMethod === 'bank_account' || paymentMethod === 'bank_transfer' ? 'bank' :
           'local_transfer'));
        if (account) {
          await supabase.from('financial_accounts').update({
            current_balance: Number(account.current_balance) + (paidAmount || total),
          }).eq('id', account.id);
        }
      } else if (paymentMethod === 'split') {
        for (const p of splitPayments.filter(p => p.amount > 0 && p.account_id)) {
          const acc = accounts.find(a => a.id === p.account_id);
          if (acc) {
            await supabase.from('financial_accounts').update({
              current_balance: Number(acc.current_balance) + p.amount,
            }).eq('id', acc.id);
          }
        }
      }

      setSuccess(`تم إتمام البيع — رقم الفاتورة: ${invoiceNumber}`);
      setLastInvoiceNumber(invoiceNumber);
      setCart([]);
      setDiscountAmount(0);
      setPaidAmount(0);
      setSelectedCustomer(null);
      setSplitPayments([{ method: 'cash', amount: 0, account_id: null }]);
      setPaymentMethod('cash');
      setShowPayment(false);
      setTimeout(() => setSuccess(null), 5000);
      barcodeRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إتمام البيع');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Left: Barcode + Cart */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Barcode scanner input */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30">
              <ScanLine className="w-6 h-6 text-primary-600 dark:text-primary-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                className="input text-lg font-medium"
                placeholder="امسح الباركود هنا..."
                autoFocus
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            الماسح الضوئي جاهز — امسح المنتج لإضافته للسلة
          </p>
        </div>

        {/* Optional product search */}
        {settings.product_search_enabled && (
          <div className="card p-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearch(e.target.value.length > 0);
                }}
                className="input border-0 focus:ring-0"
                placeholder="بحث بالاسم أو الكود (اختياري)"
              />
            </div>
            {showSearch && searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    onClick={() => {
                      const primaryBarcode = product.barcodes?.find((b: ProductBarcode) => b.is_primary) || product.barcodes?.[0];
                      addToCart(product, 1, null, primaryBarcode?.barcode || product.code);
                      setSearchQuery('');
                      setShowSearch(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{product.name_ar}</span>
                    <span className="text-primary-600 dark:text-primary-400 font-medium">{formatCurrency(Number(product.retail_price))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cart */}
        <div className="card flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">السلة</h3>
              <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">{cart.length}</span>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-sm text-red-500 hover:text-red-600">
                مسح الكل
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">السلة فارغة — امسح منتجًا للبدء</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {cart.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 animate-fade-in">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.product.name_ar}</p>
                      <p className="text-xs text-gray-400">{item.unit_name} × {formatCurrency(item.unit_price)}</p>
                    </div>
                    {settings.manual_quantity_enabled && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQuantity(index, -1)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Minus className="w-4 h-4 text-gray-500" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => setQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-12 text-center text-sm bg-transparent border-0 focus:ring-0 outline-none"
                        />
                        <button onClick={() => updateQuantity(index, 1)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Plus className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}
                    {!settings.manual_quantity_enabled && (
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.quantity}</span>
                    )}
                    <span className="text-sm font-bold text-gray-900 dark:text-white w-24 text-left">
                      {formatCurrency(item.line_total)}
                    </span>
                    <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Summary + Payment */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Customer selection */}
        <div className="card p-4">
          <button
            onClick={() => setShowCustomerSelect(!showCustomerSelect)}
            className="w-full flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <User className="w-4 h-4" />
            {selectedCustomer ? selectedCustomer.name_ar : 'اختر العميل (اختياري)'}
          </button>
          {showCustomerSelect && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              <button
                onClick={() => { setSelectedCustomer(null); setShowCustomerSelect(false); }}
                className="w-full text-right p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-gray-500"
              >
                بدون عميل
              </button>
              {customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerSelect(false); }}
                  className="w-full text-right p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                >
                  {c.name_ar}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="card p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">المجموع الفرعي</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">الخصم</span>
            <input
              type="number"
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 text-left input py-1 text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-gray-900 dark:text-white">الإجمالي</span>
            <span className="text-primary-600 dark:text-primary-400">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Payment section */}
        {!showPayment ? (
          <button
            onClick={() => setShowPayment(true)}
            disabled={cart.length === 0}
            className="btn-primary w-full text-lg py-3"
          >
            <Wallet className="w-5 h-5" />
            الدفع
          </button>
        ) : (
          <div className="card p-4 space-y-3 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">طريقة الدفع</h3>
              <button onClick={() => setShowPayment(false)} className="btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => {
                    setPaymentMethod(pm.value);
                    if (pm.value !== 'split') {
                      setPaidAmount(total);
                    }
                  }}
                  className={`p-2.5 rounded-lg text-sm font-medium transition-all ${
                    paymentMethod === pm.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {pm.labelAr}
                </button>
              ))}
            </div>

            {paymentMethod === 'split' && (
              <div className="space-y-2">
                {splitPayments.map((sp, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={sp.method}
                      onChange={(e) => setSplitPayments(prev => prev.map((p, idx) =>
                        idx === i ? { ...p, method: e.target.value as PaymentMethod } : p
                      ))}
                      className="input flex-1 text-sm"
                    >
                      {PAYMENT_METHODS.filter(m => m.value !== 'split').map(m => (
                        <option key={m.value} value={m.value}>{m.labelAr}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={sp.amount || ''}
                      onChange={(e) => setSplitPayments(prev => prev.map((p, idx) =>
                        idx === i ? { ...p, amount: Number(e.target.value) || 0 } : p
                      ))}
                      className="w-20 input text-sm"
                      placeholder="0"
                    />
                    {i === splitPayments.length - 1 ? (
                      <button onClick={() => setSplitPayments([...splitPayments, { method: 'cash', amount: 0, account_id: null }])} className="btn-ghost p-1">
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => setSplitPayments(prev => prev.filter((_, idx) => idx !== i))} className="btn-ghost p-1 text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-400">
                  المدفوع: {formatCurrency(splitPayments.reduce((s, p) => s + p.amount, 0))} / {formatCurrency(total)}
                </p>
              </div>
            )}

            {paymentMethod !== 'split' && paymentMethod !== 'credit' && (
              <div>
                <label className="label">المبلغ المدفوع</label>
                <input
                  type="number"
                  value={paidAmount || ''}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  className="input text-lg font-bold"
                  placeholder={String(total)}
                />
                {paidAmount > total && (
                  <p className="text-xs text-emerald-600 mt-1">الباقي للعميل: {formatCurrency(paidAmount - total)}</p>
                )}
              </div>
            )}

            {paymentMethod === 'credit' && selectedCustomer && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                سيتم إضافة {formatCurrency(total)} إلى رصيد العميل
              </p>
            )}
            {paymentMethod === 'credit' && !selectedCustomer && (
              <p className="text-sm text-red-500">يجب اختيار عميل للبيع بالآجل</p>
            )}

            <button
              onClick={completeSale}
              disabled={completing || (paymentMethod === 'credit' && !selectedCustomer)}
              className="btn-primary w-full text-lg py-3"
            >
              {completing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              إتمام البيع
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg p-3 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg p-3 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
