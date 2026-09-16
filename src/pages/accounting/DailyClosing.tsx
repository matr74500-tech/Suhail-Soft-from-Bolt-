import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import type { DailyClosing } from '@/types/database';
import { Moon, CheckCircle, Lock, AlertTriangle } from 'lucide-react';

export default function DailyClosing() {
  const { profile } = useAuth();
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [todaySummary, setTodaySummary] = useState({
    sales: 0, purchases: 0, expenses: 0, serviceRevenues: 0, profit: 0, cogs: 0, returns: 0,
  });
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClosings();
    loadTodaySummary();
  }, []);

  async function loadClosings() {
    const { data } = await supabase.from('daily_closings').select('*').order('closing_date', { ascending: false });
    setClosings(data || []);
  }

  async function loadTodaySummary() {
    const today = new Date().toISOString().split('T')[0];
    const [sales, purchases, expenses, serviceRev] = await Promise.all([
      supabase.from('documents').select('total, total_cost, gross_profit').eq('doc_type', 'sales').eq('status', 'approved').eq('document_date', today),
      supabase.from('documents').select('total').eq('doc_type', 'purchase').eq('status', 'approved').eq('document_date', today),
      supabase.from('expenses').select('amount').eq('expense_date', today),
      supabase.from('service_revenues').select('amount').eq('revenue_date', today),
    ]);
    setTodaySummary({
      sales: sales.data?.reduce((s, d) => s + Number(d.total), 0) || 0,
      purchases: purchases.data?.reduce((s, d) => s + Number(d.total), 0) || 0,
      expenses: expenses.data?.reduce((s, e) => s + Number(e.amount), 0) || 0,
      serviceRevenues: serviceRev.data?.reduce((s, r) => s + Number(r.amount), 0) || 0,
      profit: sales.data?.reduce((s, d) => s + Number(d.gross_profit), 0) || 0,
      cogs: sales.data?.reduce((s, d) => s + Number(d.total_cost), 0) || 0,
      returns: 0,
    });
  }

  async function closeDay() {
    setClosing(true);
    setError(null);
    const today = new Date().toISOString().split('T')[0];
    const exists = closings.find(c => c.closing_date === today);
    if (exists) {
      setError('تم إغلاق هذا اليوم مسبقاً');
      setClosing(false);
      return;
    }
    await supabase.from('daily_closings').insert({
      closing_date: today,
      branch_id: profile?.branch_id || null,
      total_sales: todaySummary.sales,
      total_purchases: todaySummary.purchases,
      total_expenses: todaySummary.expenses,
      total_other_revenues: todaySummary.serviceRevenues,
      total_profit: todaySummary.profit,
      total_cogs: todaySummary.cogs,
      total_returns: todaySummary.returns,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    });
    setClosing(false);
    loadClosings();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Moon className="w-6 h-6 text-primary-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">إغلاق اليوم — {formatDate(new Date())}</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <SummaryCard label="المبيعات" value={formatCurrency(todaySummary.sales)} color="emerald" />
          <SummaryCard label="المشتريات" value={formatCurrency(todaySummary.purchases)} color="blue" />
          <SummaryCard label="المصروفات" value={formatCurrency(todaySummary.expenses)} color="red" />
          <SummaryCard label="إيرادات أخرى" value={formatCurrency(todaySummary.serviceRevenues)} color="amber" />
          <SummaryCard label="تكلفة البضاعة" value={formatCurrency(todaySummary.cogs)} color="gray" />
          <SummaryCard label="صافي الربح" value={formatCurrency(todaySummary.profit)} color="emerald" />
          <SummaryCard label="المرتجعات" value={formatCurrency(todaySummary.returns)} color="red" />
          <SummaryCard label="الفرق" value={formatCurrency(0)} color="gray" />
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-600 text-sm rounded-lg p-3 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

        <button onClick={closeDay} disabled={closing} className="btn-primary w-full">
          {closing ? 'جارٍ الإغلاق...' : 'إغلاق اليوم'}
        </button>
      </div>

      <div className="card overflow-hidden">
        <h3 className="p-4 font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800">سجل الإغلاقات</h3>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium">المبيعات</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">المصروفات</th>
              <th className="px-4 py-3 font-medium">الربح</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">بواسطة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {closings.map(c => (
              <tr key={c.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDate(c.closing_date)}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(Number(c.total_sales))}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{formatCurrency(Number(c.total_expenses))}</td>
                <td className="px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(Number(c.total_profit))}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{c.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {closings.length === 0 && <div className="text-center py-12 text-gray-400"><Lock className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد إغلاقات يومية</p></div>}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-400', blue: 'text-blue-600 dark:text-blue-400',
    red: 'text-red-600 dark:text-red-400', amber: 'text-amber-600 dark:text-amber-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };
  return (
    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}