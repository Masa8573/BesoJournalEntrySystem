import mockData from '@/client/data/mockData.json';
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
} from '@/types';

// 環境変数でモードを切り替え（デフォルトはモック）
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

console.log('🔧 API Mode:', USE_MOCK ? 'MOCK DATA' : 'SUPABASE');

// モック用の遅延を追加（実際のAPIっぽくする）
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// モックAPI実装
// ============================================

const mockApi = {
  clients: {
    getAll: async (): Promise<ApiResponse<Client[]>> => {
      await delay(300);
      return { data: mockData.clients as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<Client>> => {
      await delay(200);
      const client = mockData.clients.find(c => c.id === id);
      if (!client) {
        return { data: null, error: 'Client not found', status: 404 };
      }
      return { data: client as any, error: null, status: 200 };
    },
    create: async (data: Partial<Client>): Promise<ApiResponse<Client>> => {
      await delay(400);
      const newClient = {
        id: String(Date.now()),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Client;
      return { data: newClient, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<Client>): Promise<ApiResponse<Client>> => {
      await delay(300);
      const client = mockData.clients.find(c => c.id === id);
      if (!client) {
        return { data: null, error: 'Client not found', status: 404 };
      }
      const updated = { ...client, ...data, updated_at: new Date().toISOString() } as Client;
      return { data: updated, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  industries: {
    getAll: async (): Promise<ApiResponse<Industry[]>> => {
      await delay(200);
      return { data: mockData.industries as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<Industry>> => {
      await delay(200);
      const industry = mockData.industries.find(i => i.id === id);
      if (!industry) {
        return { data: null, error: 'Industry not found', status: 404 };
      }
      return { data: industry as any, error: null, status: 200 };
    },
    create: async (data: Partial<Industry>): Promise<ApiResponse<Industry>> => {
      await delay(300);
      const newIndustry = {
        id: String(Date.now()),
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Industry;
      return { data: newIndustry, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<Industry>): Promise<ApiResponse<Industry>> => {
      await delay(300);
      return { data: { ...data, id } as Industry, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  accountItems: {
    getAll: async (): Promise<ApiResponse<AccountItem[]>> => {
      await delay(200);
      return { data: mockData.accountItems as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<AccountItem>> => {
      await delay(200);
      const item = mockData.accountItems.find(i => i.id === id);
      if (!item) {
        return { data: null, error: 'Account item not found', status: 404 };
      }
      return { data: item as any, error: null, status: 200 };
    },
    create: async (data: Partial<AccountItem>): Promise<ApiResponse<AccountItem>> => {
      await delay(300);
      return { data: { id: String(Date.now()), ...data } as AccountItem, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<AccountItem>): Promise<ApiResponse<AccountItem>> => {
      await delay(300);
      return { data: { ...data, id } as AccountItem, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  taxCategories: {
    getAll: async (): Promise<ApiResponse<TaxCategory[]>> => {
      await delay(200);
      return { data: mockData.taxCategories as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<TaxCategory>> => {
      await delay(200);
      const item = mockData.taxCategories.find(i => i.id === id);
      return { data: item as any || null, error: item ? null : 'Not found', status: item ? 200 : 404 };
    },
    create: async (data: Partial<TaxCategory>): Promise<ApiResponse<TaxCategory>> => {
      await delay(300);
      return { data: { id: String(Date.now()), ...data } as TaxCategory, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<TaxCategory>): Promise<ApiResponse<TaxCategory>> => {
      await delay(300);
      return { data: { ...data, id } as TaxCategory, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  tags: {
    getAll: async (): Promise<ApiResponse<Tag[]>> => {
      await delay(200);
      return { data: mockData.tags as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<Tag>> => {
      await delay(200);
      const item = mockData.tags.find(i => i.id === id);
      return { data: item as any || null, error: item ? null : 'Not found', status: item ? 200 : 404 };
    },
    create: async (data: Partial<Tag>): Promise<ApiResponse<Tag>> => {
      await delay(300);
      return { data: { id: String(Date.now()), ...data } as Tag, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<Tag>): Promise<ApiResponse<Tag>> => {
      await delay(300);
      return { data: { ...data, id } as Tag, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  rules: {
    getAll: async (): Promise<ApiResponse<Rule[]>> => {
      await delay(200);
      return { data: mockData.rules as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<Rule>> => {
      await delay(200);
      const item = mockData.rules.find(i => i.id === id);
      return { data: item as any || null, error: item ? null : 'Not found', status: item ? 200 : 404 };
    },
    create: async (data: Partial<Rule>): Promise<ApiResponse<Rule>> => {
      await delay(300);
      return { data: { id: String(Date.now()), ...data } as Rule, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<Rule>): Promise<ApiResponse<Rule>> => {
      await delay(300);
      return { data: { ...data, id } as Rule, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  documents: {
    getAll: async (clientId?: string): Promise<ApiResponse<Document[]>> => {
      await delay(200);
      let docs = mockData.documents as any;
      if (clientId) {
        docs = docs.filter((d: any) => d.client_id === clientId);
      }
      return { data: docs, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<Document>> => {
      await delay(200);
      const item = mockData.documents.find(i => i.id === id);
      return { data: item as any || null, error: item ? null : 'Not found', status: item ? 200 : 404 };
    },
    create: async (data: Partial<Document>): Promise<ApiResponse<Document>> => {
      await delay(500);
      return { data: { id: String(Date.now()), ...data } as Document, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<Document>): Promise<ApiResponse<Document>> => {
      await delay(300);
      return { data: { ...data, id } as Document, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  journalEntries: {
    getAll: async (clientId?: string): Promise<ApiResponse<JournalEntry[]>> => {
      await delay(200);
      let entries = mockData.journalEntries as any;
      if (clientId) {
        entries = entries.filter((e: any) => e.client_id === clientId);
      }
      return { data: entries, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<JournalEntry>> => {
      await delay(200);
      const item = mockData.journalEntries.find(i => i.id === id);
      return { data: item as any || null, error: item ? null : 'Not found', status: item ? 200 : 404 };
    },
    create: async (data: Partial<JournalEntry>): Promise<ApiResponse<JournalEntry>> => {
      await delay(400);
      return { data: { id: String(Date.now()), ...data } as JournalEntry, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<JournalEntry>): Promise<ApiResponse<JournalEntry>> => {
      await delay(300);
      return { data: { ...data, id } as JournalEntry, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },

  users: {
    getAll: async (): Promise<ApiResponse<User[]>> => {
      await delay(200);
      return { data: mockData.users as any, error: null, status: 200 };
    },
    getById: async (id: string): Promise<ApiResponse<User>> => {
      await delay(200);
      const item = mockData.users.find(i => i.id === id);
      return { data: item as any || null, error: item ? null : 'Not found', status: item ? 200 : 404 };
    },
    create: async (data: Partial<User>): Promise<ApiResponse<User>> => {
      await delay(300);
      return { data: { id: String(Date.now()), ...data } as User, error: null, status: 201 };
    },
    update: async (id: string, data: Partial<User>): Promise<ApiResponse<User>> => {
      await delay(300);
      return { data: { ...data, id } as User, error: null, status: 200 };
    },
    delete: async (id: string): Promise<ApiResponse<void>> => {
      await delay(200);
      return { data: null, error: null, status: 200 };
    },
  },
};

// ============================================
// エクスポート（条件分岐）
// ============================================

// モックモードの場合はモックAPIを、本番モードの場合は実際のAPIをエクスポート
const getProdApi = async () => {
  const m = await import('./api');
  return {
    clients: m.clientsApi,
    industries: m.industriesApi,
    accountItems: m.accountItemsApi,
    taxCategories: m.taxCategoriesApi,
    tags: m.tagsApi,
    rules: m.rulesApi,
    documents: m.documentsApi,
    journalEntries: m.journalEntriesApi,
    users: m.usersApi,
  };
};

export const api = USE_MOCK ? mockApi : await getProdApi();

// 個別エクスポート
export const clientsApi = api.clients;
export const industriesApi = api.industries;
export const accountItemsApi = api.accountItems;
export const taxCategoriesApi = api.taxCategories;
export const tagsApi = api.tags;
export const rulesApi = api.rules;
export const documentsApi = api.documents;
export const journalEntriesApi = api.journalEntries;
export const usersApi = api.users;