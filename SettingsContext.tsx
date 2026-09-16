import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { BusinessSettings } from '@/types/database';

const DEFAULT_SETTINGS: BusinessSettings = {
  business_name: 'سهيل سوفت',
  default_currency: 'YER',
  tax_enabled: false,
  inactivity_period_days: 30,
  camera_scan_enabled: false,
  product_search_enabled: true,
  manual_quantity_enabled: true,
  manual_product_selection_enabled: true,
  dark_mode: false,
  invoice_show_user: true,
  paper_size: 'A4',
  logo_url: null,
  business_address: '',
  business_phone: '',
  business_email: '',
  reorder_alerts_enabled: true,
  barcode_printer_type: 'browser',
  barcode_label_size: '50x30',
  barcode_format: 'CODE128',
  barcode_show_price: true,
  barcode_show_name: true,
  invoice_printer_type: 'browser',
  invoice_auto_print: false,
  invoice_font_size: 'medium',
  invoice_show_logo: true,
  invoice_show_footer: true,
  scanner_connection: 'usb',
  scanner_input_mode: 'keyboard',
  scanner_prefix: '',
  scanner_suffix: '',
  scanner_auto_enter: true,
  scanner_buffer_delay: 50,
};

interface SettingsContextValue {
  settings: BusinessSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  updateSetting: (key: string, value: unknown) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data, error } = await supabase.from('business_settings').select('key, value');
    if (error || !data) {
      setLoading(false);
      return;
    }

    const newSettings = { ...DEFAULT_SETTINGS };
    data.forEach((row: { key: string; value: unknown }) => {
      const key = row.key as keyof BusinessSettings;
      if (key in DEFAULT_SETTINGS) {
        (newSettings as Record<string, unknown>)[key] = row.value;
      }
    });
    setSettings(newSettings);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const updateSetting = async (key: string, value: unknown) => {
    await supabase.from('business_settings').upsert({
      key,
      value: value as never,
    }, { onConflict: 'key' });
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
