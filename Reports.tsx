import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { Download, BarChart3, TrendingUp, Package, Users, Truck, Wallet } from 'lucide-react';

export default function Reports() {
  const [reportType, setReportType] = useState('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, count: 0, cost: 0, profit: 0 });

  useEffect(() => { loadReport(); }, [reportType]);

  async function loadReport() {
    setLoading(true);
    let query;
    let dateField = 'document_date';

    switch (reportType) {
      case 'sales':
        query = supabase.from('documents').select('document_number, document_date, total, total_cost, gross_profit, customer:customers(name_ar), user_name').eq('doc_type', 'sales').eq('status', 'approved');
        break;
      case 'purchases':
        query = supabase.from('documents').select('document_number, document_date, total, supplier:suppliers(name_ar), user_name').eq('doc_type', 'purchase').eq('status', 'approved');
        break;
      case 'profit':
        query = supabase.from('documents').select('document_number, document_date, total, total_cost, gross_profit, customer:customers(name_ar)').eq('doc_type', 'sales').eq('status', 'approved');
        break;
      case 'expenses':
        query = supabase.from('expenses').select('expense_type, amount, expense_date, beneficiary, user_name');
        dateField = 'expense_date';
        break;
      case 'customers':
        query = supabase.from('customers').select('code, name_ar, current_balance, status, last_order_date');
        break;
      case 'suppliers':
        query = supabase.from('suppliers').select('code, name_ar, current_balance, phone');
        break;
      case 'inventory':
        query = supabase.from('stock_levels').select('product:products(name_ar, code, min_stock, reorder_point), quantity, warehouse:warehouses(name_ar)');
        break;
      case 'accounts':
        query = supabase.from('financial_accounts').select('code, name_ar, account_type, current_balance');
        break;
      default:
        query = supabase.from('documents').select('document_number, document_date, total').eq('doc_type', 'sales').eq('status', 'approved');
    }

    if (dateFrom && dateField !== '') query = query.gte(dateField, dateFrom);
    if (dateTo && dateField !== '') query = query.lte(dateTo, dateTo);
    query = query.order(dateField, { ascending: false }).limit(100);

    const { data: result } = await query;
    const rows = (result || []) as unknown as Record<string, unknown>[];
    setData(rows);

    if (rows.length > 0) {
      const total = rows.reduce((s, r) => s + Number(r.total || r.amount || r.current_balance || 0), 0);
      const cost = rows.reduce((s, r) => s + Number(r.total_cost || 0), 0);
      const profit = rows.reduce((s, r) => s + Number(r.gross_profit || 0), 0);
      setSummary({ total, count: rows.length, cost, profit });
    } else {
      setSummary({ total: 0, count: 0, cost: 0, profit: 0 });
    }
    setLoading(false);
  }

  function exportCSV() {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(r => headers.map(h => {
      const v = r[h];
      if (v && typeof v === 'object') return (v as { name_ar?: string }).name_ar || JSON.stringify(v);
      return v ?? '';
    }));
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `report-${reportType}.csv`; a.click();
  }

  const reportTypes = [
    { value: 'sales', label: 'المبيعات', icon: TrendingUp },
    { value: 'purchases', label: 'المشتريات', icon: Package },
    { value: 'profit', label: 'الأرباح', icon: BarChart3 },
    { value: 'expenses', label: 'المصروفات', icon: Wallet },
    { value: 'customers', label: 'العملاء', icon: Users },
    { value: 'suppliers', label: 'الموردون', icon: Truck },
    { value: 'inventory', label: 'المخزون', icon: Package },
    { value: 'accounts', label: 'الحسابات', icon: Wallet },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <select className="input w-auto" value={reportType} onChange={e => setReportType(e.target.value)}>
          {reportTypes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <input type="date" className="input w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <input type="date" className="input w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button onClick={loadReport} className="btn-primary">عرض</button>
        <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> تصدير Excel</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-gray-400">العدد</p><p className="text-lg font-bold text-gray-900 dark:text-white">{summary.count}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-400">الإجمالي</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.total)}</p></div>
        {reportType === 'profit' && <>
          <div className="card p-4"><p className="text-xs text-gray-400">التكلفة</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(summary.cost)}</p></div>
          <div className="card p-4"><p className="text-xs text-gray-400">صافي الربح</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.profit)}</p></div>
        </>}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12"><div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
                  {data.length > 0 && Object.keys(data[0]).map(h => (
                    <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.map((row, i) => (
                  <tr key={i} className="table-row-hover">
                    {Object.entries(row).map(([key, val]) => (
                      <td key={key} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {val && typeof val === 'object' ? (val as { name_ar?: string }).name_ar || '-' : String(val ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && <div className="text-center py-12 text-gray-400"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد بيانات</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}
