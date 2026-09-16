import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getAlertState, ALERT_STATE_LABELS } from '@/lib/format';
import type { StockLevel, Customer, FinancialAccount } from '@/types/database';
import {
  TrendingUp, ShoppingBag, DollarSign, AlertTriangle, Package,
  Users, Wallet, ArrowUpRight, ArrowDownRight, Clock, BarChart3,
  ScanLine, Receipt, Wrench, Banknote, Moon, Settings as SettingsIcon,
  Truck, FileText, ArrowLeftRight, PackageSearch, UserCheck, BookOpen,
  ArrowLeft,
} from 'lucide-react';

interface DashboardStats {
  todaySales: number;
  monthSales: number;
  todayPurchases: number;
  todayExpenses: number;
  todayProfit: number;
  todayCogs: number;
  todayServiceRevenue: number;
  customerDebts: number;
  supplierBalances: number;
  lowStockCount: number;
  outOfStockCount: number;
  reorderCount: number;
  inactiveCustomers: number;
  cashBalance: number;
  walletBalance: number;
  bankBalance: number;
  transferBalance: number;
}

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0, monthSales: 0, todayPurchases: 0, todayExpenses: 0,
    todayProfit: 0, todayCogs: 0, todayServiceRevenue: 0,
    customerDebts: 0, supplierBalances: 0,
    lowStockCount: 0, outOfStockCount: 0, reorderCount: 0, inactiveCustomers: 0,
    cashBalance: 0, walletBalance: 0, bankBalance: 0, transferBalance: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<StockLevel[]>([]);
  const [inactiveCustomersList, setInactiveCustomersList] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [salesToday, salesMonth, purchasesToday, expensesToday, serviceRevToday,
           customers, suppliers, stockLevels, accountsData] = await Promise.all([
      supabase.from('documents').select('total, total_cost, gross_profit')
        .eq('doc_type', 'sales').eq('status', 'approved')
        .gte('document_date', today).lte('document_date', today),
      supabase.from('documents').select('total')
        .eq('doc_type', 'sales').eq('status', 'approved')
        .gte('document_date', monthStart),
      supabase.from('documents').select('total')
        .eq('doc_type', 'purchase').eq('status', 'approved')
        .gte('document_date', today).lte('document_date', today),
      supabase.from('expenses').select('amount')
        .gte('expense_date', today).lte('expense_date', today),
      supabase.from('service_revenues').select('amount')
        .gte('revenue_date', today).lte('revenue_date', today),
      supabase.from('customers').select('*'),
      supabase.from('suppliers').select('current_balance'),
      supabase.from('stock_levels').select(`
        *,
        product:products(id, name_ar, code, min_stock, reorder_point)
      `),
      supabase.from('financial_accounts').select('*').eq('is_active', true),
    ]);

    const todaySalesTotal = salesToday.data?.reduce((s, d) => s + Number(d.total), 0) || 0;
    const todayCogsTotal = salesToday.data?.reduce((s, d) => s + Number(d.total_cost), 0) || 0;
    const todayProfitTotal = salesToday.data?.reduce((s, d) => s + Number(d.gross_profit), 0) || 0;
    const monthSalesTotal = salesMonth.data?.reduce((s, d) => s + Number(d.total), 0) || 0;
    const purchasesTotal = purchasesToday.data?.reduce((s, d) => s + Number(d.total), 0) || 0;
    const expensesTotal = expensesToday.data?.reduce((s, e) => s + Number(e.amount), 0) || 0;
    const serviceTotal = serviceRevToday.data?.reduce((s, r) => s + Number(r.amount), 0) || 0;
    const customerDebts = customers.data?.reduce((s, c) => s + Number(c.current_balance), 0) || 0;
    const supplierBals = suppliers.data?.reduce((s, c) => s + Number(c.current_balance), 0) || 0;

    let low = 0, out = 0, reorder = 0;
    const lowItems: StockLevel[] = [];
    (stockLevels.data || []).forEach(sl => {
      const product = sl.product as { min_stock: number; reorder_point: number; name_ar: string; code: string } | { min_stock: number; reorder_point: number; name_ar: string; code: string }[] | undefined;
      const p = Array.isArray(product) ? product[0] : product;
      if (p) {
        const state = getAlertState(Number(sl.quantity), Number(p.min_stock), Number(p.reorder_point));
        if (state === 'out_of_stock') out++;
        else if (state === 'low') low++;
        else if (state === 'reorder_required') reorder++;
        if (state !== 'normal') lowItems.push(sl);
      }
    });

    const inactivityDays = 30;
    const inactiveCusts: Customer[] = [];
    const inactivityThreshold = new Date();
    inactivityThreshold.setDate(inactivityThreshold.getDate() - inactivityDays);
    (customers.data || []).forEach(c => {
      if (c.last_order_date) {
        const lastDate = new Date(c.last_order_date);
        if (lastDate < inactivityThreshold) inactiveCusts.push(c);
      } else if (new Date(c.created_at) < inactivityThreshold) {
        inactiveCusts.push(c);
      }
    });

    const cashBal = accountsData.data?.filter(a => a.account_type === 'cash').reduce((s, a) => s + Number(a.current_balance), 0) || 0;
    const walletBal = accountsData.data?.filter(a => a.account_type === 'wallet').reduce((s, a) => s + Number(a.current_balance), 0) || 0;
    const bankBal = accountsData.data?.filter(a => a.account_type === 'bank').reduce((s, a) => s + Number(a.current_balance), 0) || 0;
    const transferBal = accountsData.data?.filter(a => a.account_type === 'local_transfer').reduce((s, a) => s + Number(a.current_balance), 0) || 0;

    setStats({
      todaySales: todaySalesTotal, monthSales: monthSalesTotal,
      todayPurchases: purchasesTotal, todayExpenses: expensesTotal,
      todayProfit: todayProfitTotal, todayCogs: todayCogsTotal,
      todayServiceRevenue: serviceTotal,
      customerDebts, supplierBalances: supplierBals,
      lowStockCount: low, outOfStockCount: out, reorderCount: reorder,
      inactiveCustomers: inactiveCusts.length,
      cashBalance: cashBal, walletBalance: walletBal,
      bankBalance: bankBal, transferBalance: transferBal,
    });
    setLowStockItems(lowItems.slice(0, 5));
    setInactiveCustomersList(inactiveCusts.slice(0, 5));
    setAccounts(accountsData.data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quick action buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <QuickAction label="بيع سريع" icon={ScanLine} onClick={() => onNavigate('pos')} color="emerald" />
        <QuickAction label="المنتجات" icon={Package} onClick={() => onNavigate('products')} color="blue" />
        <QuickAction label="المخزون" icon={PackageSearch} onClick={() => onNavigate('inventory')} color="teal" />
        <QuickAction label="الموردون" icon={Truck} onClick={() => onNavigate('suppliers')} color="amber" />
        <QuickAction label="المشتريات" icon={ShoppingBag} onClick={() => onNavigate('purchases')} color="orange" />
        <QuickAction label="المصروفات" icon={Receipt} onClick={() => onNavigate('expenses')} color="red" />
        <QuickAction label="التقارير" icon={BarChart3} onClick={() => onNavigate('reports')} color="purple" />
        <QuickAction label="الإعدادات" icon={SettingsIcon} onClick={() => onNavigate('settings')} color="gray" />
      </div>

      {/* KPI Cards - clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="مبيعات اليوم"
          value={formatCurrency(stats.todaySales)}
          icon={TrendingUp}
          color="emerald"
          subtitle={`الربح: ${formatCurrency(stats.todayProfit)}`}
          onClick={() => onNavigate('documents')}
        />
        <StatCard
          title="مبيعات الشهر"
          value={formatCurrency(stats.monthSales)}
          icon={BarChart3}
          color="blue"
          subtitle={`${formatDate(new Date())}`}
          onClick={() => onNavigate('reports')}
        />
        <StatCard
          title="مشتريات اليوم"
          value={formatCurrency(stats.todayPurchases)}
          icon={ShoppingBag}
          color="amber"
          onClick={() => onNavigate('purchases')}
        />
        <StatCard
          title="مصروفات اليوم"
          value={formatCurrency(stats.todayExpenses)}
          icon={DollarSign}
          color="red"
          subtitle={`إيرادات أخرى: ${formatCurrency(stats.todayServiceRevenue)}`}
          onClick={() => onNavigate('expenses')}
        />
      </div>

      {/* Financial balances - clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="النقدية" value={formatCurrency(stats.cashBalance)} icon={Wallet} color="emerald" compact onClick={() => onNavigate('accounts')} />
        <StatCard title="المحافظ الإلكترونية" value={formatCurrency(stats.walletBalance)} icon={Wallet} color="purple" compact onClick={() => onNavigate('accounts')} />
        <StatCard title="البنوك" value={formatCurrency(stats.bankBalance)} icon={Banknote} color="blue" compact onClick={() => onNavigate('accounts')} />
        <StatCard title="الحوالات المحلية" value={formatCurrency(stats.transferBalance)} icon={ArrowLeftRight} color="teal" compact onClick={() => onNavigate('accounts')} />
      </div>

      {/* Alerts and balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inventory alerts */}
        <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('inventory')}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">تنبيهات المخزون</h3>
            </div>
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            <AlertRow label="نفد المخزون" count={stats.outOfStockCount} color="red" />
            <AlertRow label="مخزون منخفض" count={stats.lowStockCount} color="amber" />
            <AlertRow label="يتطلب طلبًا" count={stats.reorderCount} color="orange" />
          </div>
          {lowStockItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 mb-2">الأكثر إلحاحًا:</p>
              {lowStockItems.map((item) => {
                const product = item.product as { name_ar: string; code: string; min_stock: number; reorder_point: number } | { name_ar: string; code: string; min_stock: number; reorder_point: number }[] | undefined;
                const p = Array.isArray(product) ? product[0] : product;
                const state = p ? getAlertState(Number(item.quantity), Number(p.min_stock), Number(p.reorder_point)) : 'normal';
                return (
                  <div key={item.id} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-gray-700 dark:text-gray-300 truncate">{p?.name_ar}</span>
                    <span className={`badge ${
                      state === 'out_of_stock' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      state === 'low' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {ALERT_STATE_LABELS[state]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customers & suppliers */}
        <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('customers')}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">العملاء والموردون</h3>
            </div>
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-red-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">ديون العملاء</span>
              </div>
              <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.customerDebts)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">أرصدة الموردين</span>
              </div>
              <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.supplierBalances)}</span>
            </div>
            <div className="flex items-center justify-between cursor-pointer" onClick={(e) => { e.stopPropagation(); onNavigate('inactive-customers'); }}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">عملاء غير نشطين</span>
              </div>
              <span className="font-bold text-orange-600 dark:text-orange-400">{stats.inactiveCustomers}</span>
            </div>
          </div>
          {inactiveCustomersList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 mb-2">يحتاجون متابعة:</p>
              {inactiveCustomersList.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm py-1.5">
                  <span className="text-gray-700 dark:text-gray-300 truncate">{c.name_ar}</span>
                  <span className="text-xs text-gray-400">{c.last_order_date ? formatDate(c.last_order_date) : 'لا توجد طلبات'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Daily summary */}
        <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('daily-closing')}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">ملخص اليوم</h3>
            </div>
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-3">
            <SummaryRow label="إجمالي المبيعات" value={formatCurrency(stats.todaySales)} />
            <SummaryRow label="تكلفة البضاعة المباعة" value={formatCurrency(stats.todayCogs)} />
            <SummaryRow label="إجمالي الربح" value={formatCurrency(stats.todayProfit)} highlight />
            <SummaryRow label="إيرادات الخدمات" value={formatCurrency(stats.todayServiceRevenue)} />
            <SummaryRow label="المصروفات" value={formatCurrency(stats.todayExpenses)} negative />
          </div>
        </div>
      </div>

      {/* More actions row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <NavCard label="الخدمات" icon={Wrench} onClick={() => onNavigate('services')} />
        <NavCard label="إيرادات الخدمات" icon={DollarSign} onClick={() => onNavigate('service-revenues')} />
        <NavCard label="التحويلات" icon={ArrowLeftRight} onClick={() => onNavigate('transfers')} />
        <NavCard label="التسوية البنكية" icon={Banknote} onClick={() => onNavigate('reconciliation')} />
        <NavCard label="الأرقام التسلسلية" icon={PackageSearch} onClick={() => onNavigate('serials')} />
        <NavCard label="سجل التدقيق" icon={BookOpen} onClick={() => onNavigate('audit')} />
      </div>

      {/* Financial accounts detail */}
      {accounts.length > 0 && (
        <div className="card p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigate('accounts')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white">الحسابات المالية</h3>
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {accounts.map(acc => (
              <div key={acc.id} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{acc.name_ar}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(Number(acc.current_balance))}</p>
                <p className="text-xs text-gray-400 mt-1">{acc.account_type === 'cash' ? 'نقدية' : acc.account_type === 'wallet' ? 'محفظة' : acc.account_type === 'bank' ? 'بنك' : 'حوالة'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        مرحبًا {profile?.full_name_ar} — {profile?.roles?.map(r => r.name_ar).join('، ') || 'مستخدم'}
      </p>
    </div>
  );
}

function QuickAction({ label, icon: Icon, onClick, color }: { label: string; icon: typeof TrendingUp; onClick: () => void; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    blue: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    teal: 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
    amber: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20',
    orange: 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
    red: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
    purple: 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
    gray: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95 ${colors[color]}`}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function NavCard({ label, icon: Icon, onClick }: { label: string; icon: typeof TrendingUp; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card p-4 flex flex-col items-center gap-2 hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all active:scale-95"
    >
      <Icon className="w-6 h-6 text-primary-500" />
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle, compact, onClick }: {
  title: string;
  value: string;
  icon: typeof TrendingUp;
  color: string;
  subtitle?: string;
  compact?: boolean;
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
    purple: 'from-purple-500 to-violet-600',
    teal: 'from-teal-500 to-cyan-600',
  };

  return (
    <div className="card p-5 relative overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={onClick}>
      <div className={`absolute top-0 left-0 w-24 h-24 bg-gradient-to-br ${colors[color]} opacity-10 rounded-full -translate-y-8 -translate-x-8`} />
      <div className="relative">
        <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${colors[color]} mb-3`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
        <p className={`font-bold text-gray-900 dark:text-white ${compact ? 'text-lg' : 'text-xl'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function AlertRow({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`badge ${colors[color]}`}>{count}</span>
    </div>
  );
}

function SummaryRow({ label, value, highlight, negative }: { label: string; value: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`font-bold ${highlight ? 'text-emerald-600 dark:text-emerald-400' : negative ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </span>
    </div>
  );
}
