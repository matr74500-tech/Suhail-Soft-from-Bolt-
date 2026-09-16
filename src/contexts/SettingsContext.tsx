import { createContext, useContext, useState, type ReactNode } from 'react';

interface SettingsContextValue {
  language: 'ar' | 'en';
  setLanguage: (lang: 'ar' | 'en') => void;
  appName: string;
  currency: string;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const appName = 'نظام سهيل المحاسبي';
  const currency = 'ر.ي';

  return (
    <SettingsContext.Provider value={{ language, setLanguage, appName, currency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}