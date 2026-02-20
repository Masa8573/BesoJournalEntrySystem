import { supabase } from './supabase';
import type {
  Client,
  Industry,
  AccountItem,
  TaxCategory,
  Tag,
  Rule,
  Document,
  JournalEntry,
  User,
  ApiResponse,
  //PaginatedResponse,
} from '@/types';

// ============================================
// 汎用APIヘルパー
// ============================================

async function handleResponse<T>(promise: any): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await promise;
    if (error) {
      return { data: null, error: error.message, status: 400 };
    }
    return { data, error: null, status: 200 };
  } catch (error: any) {
    return { data: null, error: error.message, status: 500 };
  }
}

// ============================================
// 顧客API
// ============================================

export const clientsApi = {
  getAll: () => handleResponse<Client[]>(
    supabase.from('clients').select('*, industry:industries(*)').order('created_at', { ascending: false })
  ),

  getById: (id: string) => handleResponse<Client>(
    supabase.from('clients').select('*, industry:industries(*)').eq('id', id).single()
  ),

  create: (data: Partial<Client>) => handleResponse<Client>(
    supabase.from('clients').insert(data).select().single()
  ),

  update: (id: string, data: Partial<Client>) => handleResponse<Client>(
    supabase.from('clients').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('clients').delete().eq('id', id)
  ),
};

// ============================================
// 業種API
// ============================================

export const industriesApi = {
  getAll: () => handleResponse<Industry[]>(
    supabase.from('industries').select('*').order('created_at', { ascending: false })
  ),

  getById: (id: string) => handleResponse<Industry>(
    supabase.from('industries').select('*').eq('id', id).single()
  ),

  create: (data: Partial<Industry>) => handleResponse<Industry>(
    supabase.from('industries').insert(data).select().single()
  ),

  update: (id: string, data: Partial<Industry>) => handleResponse<Industry>(
    supabase.from('industries').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('industries').delete().eq('id', id)
  ),
};

// ============================================
// 勘定科目API
// ============================================

export const accountItemsApi = {
  getAll: () => handleResponse<AccountItem[]>(
    supabase.from('account_items').select('*').order('code', { ascending: true })
  ),

  getById: (id: string) => handleResponse<AccountItem>(
    supabase.from('account_items').select('*').eq('id', id).single()
  ),

  create: (data: Partial<AccountItem>) => handleResponse<AccountItem>(
    supabase.from('account_items').insert(data).select().single()
  ),

  update: (id: string, data: Partial<AccountItem>) => handleResponse<AccountItem>(
    supabase.from('account_items').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('account_items').delete().eq('id', id)
  ),
};

// ============================================
// 税区分API
// ============================================

export const taxCategoriesApi = {
  getAll: () => handleResponse<TaxCategory[]>(
    supabase.from('tax_categories').select('*').order('created_at', { ascending: false })
  ),

  getById: (id: string) => handleResponse<TaxCategory>(
    supabase.from('tax_categories').select('*').eq('id', id).single()
  ),

  create: (data: Partial<TaxCategory>) => handleResponse<TaxCategory>(
    supabase.from('tax_categories').insert(data).select().single()
  ),

  update: (id: string, data: Partial<TaxCategory>) => handleResponse<TaxCategory>(
    supabase.from('tax_categories').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('tax_categories').delete().eq('id', id)
  ),
};

// ============================================
// タグAPI
// ============================================

export const tagsApi = {
  getAll: () => handleResponse<Tag[]>(
    supabase.from('tags').select('*').order('created_at', { ascending: false })
  ),

  getById: (id: string) => handleResponse<Tag>(
    supabase.from('tags').select('*').eq('id', id).single()
  ),

  create: (data: Partial<Tag>) => handleResponse<Tag>(
    supabase.from('tags').insert(data).select().single()
  ),

  update: (id: string, data: Partial<Tag>) => handleResponse<Tag>(
    supabase.from('tags').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('tags').delete().eq('id', id)
  ),
};

// ============================================
// ルールAPI
// ============================================

export const rulesApi = {
  getAll: () => handleResponse<Rule[]>(
    supabase.from('rules').select('*, account_item:account_items(*), tax_category:tax_categories(*), industry:industries(*), client:clients(*)').order('priority', { ascending: true })
  ),

  getById: (id: string) => handleResponse<Rule>(
    supabase.from('rules').select('*, account_item:account_items(*), tax_category:tax_categories(*), industry:industries(*), client:clients(*)').eq('id', id).single()
  ),

  create: (data: Partial<Rule>) => handleResponse<Rule>(
    supabase.from('rules').insert(data).select().single()
  ),

  update: (id: string, data: Partial<Rule>) => handleResponse<Rule>(
    supabase.from('rules').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('rules').delete().eq('id', id)
  ),
};

// ============================================
// 証憑API
// ============================================

export const documentsApi = {
  getAll: (clientId?: string) => {
    let query = supabase.from('documents').select('*').order('upload_date', { ascending: false });
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    return handleResponse<Document[]>(query);
  },

  getById: (id: string) => handleResponse<Document>(
    supabase.from('documents').select('*').eq('id', id).single()
  ),

  create: (data: Partial<Document>) => handleResponse<Document>(
    supabase.from('documents').insert(data).select().single()
  ),

  update: (id: string, data: Partial<Document>) => handleResponse<Document>(
    supabase.from('documents').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('documents').delete().eq('id', id)
  ),
};

// ============================================
// 仕訳API
// ============================================

export const journalEntriesApi = {
  getAll: (clientId?: string) => {
    let query = supabase.from('journal_entries').select('*, account_item:account_items(*), tax_category:tax_categories(*), client:clients(*)').order('entry_date', { ascending: false });
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    return handleResponse<JournalEntry[]>(query);
  },

  getById: (id: string) => handleResponse<JournalEntry>(
    supabase.from('journal_entries').select('*, account_item:account_items(*), tax_category:tax_categories(*), client:clients(*)').eq('id', id).single()
  ),

  create: (data: Partial<JournalEntry>) => handleResponse<JournalEntry>(
    supabase.from('journal_entries').insert(data).select().single()
  ),

  update: (id: string, data: Partial<JournalEntry>) => handleResponse<JournalEntry>(
    supabase.from('journal_entries').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('journal_entries').delete().eq('id', id)
  ),
};

// ============================================
// ユーザーAPI
// ============================================

export const usersApi = {
  getAll: () => handleResponse<User[]>(
    supabase.from('users').select('*').order('created_at', { ascending: false })
  ),

  getById: (id: string) => handleResponse<User>(
    supabase.from('users').select('*').eq('id', id).single()
  ),

  create: (data: Partial<User>) => handleResponse<User>(
    supabase.from('users').insert(data).select().single()
  ),

  update: (id: string, data: Partial<User>) => handleResponse<User>(
    supabase.from('users').update(data).eq('id', id).select().single()
  ),

  delete: (id: string) => handleResponse<void>(
    supabase.from('users').delete().eq('id', id)
  ),
};