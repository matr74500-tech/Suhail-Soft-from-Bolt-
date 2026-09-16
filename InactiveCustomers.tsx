import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { Modal, Field } from '@/pages/Customers';
import type { Customer, CustomerFollowUp } from '@/types/database';
import { COMMUNICATION_TYPES } from '@/lib/constants';
import { UserCheck, Phone, MessageSquare, Calendar, Plus, Clock } from 'lucide-react';
import SmartSearch from '@/components/SmartSearch';

export default function InactiveCustomers() {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [detailCust, setDetailCust] = useState<Customer | null>(null);
  const [followUps, setFollowUps] = useState<CustomerFollowUp[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    communication_type: 'whatsapp', content: '', result: '', next_follow_up_date: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('name_ar');
    const inactivityDays = settings.inactivity_period_days || 30;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - inactivityDays);
    const inactive = (data || []).filter(c => {
      if (c.last_order_date) return new Date(c.last_order_date) < threshold;
      return new Date(c.created_at) < threshold;
    });
    setCustomers(inactive);
  }

  async function openDetail(c: Customer) {
    setDetailCust(c);
    const { data } = await supabase.from('customer_follow_ups').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
    setFollowUps(data || []);
  }

  async function saveFollowUp() {
    if (!detailCust) return;
    await supabase.from('customer_follow_ups').insert({
      customer_id: detailCust.id,
      communication_type: followUpForm.communication_type,
      content: followUpForm.content || null,
      result: followUpForm.result || null,
      next_follow_up_date: followUpForm.next_follow_up_date || null,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    });
    setShowFollowUp(false);
    setFollowUpForm({ communication_type: 'whatsapp', content: '', result: '', next_follow_up_date: '' });
    openDetail(detailCust);
  }

  const filtered = customers.filter(c =>
    !search || c.name_ar.includes(search) || c.code.includes(search) || (c.phone || '').includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-500" />
        <div>
          <p className="text-sm text-gray-500">فترة الخمول: {settings.inactivity_period_days} يوم</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{customers.length} عميل غير نشط</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={() => {}}
          placeholder="بحث بالاسم، الكود، الهاتف..."
          fetchSuggestions={async (q) => {
            return customers
              .filter(c => c.name_ar.includes(q) || c.code.includes(q) || (c.phone || '').includes(q))
              .slice(0, 8)
              .map(c => ({
                id: c.id, primary: c.name_ar, secondary: c.phone || c.code,
                  badge: c.last_order_date ? formatDate(c.last_order_date) : 'لا توجد طلبات',
                  data: c,
                }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); }}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الهاتف</th>
              <th className="px-4 py-3 font-medium">آخر طلب</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الرصيد</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(c => (
              <tr key={c.id} className="table-row-hover cursor-pointer" onClick={() => openDetail(c)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{c.name_ar}</td>
                <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell" dir="ltr">{c.phone || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.last_order_date ? formatDate(c.last_order_date) : 'لا توجد طلبات'}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white hidden sm:table-cell">{formatCurrency(Number(c.current_balance))}</td>
                <td className="px-4 py-3"><span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">غير نشط</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400"><UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا يوجد عملاء غير نشطين</p></div>}
      </div>

      {detailCust && (
        <Modal onClose={() => setDetailCust(null)} title={`متابعة: ${detailCust.name_ar}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="card p-3"><p className="text-xs text-gray-400">الهاتف</p><p className="text-sm font-medium text-gray-900 dark:text-white" dir="ltr">{detailCust.phone || '-'}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">آخر طلب</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detailCust.last_order_date ? formatDate(detailCust.last_order_date) : 'لا توجد'}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الرصيد</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(Number(detailCust.current_balance))}</p></div>
            </div>

            <button onClick={() => setShowFollowUp(true)} className="btn-primary w-full"><Plus className="w-4 h-4" /> تسجيل متابعة جديدة</button>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">سجل المتابعات</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {followUps.map(f => (
                  <div key={f.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {COMMUNICATION_TYPES.find(c => c.value === f.communication_type)?.labelAr || f.communication_type}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(f.created_at)}</span>
                    </div>
                    {f.content && <p className="text-sm text-gray-600 dark:text-gray-400">{f.content}</p>}
                    {f.result && <p className="text-xs text-gray-500 mt-1">النتيجة: {f.result}</p>}
                    {f.next_follow_up_date && <p className="text-xs text-primary-600 mt-1">المتابعة القادمة: {formatDate(f.next_follow_up_date)}</p>}
                  </div>
                ))}
                {followUps.length === 0 && <p className="text-center text-gray-400 text-sm py-2">لا توجد متابعات</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showFollowUp && (
        <Modal onClose={() => setShowFollowUp(false)} title="تسجيل متابعة">
          <div className="space-y-4">
            <Field label="نوع التواصل">
              <select className="input" value={followUpForm.communication_type} onChange={e => setFollowUpForm({ ...followUpForm, communication_type: e.target.value })}>
                {COMMUNICATION_TYPES.map(c => <option key={c.value} value={c.value}>{c.labelAr}</option>)}
              </select>
            </Field>
            <Field label="المحتوى"><textarea className="input min-h-[60px]" value={followUpForm.content} onChange={e => setFollowUpForm({ ...followUpForm, content: e.target.value })} /></Field>
            <Field label="النتيجة"><input className="input" value={followUpForm.result} onChange={e => setFollowUpForm({ ...followUpForm, result: e.target.value })} /></Field>
            <Field label="تاريخ المتابعة القادمة"><input type="date" className="input" value={followUpForm.next_follow_up_date} onChange={e => setFollowUpForm({ ...followUpForm, next_follow_up_date: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFollowUp(false)} className="btn-secondary">إلغاء</button>
              <button onClick={saveFollowUp} className="btn-primary">حفظ</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
