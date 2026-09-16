import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/format';
import { Modal } from '@/pages/Customers';
import type { ProductSerial, Product } from '@/types/database';
import { PackageSearch, Eye } from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

export default function Serials() {
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<ProductSerial | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    let q = supabase.from('product_serials').select(`*, product:products(*)`).order('created_at', { ascending: false });
    if (search) q = q.ilike('serial_number', `%${search}%`);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setSerials(data || []);
  }

  const statusLabels: Record<string, string> = {
    in_stock: 'في المخزون', sold: 'مباع', returned: 'مرتجع', damaged: 'تالف',
  };
  const statusColors: Record<string, string> = {
    in_stock: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    returned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    damaged: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={load}
          placeholder="رقم تسلسلي..."
          dir="ltr"
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('product_serials')
              .select('id, serial_number, status, product:products(name_ar)')
              .ilike('serial_number', `%${q}%`)
              .order('created_at', { ascending: false })
              .limit(8);
            return (data || []).map((s: { id: string; serial_number: string; status: string; product: { name_ar: string } | { name_ar: string }[] }) => {
              const p = Array.isArray(s.product) ? s.product[0] : s.product;
              return {
                id: s.id, primary: s.serial_number, secondary: p?.name_ar || '',
                badge: s.status, data: s,
              };
            });
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); load(); }}
        />
        <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="in_stock">في المخزون</option>
          <option value="sold">مباع</option>
          <option value="returned">مرتجع</option>
          <option value="damaged">تالف</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">الرقم التسلسلي</th>
              <th className="px-4 py-3 font-medium">المنتج</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">التاريخ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {serials.map(s => (
              <tr key={s.id} className="table-row-hover cursor-pointer" onClick={() => setDetail(s)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white" dir="ltr">{s.serial_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{s.product?.name_ar || '-'}</td>
                <td className="px-4 py-3 hidden sm:table-cell"><span className={`badge ${statusColors[s.status]}`}>{statusLabels[s.status] || s.status}</span></td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{formatDateTime(s.created_at)}</td>
                <td className="px-4 py-3"><button className="btn-ghost p-1.5 text-blue-500"><Eye className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {serials.length === 0 && <div className="text-center py-12 text-gray-400"><PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد أرقام تسلسلية</p></div>}
      </div>

      {detail && (
        <Modal onClose={() => setDetail(null)} title={`الرقم التسلسلي: ${detail.serial_number}`}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3"><p className="text-xs text-gray-400">المنتج</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detail.product?.name_ar}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الحالة</p><span className={`badge ${statusColors[detail.status]}`}>{statusLabels[detail.status]}</span></div>
            </div>
            <p className="text-sm text-gray-500">تاريخ الإدخال: {formatDateTime(detail.created_at)}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
