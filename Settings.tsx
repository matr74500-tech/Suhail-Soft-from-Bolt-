import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/format';
import type { Currency, Branch, Warehouse } from '@/types/database';
import {
  Save, Settings as SettingsIcon, Store, Building2, DollarSign, Bell,
  Printer, Barcode, ScanLine, FileText, Usb, Bluetooth, Wifi, CheckCircle,
  Plug, Keyboard, Mouse, ArrowDownToLine,
} from 'lucide-react';

export default function Settings() {
  const { settings, updateSetting } = useSettings();
  const { profile } = useAuth();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [tab, setTab] = useState<'business' | 'pos' | 'branches' | 'printing' | 'barcode' | 'scanner'>('business');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [local, setLocal] = useState<Record<string, unknown>>({
    business_name: settings.business_name,
    business_address: settings.business_address,
    business_phone: settings.business_phone,
    business_email: settings.business_email,
    logo_url: settings.logo_url || '',
    inactivity_period_days: settings.inactivity_period_days,
    camera_scan_enabled: settings.camera_scan_enabled,
    product_search_enabled: settings.product_search_enabled,
    manual_quantity_enabled: settings.manual_quantity_enabled,
    manual_product_selection_enabled: settings.manual_product_selection_enabled,
    invoice_show_user: settings.invoice_show_user,
    paper_size: settings.paper_size,
    reorder_alerts_enabled: settings.reorder_alerts_enabled,
    tax_enabled: settings.tax_enabled,
    barcode_printer_type: settings.barcode_printer_type || 'browser',
    barcode_label_size: settings.barcode_label_size || '50x30',
    barcode_format: settings.barcode_format || 'CODE128',
    barcode_show_price: settings.barcode_show_price !== false,
    barcode_show_name: settings.barcode_show_name !== false,
    invoice_printer_type: settings.invoice_printer_type || 'browser',
    invoice_auto_print: settings.invoice_auto_print || false,
    invoice_font_size: settings.invoice_font_size || 'medium',
    invoice_show_logo: settings.invoice_show_logo !== false,
    invoice_show_footer: settings.invoice_show_footer !== false,
    scanner_connection: settings.scanner_connection || 'usb',
    scanner_input_mode: settings.scanner_input_mode || 'keyboard',
    scanner_prefix: settings.scanner_prefix || '',
    scanner_suffix: settings.scanner_suffix || '',
    scanner_auto_enter: settings.scanner_auto_enter !== false,
    scanner_buffer_delay: settings.scanner_buffer_delay || 50,
  });

  useEffect(() => {
    supabase.from('currencies').select('*').eq('is_active', true).then(({ data }) => setCurrencies(data || []));
    supabase.from('branches').select('*').order('name_ar').then(({ data }) => setBranches(data || []));
    supabase.from('warehouses').select('*, branch:branches(*)').order('name_ar').then(({ data }) => setWarehouses(data || []));
  }, []);

  async function save() {
    setSaving(true);
    for (const [key, value] of Object.entries(local)) {
      await updateSetting(key, value);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const tabs = [
    { key: 'business', label: 'بيانات المنشأة', icon: Store },
    { key: 'pos', label: 'إعدادات البيع', icon: SettingsIcon },
    { key: 'branches', label: 'الفروع والمستودعات', icon: Building2 },
    { key: 'printing', label: 'طباعة الفواتير', icon: Printer },
    { key: 'barcode', label: 'طباعة الباركود', icon: Barcode },
    { key: 'scanner', label: 'ماسح الباركود', icon: ScanLine },
  ];

  function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
      <label className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="w-5 h-5 rounded text-primary-600" />
      </label>
    );
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><label className="label">{label}</label>{children}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key as 'business' | 'pos' | 'branches' | 'printing' | 'barcode' | 'scanner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.key ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-500'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'business' && (
        <div className="card p-6 space-y-4 max-w-2xl">
          <Field label="اسم المنشأة"><input className="input" value={local.business_name as string} onChange={e => setLocal({ ...local, business_name: e.target.value })} /></Field>
          <Field label="العنوان"><input className="input" value={local.business_address as string} onChange={e => setLocal({ ...local, business_address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="الهاتف"><input className="input" value={local.business_phone as string} onChange={e => setLocal({ ...local, business_phone: e.target.value })} dir="ltr" /></Field>
            <Field label="البريد الإلكتروني"><input className="input" value={local.business_email as string} onChange={e => setLocal({ ...local, business_email: e.target.value })} dir="ltr" /></Field>
          </div>
          <Field label="رابط الشعار"><input className="input" value={local.logo_url as string} onChange={e => setLocal({ ...local, logo_url: e.target.value })} dir="ltr" placeholder="https://..." /></Field>
          <Field label="فترة خمول العملاء (أيام)"><input type="number" className="input" value={local.inactivity_period_days as number} onChange={e => setLocal({ ...local, inactivity_period_days: Number(e.target.value) })} /></Field>
          <Toggle label="تفعيل الضريبة (VAT)" value={local.tax_enabled as boolean} onChange={v => setLocal({ ...local, tax_enabled: v })} />
        </div>
      )}

      {tab === 'pos' && (
        <div className="card p-6 space-y-1 max-w-2xl">
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">إعدادات شاشة البيع السريع</h3>
          <Toggle label="مسح الباركود بالكاميرا" value={local.camera_scan_enabled as boolean} onChange={v => setLocal({ ...local, camera_scan_enabled: v })} />
          <Toggle label="البحث عن المنتجات" value={local.product_search_enabled as boolean} onChange={v => setLocal({ ...local, product_search_enabled: v })} />
          <Toggle label="تعديل الكمية يدويًا" value={local.manual_quantity_enabled as boolean} onChange={v => setLocal({ ...local, manual_quantity_enabled: v })} />
          <Toggle label="اختيار المنتج يدويًا" value={local.manual_product_selection_enabled as boolean} onChange={v => setLocal({ ...local, manual_product_selection_enabled: v })} />
          <Toggle label="تنبيهات نقطة إعادة الطلب" value={local.reorder_alerts_enabled as boolean} onChange={v => setLocal({ ...local, reorder_alerts_enabled: v })} />
        </div>
      )}

      {tab === 'branches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">الفروع</h3>
              {branches.map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div><p className="text-sm font-medium text-gray-900 dark:text-white">{b.name_ar}</p><p className="text-xs text-gray-400">{b.code} — {b.phone || 'لا يوجد هاتف'}</p></div>
                  <span className={`badge ${b.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500'}`}>{b.is_active ? 'نشط' : 'غير نشط'}</span>
                </div>
              ))}
              {branches.length === 0 && <p className="text-sm text-gray-400 text-center py-4">لا توجد فروع</p>}
            </div>
            <div className="card p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3">المستودعات</h3>
              {warehouses.map(w => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div><p className="text-sm font-medium text-gray-900 dark:text-white">{w.name_ar}</p><p className="text-xs text-gray-400">{w.code}</p></div>
                  <span className={`badge ${w.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500'}`}>{w.is_active ? 'نشط' : 'غير نشط'}</span>
                </div>
              ))}
              {warehouses.length === 0 && <p className="text-sm text-gray-400 text-center py-4">لا توجد مستودعات</p>}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">العملات</h3>
            <div className="grid grid-cols-3 gap-3">
              {currencies.map(c => (
                <div key={c.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name_ar}</p>
                  <p className="text-xs text-gray-400">{c.code} — {c.symbol}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'printing' && (
        <div className="card p-6 space-y-4 max-w-2xl">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Printer className="w-5 h-5 text-primary-500" /> إعدادات طباعة الفواتير</h3>

          <Field label="حجم الورق">
            <select className="input" value={local.paper_size as string} onChange={e => setLocal({ ...local, paper_size: e.target.value })}>
              <option value="A4">A4 (عادي)</option>
              <option value="A5">A5 (نصف صفحة)</option>
              <option value="80mm">80mm (حراري — لفة عريضة)</option>
              <option value="58mm">58mm (حراري — لفة صغيرة)</option>
            </select>
          </Field>

          <Field label="نوع الطباعة">
            <select className="input" value={local.invoice_printer_type as string} onChange={e => setLocal({ ...local, invoice_printer_type: e.target.value })}>
              <option value="browser">طباعة عبر المتصفح</option>
              <option value="thermal_80">طابعة حرارية 80mm</option>
              <option value="thermal_58">طابعة حرارية 58mm</option>
              <option value="laser">طابعة ليزر/نافثة للحبر</option>
            </select>
          </Field>

          <Field label="حجم الخط">
            <select className="input" value={local.invoice_font_size as string} onChange={e => setLocal({ ...local, invoice_font_size: e.target.value })}>
              <option value="small">صغير</option>
              <option value="medium">متوسط</option>
              <option value="large">كبير</option>
            </select>
          </Field>

          <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Toggle label="طباعة تلقائية بعد إتمام البيع" value={local.invoice_auto_print as boolean} onChange={v => setLocal({ ...local, invoice_auto_print: v })} />
            <Toggle label="إظهار الشعار في الفاتورة" value={local.invoice_show_logo as boolean} onChange={v => setLocal({ ...local, invoice_show_logo: v })} />
            <Toggle label="إظهار التذييل (شكرًا لتعاملكم)" value={local.invoice_show_footer as boolean} onChange={v => setLocal({ ...local, invoice_show_footer: v })} />
            <Toggle label="إظهار اسم المستخدم في الفاتورة" value={local.invoice_show_user as boolean} onChange={v => setLocal({ ...local, invoice_show_user: v })} />
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <p className="font-medium">ملاحظات طباعة:</p>
            <p>• الطابعات الحرارية تستخدم ورق لفّي بدون حبر</p>
            <p>• الطباعة عبر المتصفح تدعم كل أنواع الطابعات المثبتة في النظام</p>
            <p>• للتغيير بين الطابعات استخدم Ctrl+P في نافذة الطباعة</p>
          </div>
        </div>
      )}

      {tab === 'barcode' && (
        <div className="card p-6 space-y-4 max-w-2xl">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Barcode className="w-5 h-5 text-primary-500" /> إعدادات طباعة الباركود</h3>

          <Field label="نوع الطابعة">
            <select className="input" value={local.barcode_printer_type as string} onChange={e => setLocal({ ...local, barcode_printer_type: e.target.value })}>
              <option value="browser">طباعة عبر المتصفح</option>
              <option value="thermal_label">طابعة لصق حرارية</option>
              <option value="label_printer">طابعة لصق عادية</option>
            </select>
          </Field>

          <Field label="حجم اللصق">
            <select className="input" value={local.barcode_label_size as string} onChange={e => setLocal({ ...local, barcode_label_size: e.target.value })}>
              <option value="40x30">40×30 مم</option>
              <option value="50x30">50×30 مم</option>
              <option value="60x40">60×40 مم</option>
              <option value="100x50">100×50 مم</option>
            </select>
          </Field>

          <Field label="صيغة الباركود">
            <select className="input" value={local.barcode_format as string} onChange={e => setLocal({ ...local, barcode_format: e.target.value })}>
              <option value="CODE128">CODE128 (عام — يدعم أرقام وحروف)</option>
              <option value="EAN13">EAN-13 (13 رقم)</option>
              <option value="EAN8">EAN-8 (8 أرقام)</option>
            </select>
          </Field>

          <div className="space-y-1 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Toggle label="إظهار اسم المنتج على اللصق" value={local.barcode_show_price as boolean} onChange={v => setLocal({ ...local, barcode_show_name: v })} />
            <Toggle label="إظهار السعر على اللصق" value={local.barcode_show_price as boolean} onChange={v => setLocal({ ...local, barcode_show_price: v })} />
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <p className="font-medium">نصائح طباعة الباركود:</p>
            <p>• استخدم طابعة لصق حرارية للحصول على أفضل جودة</p>
            <p>• صيغة CODE128 تدعم الأرقام والحروف معًا</p>
            <p>• تأكد من حجم اللصق المناسب لطابعتك</p>
          </div>
        </div>
      )}

      {tab === 'scanner' && (
        <div className="card p-6 space-y-4 max-w-2xl">
          <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><ScanLine className="w-5 h-5 text-primary-500" /> إعدادات ماسح الباركود</h3>

          <Field label="نوع الاتصال">
            <select className="input" value={local.scanner_connection as string} onChange={e => setLocal({ ...local, scanner_connection: e.target.value })}>
              <option value="usb">USB (توصيل مباشر)</option>
              <option value="bluetooth">Bluetooth (لاسلكي)</option>
              <option value="wifi">WiFi / شبكة (لاسلكي)</option>
              <option value="camera">كاميرا الجهاز</option>
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <ConnectionCard active={local.scanner_connection === 'usb'} icon={Usb} label="USB" desc="توصيل مباشر بالكيبل" />
            <ConnectionCard active={local.scanner_connection === 'bluetooth'} icon={Bluetooth} label="Bluetooth" desc="اتصال لاسلكي قصير المدى" />
            <ConnectionCard active={local.scanner_connection === 'wifi'} icon={Wifi} label="WiFi" desc="اتصال عبر الشبكة" />
          </div>

          <Field label="وضع الإدخال">
            <select className="input" value={local.scanner_input_mode as string} onChange={e => setLocal({ ...local, scanner_input_mode: e.target.value })}>
              <option value="keyboard">لوحة المفاتيح (Keyboard Emulation)</option>
              <option value="hid">HID (جهاز إدخال بشري)</option>
              <option value="serial">منفذ تسلسلي (Serial)</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="بادئة (Prefix)">
              <input className="input" value={local.scanner_prefix as string} onChange={e => setLocal({ ...local, scanner_prefix: e.target.value })} dir="ltr" placeholder="مثال: {" />
            </Field>
            <Field label="لاحقة (Suffix)">
              <input className="input" value={local.scanner_suffix as string} onChange={e => setLocal({ ...local, scanner_suffix: e.target.value })} dir="ltr" placeholder="مثال: }" />
            </Field>
          </div>

          <Field label="زمن التأخير بين المسحات (مللي ثانية)">
            <input type="number" className="input w-32" value={local.scanner_buffer_delay as number} onChange={e => setLocal({ ...local, scanner_buffer_delay: Number(e.target.value) })} />
          </Field>

          <Toggle label="إرسال Enter تلقائيًا بعد كل مسح" value={local.scanner_auto_enter as boolean} onChange={v => setLocal({ ...local, scanner_auto_enter: v })} />

          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-700 dark:text-emerald-400 space-y-1">
            <p className="font-medium flex items-center gap-1"><Plug className="w-4 h-4" /> كيفية توصيل الماسح:</p>
            <p>• USB: وصّل الماسح بأي منفذ USB — يعمل تلقائيًا كلوحة مفاتيح</p>
            <p>• Bluetooth: اقترن الماسح من إعدادات Bluetooth في جهازك</p>
            <p>• WiFi: أدخل عنوان IP الخاص بالماسح في إعدادات الشبكة</p>
            <p>• كاميرا: استخدم زر المسح في شاشة البيع السريع</p>
          </div>

          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-medium">اختبار الماسح:</p>
            <p>افتح شاشة البيع السريع وقم بمسح أي باركود — سيتم إضافته تلقائيًا للسلة</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" /> {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </button>
        {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> تم الحفظ بنجاح</span>}
      </div>
    </div>
  );
}

function ConnectionCard({ active, icon: Icon, label, desc }: { active: boolean; icon: typeof Usb; label: string; desc: string }) {
  return (
    <div className={`p-3 rounded-lg border-2 transition-all ${active ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-800'}`}>
      <Icon className={`w-6 h-6 mb-2 ${active ? 'text-primary-500' : 'text-gray-400'}`} />
      <p className="text-sm font-bold text-gray-900 dark:text-white">{label}</p>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}
