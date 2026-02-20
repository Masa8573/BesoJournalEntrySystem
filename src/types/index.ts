// ============================================
// データベース型定義
// ============================================

export interface Organization {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'accountant' | 'staff';
  status: 'active' | 'inactive';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Industry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  client_count: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  industry_id: string | null;
  annual_sales: number | null;
  tax_category: '原則課税' | '簡易課税' | '免税';
  invoice_registered: boolean;
  use_custom_rules: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: string;
  tax_category: string | null;
  is_default: boolean;
  industry_id: string | null;
  short_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxCategory {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  applicable_to_income: boolean;
  applicable_to_expense: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  type: 'supplier' | 'item';
  name: string;
  color: string | null;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Rule {
  id: string;
  priority: number;
  rule_type: '支出' | '収入';
  industry_id: string | null;
  client_id: string | null;
  supplier_pattern: string | null;
  transaction_pattern: string | null;
  amount_min: number | null;
  amount_max: number | null;
  account_item_id: string | null;
  tax_category_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  client_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  upload_date: string;
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed';
  ocr_completed_at: string | null;
  is_excluded: boolean;
  exclusion_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OCRResult {
  id: string;
  document_id: string;
  raw_text: string | null;
  extracted_date: string | null;
  extracted_supplier: string | null;
  extracted_amount: number | null;
  extracted_tax_amount: number | null;
  extracted_items: any | null;
  confidence_score: number | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  document_id: string | null;
  client_id: string;
  entry_date: string;
  category: '事業用' | 'プライベート';
  supplier: string | null;
  account_item_id: string | null;
  tax_category_id: string | null;
  amount: number;
  tax_amount: number | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'exported';
  reviewed_by: string | null;
  reviewed_at: string | null;
  exported_to_freee: boolean;
  freee_transaction_id: string | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchHistory {
  id: string;
  upload_date: string;
  uploaded_by: string | null;
  total_documents: number;
  completed_entries: number;
  excluded_entries: number;
  pending_entries: number;
  status: 'in_progress' | 'completed';
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// API レスポンス型
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================
// UI用の拡張型
// ============================================

export interface ClientWithIndustry extends Client {
  industry?: Industry;
}

export interface JournalEntryWithRelations extends JournalEntry {
  account_item?: AccountItem;
  tax_category?: TaxCategory;
  client?: Client;
  document?: Document;
}

export interface RuleWithRelations extends Rule {
  account_item?: AccountItem;
  tax_category?: TaxCategory;
  industry?: Industry;
  client?: Client;
}

// ============================================
// フォーム型
// ============================================

export interface ClientFormData {
  name: string;
  industry_id: string;
  annual_sales: number | null;
  tax_category: '原則課税' | '簡易課税' | '免税';
  invoice_registered: boolean;
  use_custom_rules: boolean;
}

export interface RuleFormData {
  priority: number;
  rule_type: '支出' | '収入';
  industry_id: string | null;
  client_id: string | null;
  supplier_pattern: string | null;
  transaction_pattern: string | null;
  amount_min: number | null;
  amount_max: number | null;
  account_item_id: string;
  tax_category_id: string;
}

export interface JournalEntryFormData {
  entry_date: string;
  category: '事業用' | 'プライベート';
  supplier: string;
  account_item_id: string;
  tax_category_id: string;
  amount: number;
  tax_amount: number | null;
  notes: string | null;
}

// ============================================
// アップロード関連
// ============================================

export interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
}