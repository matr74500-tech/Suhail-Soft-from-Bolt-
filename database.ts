export type PaymentMethod = 'cash' | 'wallet' | 'bank_account' | 'bank_transfer' | 'local_transfer' | 'credit' | 'split';
export type DocumentStatus = 'draft' | 'pending' | 'approved' | 'cancelled' | 'completed' | 'rejected';
export type StockMovementType = 'purchase' | 'sale' | 'sale_return' | 'purchase_return' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'opening' | 'initial';
export type InvoiceType = 'sales' | 'purchase' | 'quotation' | 'sales_order' | 'purchase_request' | 'purchase_order';
export type AlertState = 'normal' | 'near_reorder' | 'reorder_required' | 'low' | 'out_of_stock';
export type CustomerStatus = 'active' | 'inactive' | 'late';

export interface Branch {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  branch_id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface Role {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  description: string | null;
  is_system: boolean;
}

export interface Permission {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  module: string;
}

export interface UserProfile {
  id: string;
  auth_user_id: string;
  username: string;
  full_name_ar: string;
  full_name_en: string | null;
  phone: string | null;
  email: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  roles?: Role[];
  permissions?: string[];
}

export interface Currency {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  symbol: string | null;
  is_active: boolean;
}

export interface ExchangeRate {
  id: string;
  from_currency_id: string;
  to_currency_id: string;
  rate: number;
  effective_date: string;
}

export interface BusinessSettings {
  business_name: string;
  default_currency: string;
  tax_enabled: boolean;
  inactivity_period_days: number;
  camera_scan_enabled: boolean;
  product_search_enabled: boolean;
  manual_quantity_enabled: boolean;
  manual_product_selection_enabled: boolean;
  dark_mode: boolean;
  invoice_show_user: boolean;
  paper_size: string;
  logo_url: string | null;
  business_address: string;
  business_phone: string;
  business_email: string;
  reorder_alerts_enabled: boolean;
  barcode_printer_type: string;
  barcode_label_size: string;
  barcode_format: string;
  barcode_show_price: boolean;
  barcode_show_name: boolean;
  invoice_printer_type: string;
  invoice_auto_print: boolean;
  invoice_font_size: string;
  invoice_show_logo: boolean;
  invoice_show_footer: boolean;
  scanner_connection: string;
  scanner_input_mode: string;
  scanner_prefix: string;
  scanner_suffix: string;
  scanner_auto_enter: boolean;
  scanner_buffer_delay: number;
}

export interface ProductCategory {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  parent_id: string | null;
  is_active: boolean;
}

export interface ProductUnit {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  category_id: string | null;
  base_unit_id: string | null;
  selling_unit_id: string | null;
  conversion_factor: number;
  purchase_price: number;
  retail_price: number;
  wholesale_price: number;
  currency_id: string | null;
  min_stock: number;
  reorder_point: number;
  shelf_number: string | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
  requires_serial: boolean;
  created_at: string;
  updated_at: string;
  category?: ProductCategory;
  base_unit?: ProductUnit;
  selling_unit?: ProductUnit;
  barcodes?: ProductBarcode[];
  suppliers?: ProductSupplier[];
  images?: ProductImage[];
}

export interface ProductBarcode {
  id: string;
  product_id: string;
  barcode: string;
  unit_id: string | null;
  conversion_factor: number;
  is_primary: boolean;
  is_active: boolean;
  barcode_type: string;
  unit?: ProductUnit;
}

export interface ProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_product_code: string | null;
  last_purchase_price: number | null;
  last_purchase_date: string | null;
  is_preferred: boolean;
  is_alternative: boolean;
  notes: string | null;
  supplier?: Supplier;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
}

export interface ProductSerial {
  id: string;
  serial_number: string;
  product_id: string;
  warehouse_id: string | null;
  supplier_id: string | null;
  purchase_invoice_id: string | null;
  sales_invoice_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface StockLevel {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  reserved_quantity: number;
  product?: Product;
  warehouse?: Warehouse;
}

export interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  user_id: string | null;
  user_name: string | null;
  branch_id: string | null;
  notes: string | null;
  created_at: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface Supplier {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contact_person: string | null;
  opening_balance: number;
  current_balance: number;
  currency_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierNote {
  id: string;
  supplier_id: string;
  note_type: string;
  content: string;
  follow_up_date: string | null;
  is_resolved: boolean;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  current_balance: number;
  currency_id: string | null;
  status: CustomerStatus;
  last_order_date: string | null;
  usual_cycle_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerFollowUp {
  id: string;
  customer_id: string;
  communication_type: string;
  content: string | null;
  result: string | null;
  next_follow_up_date: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  default_price: number;
  currency_id: string | null;
  category: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Document {
  id: string;
  document_number: string;
  doc_type: InvoiceType;
  status: DocumentStatus;
  document_date: string;
  due_date: string | null;
  party_type: string;
  customer_id: string | null;
  supplier_id: string | null;
  warehouse_id: string | null;
  branch_id: string | null;
  subtotal: number;
  discount_amount: number;
  discount_percentage: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  total_cost: number;
  gross_profit: number;
  currency_id: string | null;
  exchange_rate: number;
  payment_method: PaymentMethod | null;
  source_document_id: string | null;
  source_document_number: string | null;
  notes: string | null;
  is_closed_day: boolean;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  supplier?: Supplier;
  warehouse?: Warehouse;
  branch?: Branch;
  items?: DocumentItem[];
  payments?: DocumentPayment[];
}

export interface DocumentItem {
  id: string;
  document_id: string;
  product_id: string | null;
  service_id: string | null;
  item_type: string;
  description: string | null;
  unit_id: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount_amount: number;
  line_total: number;
  line_cost: number;
  serial_number: string | null;
  barcode_used: string | null;
  product?: Product;
  service?: Service;
  unit?: ProductUnit;
}

export interface DocumentPayment {
  id: string;
  document_id: string;
  payment_method: PaymentMethod;
  amount: number;
  financial_account_id: string | null;
  reference_number: string | null;
  transaction_id: string | null;
  currency_id: string | null;
  exchange_rate: number;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface Transfer {
  id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  branch_id: string | null;
  status: DocumentStatus;
  transfer_date: string;
  notes: string | null;
  user_id: string | null;
  user_name: string | null;
  from_warehouse?: Warehouse;
  to_warehouse?: Warehouse;
  items?: TransferItem[];
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  unit_id: string | null;
  product?: Product;
}

export interface FinancialAccount {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  account_type: string;
  bank_name: string | null;
  bank_account_number: string | null;
  wallet_provider: string | null;
  wallet_number: string | null;
  opening_balance: number;
  current_balance: number;
  currency_id: string | null;
  branch_id: string | null;
  is_active: boolean;
}

export interface Expense {
  id: string;
  expense_type: string;
  amount: number;
  currency_id: string | null;
  exchange_rate: number;
  expense_date: string;
  beneficiary: string | null;
  reason: string | null;
  notes: string | null;
  branch_id: string | null;
  financial_account_id: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface ServiceRevenue {
  id: string;
  service_id: string | null;
  service_name: string;
  amount: number;
  currency_id: string | null;
  exchange_rate: number;
  revenue_date: string;
  customer_id: string | null;
  payment_method: PaymentMethod;
  financial_account_id: string | null;
  notes: string | null;
  user_id: string | null;
  user_name: string | null;
  branch_id: string | null;
  created_at: string;
  customer?: Customer;
  financial_account?: FinancialAccount;
}

export interface DailyClosing {
  id: string;
  closing_date: string;
  branch_id: string | null;
  total_sales: number;
  total_purchases: number;
  total_cash: number;
  total_wallets: number;
  total_banks: number;
  total_local_transfers: number;
  total_expenses: number;
  total_other_revenues: number;
  total_receipts: number;
  total_payments: number;
  total_returns: number;
  total_profit: number;
  total_cogs: number;
  differences: number;
  status: string;
  notes: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface BankReconciliation {
  id: string;
  financial_account_id: string;
  reconciliation_date: string;
  opening_balance: number;
  closing_balance: number;
  bank_closing_balance: number;
  difference: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
  financial_account?: FinancialAccount;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  operation: string;
  table_name: string | null;
  document_type: string | null;
  document_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  branch_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  related_entity: string | null;
  related_id: string | null;
  is_read: boolean;
  user_id: string | null;
  branch_id: string | null;
  created_at: string;
}

export interface PriceList {
  id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  customer_id: string | null;
  is_active: boolean;
  customer?: Customer;
  items?: PriceListItem[];
}

export interface PriceListItem {
  id: string;
  price_list_id: string;
  product_id: string;
  unit_id: string | null;
  price: number;
  product?: Product;
}
