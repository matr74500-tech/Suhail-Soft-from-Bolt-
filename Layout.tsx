import { useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import {
  LayoutDashboard, ScanLine, Package, Warehouse, Users, Truck,
  ShoppingCart, FileText, BarChart3, Settings, LogOut, Menu, X,
  Moon, Sun, Bell, Wallet, Receipt, CreditCard, Banknote, ArrowLeftRight,
  PackageSearch, UserCheck, Wrench, Moon as MoonIcon, BookOpen,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  page: string;
  permission?: string;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'الرئيسية',
    items: [
      { label: 'لوحة التحكم', icon: LayoutDashboard, page: 'dashboard' },
    ],
  },
  {
    title: 'المبيعات',
    items: [
      { label: 'البيع السريع', icon: ScanLine, page: 'pos', permission: 'pos_sale' },
      { label: 'المستندات', icon: FileText, page: 'documents', permission: 'pos_sale' },
    ],
  },
  {
    title: 'المخزون',
    items: [
      { label: 'المنتجات', icon: Package, page: 'products', permission: 'manage_inventory' },
      { label: 'المخزون', icon: Warehouse, page: 'inventory', permission: 'manage_inventory' },
      { label: 'التحويلات', icon: ArrowLeftRight, page: 'transfers', permission: 'manage_transfers' },
      { label: 'الأرقام التسلسلية', icon: PackageSearch, page: 'serials', permission: 'manage_inventory' },
    ],
  },
  {
    title: 'المشتريات',
    items: [
      { label: 'الموردون', icon: Truck, page: 'suppliers', permission: 'manage_purchases' },
      { label: 'المشتريات', icon: ShoppingCart, page: 'purchases', permission: 'manage_purchases' },
    ],
  },
  {
    title: 'العملاء',
    items: [
      { label: 'العملاء', icon: Users, page: 'customers' },
      { label: 'العملاء غير النشطين', icon: UserCheck, page: 'inactive-customers' },
    ],
  },
  {
    title: 'المالية',
    items: [
      { label: 'الحسابات المالية', icon: Wallet, page: 'accounts', permission: 'view_financials' },
      { label: 'المصروفات', icon: Receipt, page: 'expenses', permission: 'manage_expenses' },
      { label: 'إيرادات الخدمات', icon: Wrench, page: 'service-revenues', permission: 'manage_revenues' },
      { label: 'التسوية البنكية', icon: Banknote, page: 'reconciliation', permission: 'bank_reconciliation' },
      { label: 'الإغلاق اليومي', icon: MoonIcon, page: 'daily-closing', permission: 'view_financials' },
    ],
  },
  {
    title: 'التقارير',
    items: [
      { label: 'التقارير', icon: BarChart3, page: 'reports', permission: 'view_reports' },
    ],
  },
  {
    title: 'النظام',
    items: [
      { label: 'الخدمات', icon: Wrench, page: 'services', permission: 'manage_settings' },
      { label: 'الإعدادات', icon: Settings, page: 'settings', permission: 'manage_settings' },
      { label: 'سجل التدقيق', icon: BookOpen, page: 'audit', permission: 'manage_users' },
    ],
  },
];

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { profile, signOut, hasPermission, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!item.permission) return true;
      if (isAdmin()) return true;
      if (hasPermission(item.permission)) return true;
      const hasAnyPermission = (profile?.permissions?.length ?? 0) > 0;
      if (!hasAnyPermission && profile) return true;
      return false;
    }),
  })).filter(group => group.items.length > 0);

  const currentLabel = NAV_GROUPS
    .flatMap(g => g.items)
    .find(item => item.page === currentPage)?.label ?? '';

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 right-0 h-screen w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800
        z-40 transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-teal-700 flex items-center justify-center shadow-md">
              <span className="text-lg font-bold text-white">س</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">{settings.business_name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">نظام إدارة الأعمال</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleGroups.map((group) => (
            <div key={group.title} className="mb-2">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-600 px-3 py-2 uppercase tracking-wide">
                {group.title}
              </h3>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.page;
                return (
                  <button
                    key={item.page}
                    onClick={() => {
                      onNavigate(item.page);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${active
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
              {profile?.full_name_ar?.charAt(0) ?? '؟'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{profile?.full_name_ar}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {profile?.roles?.map(r => r.name_ar).join(', ') || 'مستخدم'}
              </p>
            </div>
            <button onClick={signOut} className="btn-ghost p-1.5 text-red-500 hover:text-red-600" title="تسجيل الخروج">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 lg:px-6 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden btn-ghost p-1.5">
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{currentLabel}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="btn-ghost p-2" title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}>
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button className="btn-ghost p-2 relative" title="الإشعارات">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
