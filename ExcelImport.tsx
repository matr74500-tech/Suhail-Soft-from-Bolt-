import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

interface ExcelImportProps {
  entityType: 'products' | 'customers' | 'suppliers';
  onClose: () => void;
  onImported: () => void;
}

interface ImportRow {
  rowIndex: number;
  data: Record<string, string>;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

const FIELD_MAP: Record<string, { fields: { label: string; key: string; required: boolean }[]; table: string; buildPayload: (row: Record<string, string>) => Record<string, unknown> }> = {
  products: {
    table: 'products',
    fields: [
      { label: 'كود المنتج', key: 'code', required: true },
      { label: 'الاسم (عربي)', key: 'name_ar', required: true },
      { label: 'الاسم (إنجليزي)', key: 'name_en', required: false },
      { label: 'سعر الشراء', key: 'purchase_price', required: false },
      { label: 'سعر القطعة', key: 'retail_price', required: false },
      { label: 'سعر الجملة', key: 'wholesale_price', required: false },
      { label: 'الحد الأدنى', key: 'min_stock', required: false },
      { label: 'نقطة الطلب', key: 'reorder_point', required: false },
      { label: 'الباركود', key: 'barcode', required: false },
      { label: 'رقم الرف', key: 'shelf_number', required: false },
      { label: 'الموقع', key: 'location', required: false },
      { label: 'الوصف', key: 'description', required: false },
    ],
    buildPayload: (row) => ({
      code: row.code,
      name_ar: row.name_ar,
      name_en: row.name_en || null,
      purchase_price: Number(row.purchase_price) || 0,
      retail_price: Number(row.retail_price) || 0,
      wholesale_price: Number(row.wholesale_price) || 0,
      min_stock: Number(row.min_stock) || 0,
      reorder_point: Number(row.reorder_point) || 0,
      shelf_number: row.shelf_number || null,
      location: row.location || null,
      description: row.description || null,
      is_active: true,
      requires_serial: false,
      conversion_factor: 1,
    }),
  },
  customers: {
    table: 'customers',
    fields: [
      { label: 'الكود', key: 'code', required: true },
      { label: 'الاسم (عربي)', key: 'name_ar', required: true },
      { label: 'الاسم (إنجليزي)', key: 'name_en', required: false },
      { label: 'الهاتف', key: 'phone', required: false },
      { label: 'الإيميل', key: 'email', required: false },
      { label: 'العنوان', key: 'address', required: false },
      { label: 'الرصيد الافتتاحي', key: 'opening_balance', required: false },
    ],
    buildPayload: (row) => ({
      code: row.code,
      name_ar: row.name_ar,
      name_en: row.name_en || null,
      phone: row.phone || null,
      email: row.email || null,
      address: row.address || null,
      opening_balance: Number(row.opening_balance) || 0,
      current_balance: Number(row.opening_balance) || 0,
      is_active: true,
    }),
  },
  suppliers: {
    table: 'suppliers',
    fields: [
      { label: 'الكود', key: 'code', required: true },
      { label: 'الاسم (عربي)', key: 'name_ar', required: true },
      { label: 'الاسم (إنجليزي)', key: 'name_en', required: false },
      { label: 'الهاتف', key: 'phone', required: false },
      { label: 'الإيميل', key: 'email', required: false },
      { label: 'العنوان', key: 'address', required: false },
      { label: 'الشخص المسؤول', key: 'contact_person', required: false },
      { label: 'الرصيد الافتتاحي', key: 'opening_balance', required: false },
    ],
    buildPayload: (row) => ({
      code: row.code,
      name_ar: row.name_ar,
      name_en: row.name_en || null,
      phone: row.phone || null,
      email: row.email || null,
      address: row.address || null,
      contact_person: row.contact_person || null,
      opening_balance: Number(row.opening_balance) || 0,
      current_balance: Number(row.opening_balance) || 0,
      is_active: true,
    }),
  },
};

const ENTITY_LABELS: Record<string, string> = {
  products: 'المنتجات',
  customers: 'العملاء',
  suppliers: 'الموردون',
};

export default function ExcelImport({ entityType, onClose, onImported }: ExcelImportProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const config = FIELD_MAP[entityType];

  function parseCSV(text: string): string[][] {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of text) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; continue; }
      current += ch;
    }
    if (current) lines.push(current);
    return lines.map(l => l.split(',').map(c => c.trim()));
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      if (data.length < 2) return;

      const headers = data[0].map(h => h.trim());
      const fieldKeys = config.fields.map(f => f.key);
      const headerMap: Record<string, string> = {};
      headers.forEach((h, i) => {
        const key = fieldKeys.find(k => k === h || config.fields.find(f => f.key === k)?.label === h);
        if (key) headerMap[i] = key;
      });

      const parsed: ImportRow[] = data.slice(1).map((row, idx) => {
        const rowData: Record<string, string> = {};
        Object.entries(headerMap).forEach(([colIdx, fieldKey]) => {
          rowData[fieldKey] = row[parseInt(colIdx)] || '';
        });
        const missingRequired = config.fields.filter(f => f.required && !rowData[f.key]);
        return {
          rowIndex: idx + 2,
          data: rowData,
          status: missingRequired.length > 0 ? 'error' : 'pending',
          error: missingRequired.length > 0 ? `حقول ناقصة: ${missingRequired.map(f => f.label).join(', ')}` : undefined,
        };
      });

      setRows(parsed);
      setStep('review');
    };
    reader.readAsText(file, 'utf-8');
  }

  async function doImport() {
    setImporting(true);
    let success = 0;
    let errors = 0;
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status === 'error') { errors++; continue; }
      try {
        const payload = config.buildPayload(row.data);
        const { error } = await supabase.from(config.table).insert(payload);
        if (error) {
          updated[i] = { ...row, status: 'error', error: error.message };
          errors++;
        } else {
          updated[i] = { ...row, status: 'success' };
          success++;
        }
      } catch (err) {
        updated[i] = { ...row, status: 'error', error: err instanceof Error ? err.message : 'خطأ' };
        errors++;
      }
    }

    setRows(updated);
    setImportedCount(success);
    setErrorCount(errors);
    setImporting(false);
    setStep('done');
    if (success > 0) onImported();
  }

  function downloadTemplate() {
    const headers = config.fields.map(f => f.label);
    const csv = headers.join(',') + '\n';
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${entityType}.csv`;
    a.click();
  }

  const pendingRows = rows.filter(r => r.status === 'pending').length;
  const errorRows = rows.filter(r => r.status === 'error').length;
  const successRows = rows.filter(r => r.status === 'success').length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">استيراد {ENTITY_LABELS[entityType]}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">اختر ملف CSV أو اسحبه هنا</p>
                <p className="text-xs text-gray-400 mt-1">يدعم ملفات Excel المحفوظة كـ CSV</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">الحقول المطلوبة</h3>
                  <button onClick={downloadTemplate} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                    <Download className="w-4 h-4" /> تحميل قالب فارغ
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {config.fields.map(f => (
                    <div key={f.key} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${f.required ? 'bg-red-400' : 'bg-gray-300'}`} />
                      <span className="text-gray-700 dark:text-gray-300">{f.label}</span>
                      {f.required && <span className="text-xs text-red-400">*</span>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">يجب أن يكون السطر الأول في الملف يحتوي على عناوين الأعمدة</p>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{fileName}</span> — {rows.length} صف
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{pendingRows} للاستيراد</span>
                  <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{errorRows} خطأ</span>
                </div>
              </div>

              <div className="card overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                    <tr className="text-right text-xs text-gray-500">
                      <th className="px-3 py-2">#</th>
                      {config.fields.slice(0, 5).map(f => (
                        <th key={f.key} className="px-3 py-2">{f.label}</th>
                      ))}
                      <th className="px-3 py-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map(row => (
                      <tr key={row.rowIndex} className={row.status === 'error' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                        <td className="px-3 py-2 text-xs text-gray-400">{row.rowIndex}</td>
                        {config.fields.slice(0, 5).map(f => (
                          <td key={f.key} className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 truncate max-w-[100px]">{row.data[f.key] || '-'}</td>
                        ))}
                        <td className="px-3 py-2">
                          {row.status === 'error' ? (
                            <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" title={row.error}>خطأ</span>
                          ) : (
                            <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">منتظر</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errorRows > 0 && (
                <div className="card p-3 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
                  يوجد {errorRows} صف به أخطاء — سيتم تخطيها عند الاستيراد
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{importedCount}</p>
                  <p className="text-sm text-gray-500">تم استيرادها</p>
                </div>
                {errorCount > 0 && (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</p>
                    <p className="text-sm text-gray-500">أخطاء</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500">تم استيراد البيانات بنجاح</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
          {step === 'upload' && (
            <button onClick={onClose} className="btn-secondary">إلغاء</button>
          )}
          {step === 'review' && (
            <>
              <button onClick={() => setStep('upload')} className="btn-secondary">رجوع</button>
              <button onClick={doImport} disabled={importing || pendingRows === 0} className="btn-primary">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'جارٍ الاستيراد...' : `استيراد ${pendingRows} صف`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} className="btn-primary">تم</button>
          )}
        </div>
      </div>
    </div>
  );
}
