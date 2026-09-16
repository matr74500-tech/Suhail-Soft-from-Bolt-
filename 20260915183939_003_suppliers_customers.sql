/*
# Suppliers, Customers, and Product-Supplier Relations

This migration creates:
- suppliers: Supplier master data with balances
- supplier_notes: Notes and follow-ups per supplier
- customers: Customer master data with balances and status
- customer_follow_ups: Communication records for inactive/late customers
- product_suppliers: Many-to-many product↔supplier with supplier-specific data
- services: Predefined service revenue items (no inventory)

## Security
- RLS enabled on all tables, authenticated CRUD
*/

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  phone text,
  email text,
  address text,
  contact_person text,
  opening_balance numeric(18,4) NOT NULL DEFAULT 0,
  current_balance numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SUPPLIER_NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  follow_up_date date,
  is_resolved boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supplier_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supplier_notes_select" ON supplier_notes;
CREATE POLICY "supplier_notes_select" ON supplier_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "supplier_notes_insert" ON supplier_notes;
CREATE POLICY "supplier_notes_insert" ON supplier_notes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "supplier_notes_update" ON supplier_notes;
CREATE POLICY "supplier_notes_update" ON supplier_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "supplier_notes_delete" ON supplier_notes;
CREATE POLICY "supplier_notes_delete" ON supplier_notes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  phone text,
  email text,
  address text,
  opening_balance numeric(18,4) NOT NULL DEFAULT 0,
  current_balance numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  status customer_status NOT NULL DEFAULT 'active',
  last_order_date timestamptz,
  usual_cycle_days integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- CUSTOMER_FOLLOW_UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  communication_type text NOT NULL,
  content text,
  result text,
  next_follow_up_date date,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_follow_ups_select" ON customer_follow_ups;
CREATE POLICY "customer_follow_ups_select" ON customer_follow_ups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "customer_follow_ups_insert" ON customer_follow_ups;
CREATE POLICY "customer_follow_ups_insert" ON customer_follow_ups FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "customer_follow_ups_update" ON customer_follow_ups;
CREATE POLICY "customer_follow_ups_update" ON customer_follow_ups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "customer_follow_ups_delete" ON customer_follow_ups;
CREATE POLICY "customer_follow_ups_delete" ON customer_follow_ups FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCT_SUPPLIERS (many-to-many with extra data)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_product_code text,
  last_purchase_price numeric(18,4),
  last_purchase_date timestamptz,
  is_preferred boolean NOT NULL DEFAULT false,
  is_alternative boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, supplier_id)
);
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_suppliers_select" ON product_suppliers;
CREATE POLICY "product_suppliers_select" ON product_suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_suppliers_insert" ON product_suppliers;
CREATE POLICY "product_suppliers_insert" ON product_suppliers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_suppliers_update" ON product_suppliers;
CREATE POLICY "product_suppliers_update" ON product_suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_suppliers_delete" ON product_suppliers;
CREATE POLICY "product_suppliers_delete" ON product_suppliers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SERVICES (predefined service revenue items - no inventory)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  default_price numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  category text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_select" ON services;
CREATE POLICY "services_select" ON services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "services_insert" ON services;
CREATE POLICY "services_insert" ON services FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "services_update" ON services;
CREATE POLICY "services_update" ON services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "services_delete" ON services;
CREATE POLICY "services_delete" ON services FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customer_follow_ups_customer ON customer_follow_ups(customer_id);
CREATE INDEX IF NOT EXISTS idx_supplier_notes_supplier ON supplier_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DO $do$ BEGIN
  CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER product_suppliers_updated_at BEFORE UPDATE ON product_suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ============================================================
-- SEED DATA: Default services
-- ============================================================
INSERT INTO services (code, name_ar, name_en, default_price, category) VALUES
  ('gift_wrap', 'تغليف هدايا', 'Gift Wrapping', 500, 'service'),
  ('printing', 'طباعة', 'Printing', 200, 'service'),
  ('design', 'تصميم', 'Design', 1000, 'service'),
  ('photography', 'تصوير فوتوغرافي', 'Photography', 2000, 'service'),
  ('binding', 'تجليد', 'Binding', 300, 'service'),
  ('computer_svc', 'خدمات حاسوب', 'Computer Services', 1500, 'service')
ON CONFLICT (code) DO NOTHING;