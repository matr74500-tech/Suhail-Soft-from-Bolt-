import { useState, useRef } from 'react';
import { Printer, X, Loader2, FileText, Settings as SettingsIcon, Eye } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { DOC_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants';
import type { Document } from '@/types/database';

interface InvoicePrintProps {
  doc: Document;
  onClose: () => void;
}

type PrintMode = 'print' | 'preview';

export default function InvoicePrint({ doc, onClose }: InvoicePrintProps) {
  const { settings } = useSettings();
  const [mode, setMode] = useState<PrintMode>('preview');
  const [copies, setCopies] = useState(1);
  const [showLogo, setShowLogo] = useState(true);
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [autoPrint, setAutoPrint] = useState(false);
  const [printing, setPrinting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const isThermal = settings.paper_size === '80mm' || settings.paper_size === '58mm';
  const paperWidth = settings.paper_size === '80mm' ? '80mm' : settings.paper_size === '58mm' ? '58mm' : settings.paper_size === 'A5' ? '148mm' : '210mm';

  const fontPx = fontSize === 'small' ? 10 : fontSize === 'large' ? 14 : 12;

  function buildHTML(): string {
    const items = doc.items || [];
    const customerName = doc.customer?.name_ar || doc.supplier?.name_ar || 'عميل نقدي';
    const logo = showLogo && settings.logo_url ? `<img src="${settings.logo_url}" style="max-height:60px;max-width:120px;margin:0 auto;" />` : '';
    const header = showHeader ? `
      <div style="text-align:center;margin-bottom:10px;">
        ${logo}
        <h1 style="font-size:${fontPx + 6}px;margin:5px 0;">${settings.business_name}</h1>
        ${settings.business_address ? `<p style="font-size:${fontPx - 2}px;color:#666;">${settings.business_address}</p>` : ''}
        ${settings.business_phone ? `<p style="font-size:${fontPx - 2}px;color:#666;" dir="ltr">${settings.business_phone}</p>` : ''}
      </div>
      <hr style="border:0.5px solid #ddd;margin:8px 0;" />` : '';

    const itemsTable = isThermal ? `
      <div style="width:100%;">
        <div style="display:flex;font-weight:bold;font-size:${fontPx - 2}px;border-bottom:1px dashed #ddd;padding-bottom:4px;margin-bottom:4px;">
          <span style="flex:2;">الصنف</span>
          <span style="flex:1;text-align:center;">كمية</span>
          <span style="flex:1;text-align:left;">سعر</span>
          <span style="flex:1;text-align:left;">إجمالي</span>
        </div>
        ${items.map(item => `
          <div style="display:flex;font-size:${fontPx - 2}px;padding:3px 0;border-bottom:1px dotted #eee;">
            <span style="flex:2;">${item.description || item.product?.name_ar || ''}</span>
            <span style="flex:1;text-align:center;">${item.quantity}</span>
            <span style="flex:1;text-align:left;" dir="ltr">${formatCurrency(Number(item.unit_price))}</span>
            <span style="flex:1;text-align:left;font-weight:bold;" dir="ltr">${formatCurrency(Number(item.line_total))}</span>
          </div>`).join('')}
      </div>` : `
      <table style="width:100%;border-collapse:collapse;font-size:${fontPx}px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="border:1px solid #ddd;padding:6px;text-align:right;">الصنف</th>
            <th style="border:1px solid #ddd;padding:6px;text-align:center;">كمية</th>
            <th style="border:1px solid #ddd;padding:6px;text-align:center;">سعر</th>
            <th style="border:1px solid #ddd;padding:6px;text-align:left;">إجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td style="border:1px solid #ddd;padding:6px;">${item.description || item.product?.name_ar || ''}</td>
              <td style="border:1px solid #ddd;padding:6px;text-align:center;">${item.quantity}</td>
              <td style="border:1px solid #ddd;padding:6px;text-align:center;" dir="ltr">${formatCurrency(Number(item.unit_price))}</td>
              <td style="border:1px solid #ddd;padding:6px;text-align:left;font-weight:bold;" dir="ltr">${formatCurrency(Number(item.line_total))}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    const footer = showFooter ? `
      <div style="margin-top:15px;text-align:center;font-size:${fontPx - 2}px;color:#666;">
        <p>شكرًا لتعاملكم معنا</p>
        ${settings.business_email ? `<p dir="ltr">${settings.business_email}</p>` : ''}
        ${settings.invoice_show_user && doc.user_name ? `<p>ب_Receipt بواسطة: ${doc.user_name}</p>` : ''}
      </div>` : '';

    return `
      <div style="font-family:'Cairo','Arial',sans-serif;padding:10px;max-width:${paperWidth};margin:0 auto;color:#000;">
        ${header}
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:${fontPx}px;">
            <div>
              <p style="font-weight:bold;font-size:${fontPx + 2}px;">${DOC_TYPE_LABELS[doc.doc_type] || 'فاتورة'}</p>
              <p>رقم: <span dir="ltr">${doc.document_number}</span></p>
              <p>التاريخ: ${formatDate(doc.document_date)}</p>
            </div>
            <div style="text-align:left;">
              <p style="font-weight:bold;">${customerName}</p>
              ${doc.customer?.phone ? `<p dir="ltr">${doc.customer.phone}</p>` : ''}
              <p>${STATUS_LABELS[doc.status] || doc.status}</p>
            </div>
          </div>
        </div>
        ${itemsTable}
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #ddd;">
          <div style="display:flex;justify-content:space-between;font-size:${fontPx}px;">
            <span>المجموع الفرعي:</span>
            <span dir="ltr">${formatCurrency(Number(doc.subtotal))}</span>
          </div>
          ${Number(doc.discount_amount) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:${fontPx}px;">
            <span>الخصم:</span>
            <span dir="ltr">-${formatCurrency(Number(doc.discount_amount))}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:${fontPx + 2}px;font-weight:bold;margin-top:5px;padding-top:5px;border-top:1px dashed #ddd;">
            <span>الإجمالي:</span>
            <span dir="ltr">${formatCurrency(Number(doc.total))}</span>
          </div>
          ${Number(doc.paid_amount) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:${fontPx}px;margin-top:3px;">
            <span>المدفوع:</span>
            <span dir="ltr">${formatCurrency(Number(doc.paid_amount))}</span>
          </div>` : ''}
          ${Number(doc.remaining_amount) > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:${fontPx}px;color:#c00;">
            <span>المتبقي:</span>
            <span dir="ltr">${formatCurrency(Number(doc.remaining_amount))}</span>
          </div>` : ''}
        </div>
        ${footer}
      </div>`;
  }

  async function handlePrint() {
    setPrinting(true);
    const html = buildHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      setPrinting(false);
      return;
    }

    const pageRule = isThermal
      ? `@page { size: ${settings.paper_size} auto; margin: 2mm; }`
      : `@page { size: ${settings.paper_size}; margin: 10mm; }`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة — ${doc.document_number}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          ${pageRule}
          body { font-family: 'Cairo', Arial, sans-serif; margin: 0; padding: 0; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>${html}</body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      if (!autoPrint) printWindow.close();
      setPrinting(false);
    }, 600);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">طباعة الفاتورة — {doc.document_number}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings panel */}
          <div className="w-72 border-l border-gray-100 dark:border-gray-800 p-4 space-y-4 overflow-y-auto flex-shrink-0">
            <div>
              <label className="label">حجم الورق (من الإعدادات)</label>
              <div className="px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
                {settings.paper_size === '80mm' ? '80mm حراري' :
                 settings.paper_size === '58mm' ? '58mm حراري' :
                 settings.paper_size === 'A5' ? 'A5' : 'A4'}
              </div>
            </div>

            <div>
              <label className="label">حجم الخط</label>
              <select className="input" value={fontSize} onChange={e => setFontSize(e.target.value as 'small' | 'medium' | 'large')}>
                <option value="small">صغير</option>
                <option value="medium">متوسط</option>
                <option value="large">كبير</option>
              </select>
            </div>

            <div>
              <label className="label">عدد النسخ</label>
              <input type="number" min={1} className="input w-24" value={copies} onChange={e => setCopies(Math.max(1, Number(e.target.value)))} />
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">إظهار الشعار</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showHeader} onChange={e => setShowHeader(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">إظهار رأس الفاتورة</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showFooter} onChange={e => setShowFooter(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">إظهار التذييل</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">طباعة تلقائية</span>
              </label>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                <button onClick={() => setMode('preview')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'preview' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <Eye className="w-4 h-4 inline ml-1" /> معاينة
                </button>
              </div>
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 p-6 flex justify-center">
            <div
              ref={previewRef}
              className="bg-white shadow-lg"
              style={{
                width: isThermal ? `${paperWidth}` : paperWidth === '148mm' ? '148mm' : '210mm',
                minHeight: '100mm',
                transform: isThermal ? 'scale(1.3)' : 'scale(0.75)',
                transformOrigin: 'top center',
              }}
              dangerouslySetInnerHTML={{ __html: buildHTML() }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary">إغلاق</button>
          <button onClick={handlePrint} disabled={printing} className="btn-primary">
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {printing ? 'جارٍ الطباعة...' : `طباعة (${copies} نسخة)`}
          </button>
        </div>
      </div>
    </div>
  );
}
