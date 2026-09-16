import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Login from '@/pages/Login';
import Layout from '@/components/common/Layout';
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import Customers from '@/pages/Customers';
import Suppliers from '@/pages/Suppliers';
import Documents from '@/pages/Documents';
import Purchases from '@/pages/Purchases';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Expenses from '@/pages/Expenses';
import ServiceRevenues from '@/pages/ServiceRevenues';
import Accounts from '@/pages/Accounts';
import Transfers from '@/pages/Transfers';
import Serials from '@/pages/Serials';
import InactiveCustomers from '@/pages/InactiveCustomers';
import Reconciliation from '@/pages/Reconciliation';
import DailyClosing from '@/pages/DailyClosing';
import Services from '@/pages/Services';
import AuditLog from '@/pages/AuditLog';
import Placeholder from '@/pages/Placeholder';

function AppContent() {
  const { session, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'pos': return <POS />;
      case 'products': return <Products />;
      case 'inventory': return <Inventory />;
      case 'customers': return <Customers />;
      case 'suppliers': return <Suppliers />;
      case 'documents': return <Documents />;
      case 'purchases': return <Purchases />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      case 'expenses': return <Expenses />;
      case 'service-revenues': return <ServiceRevenues />;
      case 'accounts': return <Accounts />;
      case 'transfers': return <Transfers />;
      case 'serials': return <Serials />;
      case 'inactive-customers': return <InactiveCustomers />;
      case 'reconciliation': return <Reconciliation />;
      case 'daily-closing': return <DailyClosing />;
      case 'services': return <Services />;
      case 'audit': return <AuditLog />;
      default: return <Placeholder title="صفحة قيد التطوير" />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}