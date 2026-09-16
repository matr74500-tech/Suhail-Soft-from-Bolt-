/*
# Products, Inventory, and Barcode Tables

This migration creates the product/inventory schema:
- product_categories: Product categories/groups
- product_units: Units of measure (piece, dozen, carton, etc.)
- products: Main product table with prices, stock thresholds
- product_barcodes: Multiple barcodes per product with optional unit linkage
- product_images: Optional product images
- product_serials: Serial number tracking per product
- stock_levels: Current stock per product per warehouse
- stock_movements: Full stock movement history with COGS

NOTE: product_suppliers table is in migration 003 (needs suppliers table first)

## Security
- RLS enabled on all tables, authenticated CRUD
*/

-- ============================================================
-- PRODUCT_CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  parent_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_categories_select" ON product_categories;
CREATE POLICY "product_categories_select" ON product_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_categories_insert" ON product_categories;
CREATE POLICY "product_categories_insert" ON product_categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_categories_update" ON product_categories;
CREATE POLICY "product_categories_update" ON product_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_categories_delete" ON product_categories;
CREATE POLICY "product_categories_delete" ON product_categories FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCT_UNITS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_units_select" ON product_units;
CREATE POLICY "product_units_select" ON product_units FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_units_insert" ON product_units;
CREATE POLICY "product_units_insert" ON product_units FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_units_update" ON product_units;
CREATE POLICY "product_units_update" ON product_units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_units_delete" ON product_units;
CREATE POLICY "product_units_delete" ON product_units FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  base_unit_id uuid REFERENCES product_units(id) ON DELETE SET NULL,
  selling_unit_id uuid REFERENCES product_units(id) ON DELETE SET NULL,
  conversion_factor numeric(18,4) NOT NULL DEFAULT 1.0,
  purchase_price numeric(18,4) NOT NULL DEFAULT 0,
  retail_price numeric(18,4) NOT NULL DEFAULT 0,
  wholesale_price numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  min_stock numeric(18,4) NOT NULL DEFAULT 0,
  reorder_point numeric(18,4) NOT NULL DEFAULT 0,
  shelf_number text,
  location text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  requires_serial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCT_BARCODES (multiple barcodes per product)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode text UNIQUE NOT NULL,
  unit_id uuid REFERENCES product_units(id) ON DELETE SET NULL,
  conversion_factor numeric(18,4) DEFAULT 1.0,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  barcode_type text DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_barcodes_select" ON product_barcodes;
CREATE POLICY "product_barcodes_select" ON product_barcodes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_barcodes_insert" ON product_barcodes;
CREATE POLICY "product_barcodes_insert" ON product_barcodes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_barcodes_update" ON product_barcodes;
CREATE POLICY "product_barcodes_update" ON product_barcodes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_barcodes_delete" ON product_barcodes;
CREATE POLICY "product_barcodes_delete" ON product_barcodes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCT_IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_images_select" ON product_images;
CREATE POLICY "product_images_select" ON product_images FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_images_insert" ON product_images;
CREATE POLICY "product_images_insert" ON product_images FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_images_update" ON product_images;
CREATE POLICY "product_images_update" ON product_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_images_delete" ON product_images;
CREATE POLICY "product_images_delete" ON product_images FOR DELETE TO authenticated USING (true);

-- ============================================================
-- PRODUCT_SERIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS product_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  supplier_id uuid,
  purchase_invoice_id uuid,
  sales_invoice_id uuid,
  status text NOT NULL DEFAULT 'in_stock',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (serial_number)
);
ALTER TABLE product_serials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_serials_select" ON product_serials;
CREATE POLICY "product_serials_select" ON product_serials FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "product_serials_insert" ON product_serials;
CREATE POLICY "product_serials_insert" ON product_serials FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_serials_update" ON product_serials;
CREATE POLICY "product_serials_update" ON product_serials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_serials_delete" ON product_serials;
CREATE POLICY "product_serials_delete" ON product_serials FOR DELETE TO authenticated USING (true);

-- ============================================================
-- STOCK_LEVELS (current stock per product per warehouse)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity numeric(18,4) NOT NULL DEFAULT 0,
  reserved_quantity numeric(18,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_levels_select" ON stock_levels;
CREATE POLICY "stock_levels_select" ON stock_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stock_levels_insert" ON stock_levels;
CREATE POLICY "stock_levels_insert" ON stock_levels FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stock_levels_update" ON stock_levels;
CREATE POLICY "stock_levels_update" ON stock_levels FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stock_levels_delete" ON stock_levels;
CREATE POLICY "stock_levels_delete" ON stock_levels FOR DELETE TO authenticated USING (true);

-- ============================================================
-- STOCK_MOVEMENTS (full history with COGS)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  movement_type stock_movement_type NOT NULL,
  quantity numeric(18,4) NOT NULL,
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) NOT NULL DEFAULT 0,
  reference_type text,
  reference_id uuid,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "stock_movements_update" ON stock_movements;
CREATE POLICY "stock_movements_update" ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stock_movements_delete" ON stock_movements;
CREATE POLICY "stock_movements_delete" ON stock_movements FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_barcode ON product_barcodes(barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_product_warehouse ON stock_levels(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_product_serials_serial ON product_serials(serial_number);
CREATE INDEX IF NOT EXISTS idx_product_serials_product ON product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_status ON product_serials(status);

-- ============================================================
-- TRIGGERS
-- ============================================================
DO $do$ BEGIN
  CREATE TRIGGER product_categories_updated_at BEFORE UPDATE ON product_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER stock_levels_updated_at BEFORE UPDATE ON stock_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER product_serials_updated_at BEFORE UPDATE ON product_serials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- ============================================================
-- SEED DATA: Default units
-- ============================================================
INSERT INTO product_units (code, name_ar, name_en) VALUES
  ('piece', 'قطعة', 'Piece'),
  ('dozen', 'دزينة', 'Dozen'),
  ('carton', 'كرتون', 'Carton'),
  ('kg', 'كيلوغرام', 'Kilogram'),
  ('meter', 'متر', 'Meter'),
  ('liter', 'لتر', 'Liter'),
  ('box', 'صندوق', 'Box'),
  ('pack', 'باقة', 'Pack')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- SEED DATA: Default categories
-- ============================================================
INSERT INTO product_categories (code, name_ar, name_en) VALUES
  ('general', 'عام', 'General'),
  ('electronics', 'إلكترونيات', 'Electronics'),
  ('food', 'مواد غذائية', 'Food'),
  ('stationery', 'قرطاسية', 'Stationery'),
  ('clothing', 'ملابس', 'Clothing'),
  ('services', 'خدمات', 'Services')
ON CONFLICT (code) DO NOTHING;