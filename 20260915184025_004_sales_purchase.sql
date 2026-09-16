/*
# Sales, Purchase, and Document Tables

This migration creates the full sales/purchase document workflow:
- documents: Unified document table (quotations, orders, invoices, returns, requests)
- document_items: Line items for each document
- document_payments: Payment records per document with split payment support
- price_lists: Customer-specific price lists
- price_list_items: Items within price lists
- transfers: Inter-warehouse stock transfers
- transfer_items: Items within transfers

## Document Flow
- Quotation → Sales Invoice (convert)
- Sales Order → Sales Invoice (convert)
- Purchase Request → Purchase Order (convert)
- Purchase Order → Receiving → Purchase Invoice (convert)
- Sales Return, Purchase Return as separate documents

## Security
- RLS enabled on all tables, authenticated CRUD
*/

-- ============================================================
-- PRICE_LISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_lists_select" ON price_lists;
CREATE POLICY "price_lists_select" ON price_lists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "price_lists_insert" ON price_lists;
CREATE POLICY "price_lists_insert" ON price_lists FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "price_lists_update" ON price_lists;
CREATE POLICY "price_lists_update" ON price_lists FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "price_lists_delete" ON price_lists;
CREATE POLICY "price_lists_delete" ON price_lists FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRICE_LIST_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS price_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES product_units(id) ON DELETE SET NULL,
  price numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_list_id, product_id)
);
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_list_items_select" ON price_list_items;
CREATE POLICY "price_list_items_select" ON price_list_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "price_list_items_insert" ON price_list_items;
CREATE POLICY "price_list_items_insert" ON price_list_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "price_list_items_update" ON price_list_items;
CREATE POLICY "price_list_items_update" ON price_list_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "price_list_items_delete" ON price_list_items;
CREATE POLICY "price_list_items_delete" ON price_list_items FOR DELETE TO authenticated USING (true);

-- ============================================================
-- DOCUMENTS (unified invoice/document table)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text UNIQUE NOT NULL,
  doc_type invoice_type NOT NULL,
  status document_status NOT NULL DEFAULT 'draft',
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  party_type text NOT NULL DEFAULT 'customer',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  subtotal numeric(18,4) NOT NULL DEFAULT 0,
  discount_amount numeric(18,4) NOT NULL DEFAULT 0,
  discount_percentage numeric(8,4) NOT NULL DEFAULT 0,
  total numeric(18,4) NOT NULL DEFAULT 0,
  paid_amount numeric(18,4) NOT NULL DEFAULT 0,
  remaining_amount numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) NOT NULL DEFAULT 0,
  gross_profit numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate numeric(18,6) NOT NULL DEFAULT 1.0,
  payment_method payment_method,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  source_document_number text,
  notes text,
  is_closed_day boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "documents_delete" ON documents;
CREATE POLICY "documents_delete" ON documents FOR DELETE TO authenticated USING (true);

-- ============================================================
-- DOCUMENT_ITEMS (line items)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  item_type text NOT NULL DEFAULT 'product',
  description text,
  unit_id uuid REFERENCES product_units(id) ON DELETE SET NULL,
  quantity numeric(18,4) NOT NULL DEFAULT 1,
  unit_price numeric(18,4) NOT NULL DEFAULT 0,
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  discount_amount numeric(18,4) NOT NULL DEFAULT 0,
  line_total numeric(18,4) NOT NULL DEFAULT 0,
  line_cost numeric(18,4) NOT NULL DEFAULT 0,
  serial_number text,
  barcode_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_items_select" ON document_items;
CREATE POLICY "document_items_select" ON document_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "document_items_insert" ON document_items;
CREATE POLICY "document_items_insert" ON document_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "document_items_update" ON document_items;
CREATE POLICY "document_items_update" ON document_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "document_items_delete" ON document_items;
CREATE POLICY "document_items_delete" ON document_items FOR DELETE TO authenticated USING (true);

-- ============================================================
-- DOCUMENT_PAYMENTS (split payment support)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  amount numeric(18,4) NOT NULL DEFAULT 0,
  financial_account_id uuid,
  reference_number text,
  transaction_id text,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate numeric(18,6) NOT NULL DEFAULT 1.0,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE document_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_payments_select" ON document_payments;
CREATE POLICY "document_payments_select" ON document_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "document_payments_insert" ON document_payments;
CREATE POLICY "document_payments_insert" ON document_payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "document_payments_update" ON document_payments;
CREATE POLICY "document_payments_update" ON document_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "document_payments_delete" ON document_payments;
CREATE POLICY "document_payments_delete" ON document_payments FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TRANSFERS (inter-warehouse)
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text UNIQUE NOT NULL,
  from_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  status document_status NOT NULL DEFAULT 'draft',
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfers_select" ON transfers;
CREATE POLICY "transfers_select" ON transfers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "transfers_insert" ON transfers;
CREATE POLICY "transfers_insert" ON transfers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "transfers_update" ON transfers;
CREATE POLICY "transfers_update" ON transfers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "transfers_delete" ON transfers;
CREATE POLICY "transfers_delete" ON transfers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TRANSFER_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  unit_id uuid REFERENCES product_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfer_items_select" ON transfer_items;
CREATE POLICY "transfer_items_select" ON transfer_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "transfer_items_insert" ON transfer_items;
CREATE POLICY "transfer_items_insert" ON transfer_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "transfer_items_update" ON transfer_items;
CREATE POLICY "transfer_items_update" ON transfer_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "transfer_items_delete" ON transfer_items;
CREATE POLICY "transfer_items_delete" ON transfer_items FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(document_number);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(document_date);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_supplier ON documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_documents_warehouse ON documents(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_document_id);
CREATE INDEX IF NOT EXISTS idx_document_items_document ON document_items(document_id);
CREATE INDEX IF NOT EXISTS idx_document_items_product ON document_items(product_id);
CREATE INDEX IF NOT EXISTS idx_document_payments_document ON document_payments(document_id);
CREATE INDEX IF NOT EXISTS idx_transfers_number ON transfers(transfer_number);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_customer ON price_lists(customer_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DO $do$ BEGIN
  CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER transfers_updated_at BEFORE UPDATE ON transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER price_lists_updated_at BEFORE UPDATE ON price_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;