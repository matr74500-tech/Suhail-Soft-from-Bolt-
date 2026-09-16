import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/format';
import type { AuditLog } from '@/types/database';
import { BookOpen } from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (search) q = q.or(`operation.ilike.%${search}%,user_name.ilike.%${search}%`);
    if (opFilter) q = q.eq('operation', opFilter);
    const { data } = await q;
    setLogs(data || []);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={load}
          placeholder="بحث بالعملية أو المستخدم..."
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('audit_logs')
              .select('id, operation, user_name, created_at')
              .or(`operation.ilike.%${q}%,user_name.ilike.%${q}%`)
              .order('created_at', { ascending: false })
              .limit(8);
            return (data || []).map((l: { id: string; operation: string; user_name: string; created_at: string }) => ({
              id: l.id, primary: l.operation, secondary: l.user_name || '',
              badge: formatDateTime(l.created_at), data: l,
            }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); load(); }}
        />
        <select className="input w-auto" value={opFilter} onChange={e => setOpFilter(e.target.value)}>
          <option value="">كل العمليات</option>
          <option value="create">إنشاء</option>
          <option value="update">تعديل</option>
          <option value="delete">حذف</option>
          <option value="price_change">تغيير سعر</option>
          <option value="stock_adjustment">تعديل مخزون</option>
          <option value="payment">دفع</option>
          <option value="cancel">إلغاء</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">العملية</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الجدول</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">المستخدم</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.map(l => (
              <tr key={l.id} className="table-row-hover">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{l.operation}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{l.table_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{l.user_name || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="text-center py-12 text-gray-400"><BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد سجلات تدقيق</p></div>}
      </div>
    </div>
  );
}
