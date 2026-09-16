import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Barcode, Printer, X, Loader2, Settings as SettingsIcon } from 'lucide-react';
import type { Product, ProductBarcode } from '@/types/database';

interface BarcodePrinterProps {
  product: Product;
  onClose: () => void;
}

type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8';
type LabelSize = '40x30' | '50x30' | '60x40' | '100x50';

function generateCode128(data: string): string {
  const bars: number[] = [];
  const CODE128_START = 104;
  const CODE128_STOP = 106;

  const charToValue = (ch: string): number => {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) return code - 32;
    return 0;
  };

  const values = [CODE128_START];
  let checksum = CODE128_START;
  for (const ch of data) {
    const v = charToValue(ch);
    values.push(v);
    checksum += v * (values.length - 1);
  }
  checksum = checksum % 103;
  values.push(checksum);
  values.push(CODE128_STOP);

  const patterns: string[] = [];
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v] || '212222';
    patterns.push(pattern);
  }

  const fullPattern = patterns.join('');
  let svgBars = '';
  let x = 0;
  const barWidth = 2;
  for (let i = 0; i < fullPattern.length; i++) {
    const width = parseInt(fullPattern[i]) * barWidth;
    if (i % 2 === 0) {
      svgBars += `<rect x="${x}" y="0" width="${width}" height="60" fill="#000"/>`;
    }
    x += width;
  }
  return svgBars;
}

const CODE128_PATTERNS: string[] = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221114','413111','241112','114131','311114','411312','113114','211114','411112',
  '411211','211412','112241','311141','411141','211411','111324','111423','121324','131423',
  '131214','122414','132413','231314','231413','241213','242113','134211','312114','312411',
  '321114','321411','413112','413211','331114','331411','414112','414211','324112','324211',
  '314114','314411','254121','241412','142121','124121','233211','223311','233111','234111',
  '211412','233112','211214','211412','233111','233112','211214','211412','111224'
];

export default function BarcodePrinter({ product, onClose }: BarcodePrinterProps) {
  const [selectedBarcodes, setSelectedBarcodes] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [labelSize, setLabelSize] = useState<LabelSize>('50x30');
  const [format, setFormat] = useState<BarcodeFormat>('CODE128');
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const allBarcodes: (ProductBarcode & { product_name: string; product_price: number })[] = [
    ...(product.barcodes || []).map(b => ({ ...b, product_name: product.name_ar, product_price: Number(product.retail_price) })),
  ];

  const labelDimensions: Record<LabelSize, { w: number; h: number }> = {
    '40x30': { w: 40, h: 30 },
    '50x30': { w: 50, h: 30 },
    '60x40': { w: 60, h: 40 },
    '100x50': { w: 100, h: 50 },
  };

  const selectedItems = allBarcodes.filter(b => selectedBarcodes.includes(b.id || b.barcode));
  const totalLabels = selectedItems.reduce((sum, b) => sum + (quantities[b.id || b.barcode] || 1), 0) * copies;

  function toggleBarcode(id: string) {
    setSelectedBarcodes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    if (!quantities[id]) {
      setQuantities(prev => ({ ...prev, [id]: 1 }));
    }
  }

  function setQty(id: string, qty: number) {
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
  }

  function selectAll() {
    setSelectedBarcodes(allBarcodes.map(b => b.id || b.barcode));
    const newQty: Record<string, number> = {};
    allBarcodes.forEach(b => { newQty[b.id || b.barcode] = 1; });
    setQuantities(newQty);
  }

  function generateBarcodeSVG(barcode: string): string {
    if (format === 'EAN13' && barcode.length === 13) {
      return generateEAN13(barcode);
    } else if (format === 'EAN8' && barcode.length === 8) {
      return generateEAN8(barcode);
    }
    return generateCode128(barcode);
  }

  function generateEAN13(data: string): string {
    let svg = '';
    const barWidth = 2;
    let x = 0;
    const L_CODES = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const G_CODES = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
    const R_CODES = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
    const FIRST = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
    const firstDigit = parseInt(data[0]);
    const pattern = FIRST[firstDigit] || 'LLLLLL';
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth;
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth * 2;
    for (let i = 1; i <= 6; i++) {
      const d = parseInt(data[i]);
      const code = pattern[i-1] === 'L' ? L_CODES[d] : G_CODES[d];
      for (const bit of code) {
        if (bit === '1') svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`;
        x += barWidth;
      }
    }
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth;
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth * 2;
    for (let i = 7; i <= 12; i++) {
      const d = parseInt(data[i]);
      const code = R_CODES[d];
      for (const bit of code) {
        if (bit === '1') svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`;
        x += barWidth;
      }
    }
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth;
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth;
    return svg;
  }

  function generateEAN8(data: string): string {
    let svg = '';
    const barWidth = 2;
    let x = 0;
    const L_CODES = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const R_CODES = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth * 2;
    for (let i = 0; i < 4; i++) {
      const d = parseInt(data[i]);
      for (const bit of L_CODES[d]) {
        if (bit === '1') svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`;
        x += barWidth;
      }
    }
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth * 2;
    for (let i = 4; i < 8; i++) {
      const d = parseInt(data[i]);
      for (const bit of R_CODES[d]) {
        if (bit === '1') svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`;
        x += barWidth;
      }
    }
    svg += `<rect x="${x}" y="0" width="${barWidth}" height="70" fill="#000"/>`; x += barWidth;
    return svg;
  }

  async function handlePrint() {
    setPrinting(true);
    const labels: { barcode: string; name: string; price: number; qty: number }[] = [];
    selectedItems.forEach(b => {
      const qty = quantities[b.id || b.barcode] || 1;
      for (let i = 0; i < qty * copies; i++) {
        labels.push({ barcode: b.barcode, name: b.product_name, price: b.product_price, qty: 1 });
      }
    });

    const dims = labelDimensions[labelSize];
    const labelsHtml = labels.map(l => {
      const barcodeSvg = generateBarcodeSVG(l.barcode);
      return `
        <div class="label" style="width:${dims.w}mm;height:${dims.h}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-inside:avoid;border:0.5px dashed #ccc;padding:1mm;box-sizing:border-box;">
          ${showName ? `<div style="font-size:7px;font-family:Arial,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;margin-bottom:1mm;">${l.name}</div>` : ''}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 70" style="width:90%;height:auto;">${barcodeSvg}</svg>
          <div style="font-size:8px;font-family:monospace;letter-spacing:1px;margin-top:0.5mm;" dir="ltr">${l.barcode}</div>
          ${showPrice ? `<div style="font-size:10px;font-weight:bold;font-family:Arial,sans-serif;margin-top:0.5mm;">${l.price.toFixed(0)} ر.ي</div>` : ''}
        </div>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      setPrinting(false);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة الباركود</title>
        <style>
          @page { size: ${dims.w}mm ${dims.h}mm; margin: 0; }
          body { margin: 0; padding: 0; display: flex; flex-wrap: wrap; }
          .label { margin: 0; }
          @media print { .label { border: none; } }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setPrinting(false);
    }, 500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">طباعة الباركود — {product.name_ar}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">اختر الباركودات المراد طباعتها:</p>
            <button onClick={selectAll} className="text-sm text-primary-600 hover:text-primary-700">تحديد الكل</button>
          </div>

          <div className="space-y-2">
            {allBarcodes.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Barcode className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>لا توجد باركودات لهذا المنتج</p>
              </div>
            )}
            {allBarcodes.map(b => {
              const id = b.id || b.barcode;
              const selected = selectedBarcodes.includes(id);
              return (
                <div key={id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selected ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-800'}`}
                  onClick={() => toggleBarcode(id)}>
                  <input type="checkbox" checked={selected} onChange={() => toggleBarcode(id)} className="w-4 h-4 rounded text-primary-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white" dir="ltr">{b.barcode}</p>
                    <p className="text-xs text-gray-400">{b.is_primary ? 'باركود رئيسي' : 'ثانوي'} — {b.barcode_type}</p>
                  </div>
                  {selected && (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <label className="text-xs text-gray-500">عدد النسخ:</label>
                      <input type="number" min={1} className="input w-16 py-1" value={quantities[id] || 1} onChange={e => setQty(id, Number(e.target.value))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div>
              <label className="label">حجم اللصق</label>
              <select className="input" value={labelSize} onChange={e => setLabelSize(e.target.value as LabelSize)}>
                <option value="40x30">40×30 مم</option>
                <option value="50x30">50×30 مم</option>
                <option value="60x40">60×40 مم</option>
                <option value="100x50">100×50 مم</option>
              </select>
            </div>
            <div>
              <label className="label">نوع الباركود</label>
              <select className="input" value={format} onChange={e => setFormat(e.target.value as BarcodeFormat)}>
                <option value="CODE128">CODE128 (عام)</option>
                <option value="EAN13">EAN-13 (13 رقم)</option>
                <option value="EAN8">EAN-8 (8 أرقام)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">إظهار اسم المنتج</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">إظهار السعر</span>
            </label>
          </div>

          <div>
            <label className="label">عدد نسخ كل صفحة</label>
            <input type="number" min={1} className="input w-32" value={copies} onChange={e => setCopies(Math.max(1, Number(e.target.value)))} />
          </div>

          {totalLabels > 0 && (
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-sm text-primary-700 dark:text-primary-300">
              إجمالي اللصقات: {totalLabels} لصق
            </div>
          )}

          <div ref={printRef} className="hidden" />
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary">إغلاق</button>
          <button onClick={handlePrint} disabled={printing || selectedBarcodes.length === 0} className="btn-primary">
            {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {printing ? 'جارٍ الطباعة...' : 'طباعة'}
          </button>
        </div>
      </div>
    </div>
  );
}
