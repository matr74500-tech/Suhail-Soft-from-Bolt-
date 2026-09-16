/*
# Core Foundation Tables for سهيل سوفت ERP

This migration creates the foundational tables for the entire ERP system:
- branches: Business branches/locations
- warehouses: Storage locations belonging to branches
- user_profiles: Extended user info linked to Supabase Auth
- roles: Configurable roles (admin, cashier, manager, etc.)
- permissions: Granular permissions
- role_permissions: Many-to-many role↔permission mapping
- user_roles: Many-to-many user↔role mapping
- warehouse_access: Users restricted to specific warehouses
- currencies: Supported currencies (YER, SAR, USD)
- exchange_rates: Historical exchange rates
- business_settings: System-wide configuration

## Security
- RLS enabled on all tables
- Policies scoped to authenticated users (multi-user system with sign-in)

## Notes
1. This is a multi-user system with Supabase Auth sign-in
2. All tables use uuid primary keys with gen_random_uuid()
3. Timestamps use timestamptz with DEFAULT now()
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $do$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'wallet', 'bank_account', 'bank_transfer', 'local_transfer', 'credit', 'split');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TYPE document_status AS ENUM ('draft', 'pending', 'approved', 'cancelled', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('purchase', 'sale', 'sale_return', 'purchase_return', 'transfer_in', 'transfer_out', 'adjustment', 'opening', 'initial');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TYPE invoice_type AS ENUM ('sales', 'purchase', 'quotation', 'sales_order', 'purchase_request', 'purchase_order');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TYPE alert_state AS ENUM ('normal', 'near_reorder', 'reorder_required', 'low', 'out_of_stock');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'late');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ============================================================
-- BRANCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  address text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_select" ON branches;
CREATE POLICY "branches_select" ON branches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "branches_insert" ON branches;
CREATE POLICY "branches_insert" ON branches FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "branches_update" ON branches;
CREATE POLICY "branches_update" ON branches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "branches_delete" ON branches;
CREATE POLICY "branches_delete" ON branches FOR DELETE TO authenticated USING (true);

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouses_select" ON warehouses;
CREATE POLICY "warehouses_select" ON warehouses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "warehouses_insert" ON warehouses;
CREATE POLICY "warehouses_insert" ON warehouses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "warehouses_update" ON warehouses;
CREATE POLICY "warehouses_update" ON warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "warehouses_delete" ON warehouses;
CREATE POLICY "warehouses_delete" ON warehouses FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roles_insert" ON roles;
CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "roles_delete" ON roles;
CREATE POLICY "roles_delete" ON roles FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  module text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_select" ON permissions;
CREATE POLICY "permissions_select" ON permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "permissions_insert" ON permissions;
CREATE POLICY "permissions_insert" ON permissions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "permissions_update" ON permissions;
CREATE POLICY "permissions_update" ON permissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "permissions_delete" ON permissions;
CREATE POLICY "permissions_delete" ON permissions FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ROLE_PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_select" ON role_permissions;
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_permissions_insert" ON role_permissions;
CREATE POLICY "role_permissions_insert" ON role_permissions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "role_permissions_update" ON role_permissions;
CREATE POLICY "role_permissions_update" ON role_permissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "role_permissions_delete" ON role_permissions;
CREATE POLICY "role_permissions_delete" ON role_permissions FOR DELETE TO authenticated USING (true);

-- ============================================================
-- USER_PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name_ar text NOT NULL,
  full_name_en text,
  phone text,
  email text,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;
CREATE POLICY "user_profiles_delete" ON user_profiles FOR DELETE TO authenticated USING (true);

-- ============================================================
-- USER_ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_profile_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_profile_id, role_id)
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE TO authenticated USING (true);

-- ============================================================
-- WAREHOUSE_ACCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouse_access (
  user_profile_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_profile_id, warehouse_id)
);
ALTER TABLE warehouse_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_access_select" ON warehouse_access;
CREATE POLICY "warehouse_access_select" ON warehouse_access FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "warehouse_access_insert" ON warehouse_access;
CREATE POLICY "warehouse_access_insert" ON warehouse_access FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "warehouse_access_update" ON warehouse_access;
CREATE POLICY "warehouse_access_update" ON warehouse_access FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "warehouse_access_delete" ON warehouse_access;
CREATE POLICY "warehouse_access_delete" ON warehouse_access FOR DELETE TO authenticated USING (true);

-- ============================================================
-- CURRENCIES
-- ============================================================
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  symbol text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "currencies_select" ON currencies;
CREATE POLICY "currencies_select" ON currencies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "currencies_insert" ON currencies;
CREATE POLICY "currencies_insert" ON currencies FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "currencies_update" ON currencies;
CREATE POLICY "currencies_update" ON currencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "currencies_delete" ON currencies;
CREATE POLICY "currencies_delete" ON currencies FOR DELETE TO authenticated USING (true);

-- ============================================================
-- EXCHANGE_RATES (historical)
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency_id uuid NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
  to_currency_id uuid NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
  rate numeric(18,6) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exchange_rates_select" ON exchange_rates;
CREATE POLICY "exchange_rates_select" ON exchange_rates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "exchange_rates_insert" ON exchange_rates;
CREATE POLICY "exchange_rates_insert" ON exchange_rates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "exchange_rates_update" ON exchange_rates;
CREATE POLICY "exchange_rates_update" ON exchange_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "exchange_rates_delete" ON exchange_rates;
CREATE POLICY "exchange_rates_delete" ON exchange_rates FOR DELETE TO authenticated USING (true);

-- ============================================================
-- BUSINESS_SETTINGS (key-value configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_settings_select" ON business_settings;
CREATE POLICY "business_settings_select" ON business_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "business_settings_insert" ON business_settings;
CREATE POLICY "business_settings_insert" ON business_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "business_settings_update" ON business_settings;
CREATE POLICY "business_settings_update" ON business_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "business_settings_delete" ON business_settings;
CREATE POLICY "business_settings_delete" ON business_settings FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATED_AT trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DO $do$ BEGIN
  CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER business_settings_updated_at BEFORE UPDATE ON business_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ============================================================
-- SEED DATA: Currencies
-- ============================================================
INSERT INTO currencies (code, name_ar, name_en, symbol) VALUES
  ('YER', 'ريال يمني', 'Yemeni Rial', 'ر.ي'),
  ('SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س'),
  ('USD', 'دولار أمريكي', 'US Dollar', '$')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED DATA: Default exchange rates
-- ============================================================
INSERT INTO exchange_rates (from_currency_id, to_currency_id, rate)
SELECT c1.id, c2.id, 140.0 FROM currencies c1, currencies c2 WHERE c1.code='SAR' AND c2.code='YER'
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (from_currency_id, to_currency_id, rate)
SELECT c1.id, c2.id, 500.0 FROM currencies c1, currencies c2 WHERE c1.code='USD' AND c2.code='YER'
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (from_currency_id, to_currency_id, rate)
SELECT c1.id, c2.id, 1.0 FROM currencies c1, currencies c2 WHERE c1.code='YER' AND c2.code='YER'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA: Roles
-- ============================================================
INSERT INTO roles (code, name_ar, name_en, is_system, description) VALUES
  ('admin', 'مدير النظام', 'System Administrator', true, 'Full access to all features'),
  ('manager', 'مدير', 'Manager', true, 'Manage most operations except system settings'),
  ('cashier', 'كاشير', 'Cashier', true, 'POS sales and basic operations'),
  ('accountant', 'محاسب', 'Accountant', true, 'Financial operations and reports')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED DATA: Permissions
-- ============================================================
INSERT INTO permissions (code, name_ar, name_en, module) VALUES
  ('pos_sale', 'بيع سريع', 'Fast Sale', 'sales'),
  ('view_prices', 'عرض الأسعار', 'View Prices', 'products'),
  ('edit_prices', 'تعديل الأسعار', 'Edit Prices', 'products'),
  ('edit_discounts', 'تعديل الخصومات', 'Edit Discounts', 'sales'),
  ('stock_adjust', 'تعديل المخزون', 'Stock Adjustment', 'inventory'),
  ('view_financials', 'عرض الحسابات المالية', 'View Financial Accounts', 'finance'),
  ('edit_financials', 'تعديل الحسابات المالية', 'Edit Financial Accounts', 'finance'),
  ('manage_expenses', 'إدارة المصروفات', 'Manage Expenses', 'finance'),
  ('manage_revenues', 'إدارة الإيرادات', 'Manage Revenues', 'finance'),
  ('view_customer_debt', 'عرض ديون العملاء', 'View Customer Debt', 'customers'),
  ('edit_customer_debt', 'تعديل ديون العملاء', 'Edit Customer Debt', 'customers'),
  ('view_supplier_balance', 'عرض أرصدة الموردين', 'View Supplier Balances', 'suppliers'),
  ('view_reports', 'عرض التقارير', 'View Reports', 'reports'),
  ('view_users', 'عرض المستخدمين', 'View Users', 'users'),
  ('manage_users', 'إدارة المستخدمين', 'Manage Users', 'users'),
  ('manage_settings', 'إدارة الإعدادات', 'Manage Settings', 'system'),
  ('modify_closed_day', 'تعديل يوم مغلق', 'Modify Closed Day', 'system'),
  ('view_all_branches', 'عرض كل الفروع', 'View All Branches', 'system'),
  ('bank_reconciliation', 'تسوية بنكية', 'Bank Reconciliation', 'finance'),
  ('manage_inventory', 'إدارة المخزون', 'Manage Inventory', 'inventory'),
  ('manage_purchases', 'إدارة المشتريات', 'Manage Purchases', 'purchases'),
  ('manage_transfers', 'إدارة التحويلات', 'Manage Transfers', 'inventory'),
  ('view_cost', 'عرض التكلفة', 'View Cost/COGS', 'reports'),
  ('export_documents', 'تصدير المستندات', 'Export Documents', 'system')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED DATA: All permissions for admin role
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

-- Cashier permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'cashier' AND p.code IN ('pos_sale', 'view_prices')
ON CONFLICT DO NOTHING;

-- Manager permissions (most except system-level)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'manager' AND p.code NOT IN ('manage_settings', 'manage_users', 'modify_closed_day')
ON CONFLICT DO NOTHING;

-- Accountant permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'accountant' AND p.code IN ('view_financials', 'edit_financials', 'manage_expenses', 'manage_revenues', 'view_reports', 'view_cost', 'bank_reconciliation', 'export_documents', 'view_customer_debt', 'edit_customer_debt', 'view_supplier_balance')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA: Default business settings
-- ============================================================
INSERT INTO business_settings (key, value, description) VALUES
  ('business_name', '"سهيل سوفت"', 'Business name'),
  ('default_currency', '"YER"', 'Default currency code'),
  ('tax_enabled', 'false', 'Enable tax/VAT calculations'),
  ('inactivity_period_days', '30', 'Customer inactivity period in days'),
  ('camera_scan_enabled', 'false', 'Enable camera barcode scanning in POS'),
  ('product_search_enabled', 'true', 'Enable product search in POS'),
  ('manual_quantity_enabled', 'true', 'Enable manual quantity editing in POS'),
  ('manual_product_selection_enabled', 'true', 'Enable manual product selection in POS'),
  ('dark_mode', 'false', 'Default dark mode preference'),
  ('invoice_show_user', 'true', 'Show user name on printed invoices'),
  ('paper_size', '"A4"', 'Default paper size for printing'),
  ('logo_url', 'null', 'Business logo URL'),
  ('business_address', '""', 'Business address'),
  ('business_phone', '""', 'Business phone'),
  ('business_email', '""', 'Business email'),
  ('reorder_alerts_enabled', 'true', 'Enable reorder point alerts')
ON CONFLICT (key) DO NOTHING;