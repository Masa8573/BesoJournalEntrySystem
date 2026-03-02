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
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountCategory {
  id: string;
  code: string;      // '1'=資産, '2'=負債, '3'=純資産, '4'=収益, '5'=費用
  name: string;      // '資産', '負債', '純資産', '収益', '費用'
  type: 'bs' | 'pl';
  sort_order: number;
  created_at: string;
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

// DBの account_items テーブルに完全対応した型
export interface AccountItem {
  id: string;
  organization_id: string | null;
  client_id: string | null;
  industry_id: string | null;

  // 科目カテゴリ（外部キー）
  category_id: string;

  code: string;
  name: string;
  name_kana: string | null;
  short_name: string | null;

  // 分類
  sub_category: string | null;   // '流動資産', '固定資産（有形）' など

  // 税務
  tax_category_id: string | null;
  subject_to_depreciation: boolean;

  // 決算書表示
  fs_category: string | null;
  display_order: number;

  // 相手勘定科目
  default_contra_account_id: string | null;

  // 設定
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  allow_department: boolean;
  allow_tag: boolean;

  // freee連携
  freee_account_item_id: string | null;

  description: string | null;
  created_at: string;
  updated_at: string;

  // JOIN結果（select時に取得するリレーション）
  account_category?: AccountCategory;
  tax_category?: TaxCategory;
  industry?: Industry;
}

export interface TaxCategory {
  id: string;
  code: string;
  name: string;
  display_name: string | null;
  type: string;       // '課税' | '非課税' | '不課税' | '免税'
  direction: string;  // '売上' | '仕入' | 'その他'
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  tag_type: 'supplier' | 'item';
  name: string;
  color: string | null;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

// DBテーブル名: processing_rules
export interface Rule {
  id: string;
  organization_id: string | null;
  client_id: string | null;
  industry_id: string | null;

  rule_name: string;
  priority: number;

  scope: 'shared' | 'industry' | 'client';
  rule_type: '支出' | '収入';

  // 条件: { supplier_pattern?, amount_min?, amount_max?, transaction_pattern? }
  conditions: {
    supplier_pattern?: string | null;
    transaction_pattern?: string | null;
    amount_min?: number | null;
    amount_max?: number | null;
  };

  // アクション: { account_item_id?, tax_category_id?, description_template? }
  actions: {
    account_item_id?: string | null;
    tax_category_id?: string | null;
    description_template?: string | null;
  };

  is_active: boolean;
  auto_apply: boolean;
  require_confirmation: boolean;

  match_count: number;
  last_matched_at: string | null;

  created_at: string;
  updated_at: string;

  // JOINリレーション（SELECT時）
  industry?: Industry;
  client?: Client;
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