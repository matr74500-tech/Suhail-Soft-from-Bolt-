/*
# Financial, Audit, and Sync Tables

This migration creates:
- financial_accounts: Cash, wallet, bank, local transfer accounts
- expenses: Daily expenses with categories
- service_revenues: Service/other revenue (no inventory deduction)
- bank_reconciliations: Bank reconciliation records
- bank_reconciliation_items: Matched/unmatched transactions
- daily_closings: Daily closing summaries
- audit_logs: Complete audit trail for sensitive operations
- sync_queue: Offline sync queue for idempotent operations
- notifications: Notification center

## Security
- RLS enabled on all tables, authenticated CRUD
*/

-- ============================================================
-- FINANCIAL_ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  account_type text NOT NULL DEFAULT 'cash',
  bank_name text,
  bank_account_number text,
  wallet_provider text,
  wallet_number text,
  opening_balance numeric(18,4) NOT NULL DEFAULT 0,
  current_balance numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_accounts_select" ON financial_accounts;
CREATE POLICY "financial_accounts_select" ON financial_accounts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "financial_accounts_insert" ON financial_accounts;
CREATE POLICY "financial_accounts_insert" ON financial_accounts FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "financial_accounts_update" ON financial_accounts;
CREATE POLICY "financial_accounts_update" ON financial_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "financial_accounts_delete" ON financial_accounts;
CREATE POLICY "financial_accounts_delete" ON financial_accounts FOR DELETE TO authenticated USING (true);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type text NOT NULL,
  amount numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate numeric(18,6) NOT NULL DEFAULT 1.0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  beneficiary text,
  reason text,
  notes text,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  financial_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SERVICE_REVENUES (revenue without inventory sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  amount numeric(18,4) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  exchange_rate numeric(18,6) NOT NULL DEFAULT 1.0,
  revenue_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  financial_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  notes text,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_revenues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_revenues_select" ON service_revenues;
CREATE POLICY "service_revenues_select" ON service_revenues FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "service_revenues_insert" ON service_revenues;
CREATE POLICY "service_revenues_insert" ON service_revenues FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "service_revenues_update" ON service_revenues;
CREATE POLICY "service_revenues_update" ON service_revenues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_revenues_delete" ON service_revenues;
CREATE POLICY "service_revenues_delete" ON service_revenues FOR DELETE TO authenticated USING (true);

-- ============================================================
-- BANK_RECONCILIATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_account_id uuid NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  reconciliation_date date NOT NULL DEFAULT CURRENT_DATE,
  opening_balance numeric(18,4) NOT NULL DEFAULT 0,
  closing_balance numeric(18,4) NOT NULL DEFAULT 0,
  bank_closing_balance numeric(18,4) NOT NULL DEFAULT 0,
  difference numeric(18,4) NOT NULL DEFAULT 0,
  status document_status NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_reconciliations_select" ON bank_reconciliations;
CREATE POLICY "bank_reconciliations_select" ON bank_reconciliations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bank_reconciliations_insert" ON bank_reconciliations;
CREATE POLICY "bank_reconciliations_insert" ON bank_reconciliations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bank_reconciliations_update" ON bank_reconciliations;
CREATE POLICY "bank_reconciliations_update" ON bank_reconciliations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bank_reconciliations_delete" ON bank_reconciliations;
CREATE POLICY "bank_reconciliations_delete" ON bank_reconciliations FOR DELETE TO authenticated USING (true);

-- ============================================================
-- BANK_RECONCILIATION_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  transaction_date date,
  description text,
  system_amount numeric(18,4) NOT NULL DEFAULT 0,
  bank_amount numeric(18,4) NOT NULL DEFAULT 0,
  is_matched boolean NOT NULL DEFAULT false,
  match_type text DEFAULT 'unmatched',
  reference_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bank_reconciliation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_reconciliation_items_select" ON bank_reconciliation_items;
CREATE POLICY "bank_reconciliation_items_select" ON bank_reconciliation_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bank_reconciliation_items_insert" ON bank_reconciliation_items;
CREATE POLICY "bank_reconciliation_items_insert" ON bank_reconciliation_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bank_reconciliation_items_update" ON bank_reconciliation_items;
CREATE POLICY "bank_reconciliation_items_update" ON bank_reconciliation_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bank_reconciliation_items_delete" ON bank_reconciliation_items;
CREATE POLICY "bank_reconciliation_items_delete" ON bank_reconciliation_items FOR DELETE TO authenticated USING (true);

-- ============================================================
-- DAILY_CLOSINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date date NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  total_sales numeric(18,4) NOT NULL DEFAULT 0,
  total_purchases numeric(18,4) NOT NULL DEFAULT 0,
  total_cash numeric(18,4) NOT NULL DEFAULT 0,
  total_wallets numeric(18,4) NOT NULL DEFAULT 0,
  total_banks numeric(18,4) NOT NULL DEFAULT 0,
  total_local_transfers numeric(18,4) NOT NULL DEFAULT 0,
  total_expenses numeric(18,4) NOT NULL DEFAULT 0,
  total_other_revenues numeric(18,4) NOT NULL DEFAULT 0,
  total_receipts numeric(18,4) NOT NULL DEFAULT 0,
  total_payments numeric(18,4) NOT NULL DEFAULT 0,
  total_returns numeric(18,4) NOT NULL DEFAULT 0,
  total_profit numeric(18,4) NOT NULL DEFAULT 0,
  total_cogs numeric(18,4) NOT NULL DEFAULT 0,
  differences numeric(18,4) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'closed',
  notes text,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closing_date, branch_id)
);
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_closings_select" ON daily_closings;
CREATE POLICY "daily_closings_select" ON daily_closings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_closings_insert" ON daily_closings;
CREATE POLICY "daily_closings_insert" ON daily_closings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "daily_closings_update" ON daily_closings;
CREATE POLICY "daily_closings_update" ON daily_closings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "daily_closings_delete" ON daily_closings;
CREATE POLICY "daily_closings_delete" ON daily_closings FOR DELETE TO authenticated USING (true);

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  user_name text,
  operation text NOT NULL,
  table_name text,
  document_type text,
  document_id uuid,
  previous_value jsonb,
  new_value jsonb,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "audit_logs_update" ON audit_logs;
CREATE POLICY "audit_logs_update" ON audit_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SYNC_QUEUE (offline sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  table_name text NOT NULL,
  record_data jsonb NOT NULL,
  idempotency_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_queue_select" ON sync_queue;
CREATE POLICY "sync_queue_select" ON sync_queue FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sync_queue_insert" ON sync_queue;
CREATE POLICY "sync_queue_insert" ON sync_queue FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sync_queue_update" ON sync_queue;
CREATE POLICY "sync_queue_update" ON sync_queue FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sync_queue_delete" ON sync_queue;
CREATE POLICY "sync_queue_delete" ON sync_queue FOR DELETE TO authenticated USING (true);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'info',
  related_entity text,
  related_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON financial_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_service_revenues_date ON service_revenues(revenue_date);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_account ON bank_reconciliations(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON daily_closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);
DO $do$ BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)';
EXCEPTION WHEN OTHERS THEN NULL; END $do$;
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- ============================================================
-- TRIGGERS
-- ============================================================
DO $do$ BEGIN
  CREATE TRIGGER financial_accounts_updated_at BEFORE UPDATE ON financial_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

DO $do$ BEGIN
  CREATE TRIGGER bank_reconciliations_updated_at BEFORE UPDATE ON bank_reconciliations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;