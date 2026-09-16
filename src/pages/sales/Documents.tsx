import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { DOC_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants';
import { Modal, Field } from '@/pages/sales/Customers';
import type { Document } from '@/types/database';
import { FileText, Download, Eye, Plus, ArrowRight } from 'lucide-react';
import SmartSearch from '@/components/utilities/SmartSearch';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function Documents() {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('sales');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailDoc, setDetailDoc] = useState<Document | null>(null);

  useEffect(() => { loadDocs(); }, [typeFilter]);

  async function loadDocs() {
    let q = supabase.from('documents').select(`
      *,
      customer:customers(*),
      supplier:suppliers(*),
      warehouse:warehouses(*),
      items:document_items(*, product:products(*)),
      payments:document_payments(*)
    `).order('created_at', { ascending: false });
    if (typeFilter) q = q.eq('doc_type', typeFilter);
    if (statusFilter) q = q.eq('status', statusFilter);
    if (search) q = q.ilike('document_number', `%${search}%`);
    const { data } = await q;
    setDocs(data || []);
  }

  async function convertToInvoice(doc: Document) {
    const newNumber = `INV-${Date.now()}`;
    const { data, error } = await supabase.from('documents').insert({
      document_number: newNumber,
      doc_type: 'sales',
      status: 'approved',
      document_date: new Date().toISOString().split('T')[0],
      party_type: 'customer',
      customer_id: doc.customer_id,
      warehouse_id: doc.warehouse_id,
      branch_id: doc.branch_id,
      subtotal: doc.subtotal,
      discount_amount: doc.discount_amount,
      total: doc.total,
      total_cost: doc.total_cost,
      gross_profit: doc.gross_profit,
      currency_id: doc.currency_id,
      exchange_rate: doc.exchange_rate,
      source_document_id: doc.id,
      source_document_number: doc.document_number,
      user_id: profile?.id,
      user_name: profile?.full_name_ar,
    }).select().single();
    if (!error && data) {
      const items = (doc.items || []).map(item => ({
        document_id: data.id,
        product_id: item.product_id,
        item_type: item.item_type,
        description: item.description,
        unit_id: item.unit_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        line_total: item.line_total,
        line_cost: item.line_cost,
      }));
      await supabase.from('document_items').insert(items);
      loadDocs();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <SmartSearch
          value={search}
          onChange={setSearch}
          onSearch={loadDocs}
          placeholder="رقم المستند..."
          fetchSuggestions={async (q) => {
            const { data } = await supabase.from('documents')
              .select('id, document_number, total, doc_type')
              .ilike('document_number', `%${q}%`)
              .order('created_at', { ascending: false })
              .limit(8);
            return (data || []).map((d: any) => ({
              id: d.id, primary: d.document_number,
              secondary: DOC_TYPE_LABELS[d.doc_type] || d.doc_type,
              badge: formatCurrency(Number(d.total)),
              badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
              data: d,
            }));
          }}
          onSuggestionSelect={(item) => { setSearch(item.primary); loadDocs(); }}
        />
        <select className="input w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="sales">فواتير البيع</option>
          <option value="purchase">فواتير الشراء</option>
          <option value="quotation">عروض الأسعار</option>
          <option value="sales_order">أوامر البيع</option>
          <option value="purchase_request">طلبات الشراء</option>
          <option value="purchase_order">أوامر الشراء</option>
        </select>
        <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="approved">معتمد</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr className="text-right text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">رقم المستند</th>
              <th className="px-4 py-3 font-medium">التاريخ</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الطرف</th>
              <th className="px-4 py-3 font-medium">المبلغ</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {docs.map(d => (
              <tr key={d.id} className="table-row-hover cursor-pointer" onClick={() => setDetailDoc(d)}>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{d.document_number}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(d.document_date)}</td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                  {d.customer?.name_ar || d.supplier?.name_ar || '-'}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(Number(d.total))}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={`badge ${statusColors[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                </td>
                <td className="px-4 py-3">
                  {(d.doc_type === 'quotation' || d.doc_type === 'sales_order') && d.status === 'approved' && (
                    <button onClick={e => { e.stopPropagation(); convertToInvoice(d); }} className="btn-ghost p-1.5 text-emerald-500" title="تحويل لفاتورة">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && <div className="text-center py-12 text-gray-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>لا توجد مستندات</p></div>}
      </div>

      {detailDoc && (
        <Modal onClose={() => setDetailDoc(null)} title={`المستند ${detailDoc.document_number}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card p-3"><p className="text-xs text-gray-400">النوع</p><p className="text-sm font-medium text-gray-900 dark:text-white">{DOC_TYPE_LABELS[detailDoc.doc_type]}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">التاريخ</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(detailDoc.document_date)}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الطرف</p><p className="text-sm font-medium text-gray-900 dark:text-white">{detailDoc.customer?.name_ar || detailDoc.supplier?.name_ar || '-'}</p></div>
              <div className="card p-3"><p className="text-xs text-gray-400">الحالة</p><span className={`badge ${statusColors[detailDoc.status]}`}>{STATUS_LABELS[detailDoc.status]}</span></div>
            </div>

            {(detailDoc.items || []).length > 0 && (
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
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.description || item.product?.name_ar}</td>
                        <td className="px-3 py-2 text-gray-500">{item.quantity}</td>
                        <td className="px-3 py-2 text-gray-500">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{formatCurrency(Number(item.line_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
              <span className="text-xl font-bold text-primary-600 dark:text-primary-400">{formatCurrency(Number(detailDoc.total))}</span>
            </div>
            {detailDoc.source_document_number && (
              <p className="text-sm text-gray-400">المستند المصدر: {detailDoc.source_document_number}</p>
            )}
            <p className="text-xs text-gray-400">بواسطة: {detailDoc.user_name}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}