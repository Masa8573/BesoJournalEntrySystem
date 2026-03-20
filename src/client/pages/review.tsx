import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ZoomOut, ZoomIn, RotateCcw, ChevronLeft, ChevronRight,
  ChevronDown, Ban, AlertCircle, Loader, CheckCircle, Save,
  ShieldCheck, List, Eye, Search,
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';
import type { AccountItem, TaxCategory, Supplier } from '@/types';

// ============================================
// SearchableSelect（code + name + short_name 検索）
// ============================================
interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string; code?: string; short_name?: string | null; name_kana?: string | null }>;
  placeholder?: string;
}

function SearchableSelect({ value, onChange, options, placeholder = '-- 選択 --' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter(o => {
      const name = o.name.toLowerCase();
      const shortName = (o.short_name || '').toLowerCase();
      const nameKana = (o.name_kana || '').toLowerCase();
      const code = (o.code || '').toLowerCase();
      return name.includes(q) || shortName.includes(q) || nameKana.includes(q) || code.includes(q) || code.startsWith(q);
    });
  }, [query, options]);

  const handleSelect = (id: string) => { onChange(id); setIsOpen(false); setQuery(''); };

  return (
    <div ref={ref} className="relative">
      <button type="button"
        onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full border border-gray-300 rounded-lg p-2.5 pr-8 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
        {selectedOption ? (
          <span>{selectedOption.code ? `${selectedOption.code} ` : ''}{selectedOption.name}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronDown size={14} className="absolute right-2.5 top-3.5 text-gray-400 pointer-events-none" />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="名前・ローマ字・番号で検索"
                className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={e => {
                  if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].id);
                  else if (e.key === 'Escape') setIsOpen(false);
                }} />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">該当なし</div>
            ) : filtered.map(o => (
              <button key={o.id} type="button" onClick={() => handleSelect(o.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${o.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                {o.code && <span className="text-gray-400 mr-1.5">{o.code}</span>}
                {o.name}
                {o.short_name && <span className="text-gray-400 ml-1.5 text-xs">({o.short_name})</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 型定義
// ============================================
interface EntryRow {
  id: string;
  client_id: string;
  document_id?: string;
  entry_date: string;
  description?: string;
  status: string;
  notes?: string;
  ai_confidence?: number;
  ai_generated?: boolean;
  requires_review?: boolean;
  is_excluded?: boolean;
  lines: LineRow[];
  accountItemName?: string;
  taxCategoryName?: string;
  amount?: number;
}
interface LineRow {
  id: string;
  line_number: number;
  debit_credit: string;
  account_item_id?: string;
  tax_category_id?: string;
  amount?: number;
  description?: string;
  account_item?: { id: string; name: string };
  tax_category?: { id: string; name: string };
}
interface DocumentWithEntry {
  docId: string;
  fileName: string;
  storagePath: string;
  imageUrl: string | null;
  supplierName: string | null;
  documentDate: string | null;
  amount: number | null;
  taxAmount: number | null;
  entryId: string | null;
  entryDate: string;
  description: string;
  status: string;
  isExcluded: boolean;
  isBusiness: boolean;
  aiConfidence: number | null;
  lineId: string | null;
  accountItemId: string;
  taxCategoryId: string;
  lineAmount: number;
  taxRate: number | null;
  supplierId: string | null;
  itemId: string | null;
}
interface TaxRateOption { id: string; rate: number; name: string; }

type ViewMode = 'list' | 'detail';
type TabFilter = 'all' | 'unchecked' | 'excluded';

// ============================================
// メインコンポーネント
// ============================================
export default function ReviewPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'excluded' ? 'excluded' : 'all';

  // 共通 state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState<TabFilter>(initialTab);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [industries, setIndustries] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // 一覧 state
  const [entries, setEntries] = useState<EntryRow[]>([]);

  // 個別チェック state
  const [items, setItems] = useState<DocumentWithEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [form, setForm] = useState<Partial<DocumentWithEntry>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [addRule, setAddRule] = useState(false);
  const [ruleIndustryId, setRuleIndustryId] = useState('');

  // ============================================
  // データ読み込み
  // ============================================
  useEffect(() => { if (currentWorkflow) loadAllData(); }, [currentWorkflow]);

  const loadAllData = async () => {
    if (!currentWorkflow) return;
    setLoading(true);
    const clientId = currentWorkflow.clientId;

    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, original_file_name, storage_path, file_path, supplier_name, document_date, amount, tax_amount')
      .eq('workflow_id', currentWorkflow.id).eq('client_id', clientId).order('created_at');

    if (!docs || docs.length === 0) { setEntries([]); setItems([]); setLoading(false); return; }
    const docIds = docs.map((d: any) => d.id);

    // 一覧用
    const { data: entriesData } = await supabase
      .from('journal_entries')
      .select(`id, client_id, document_id, entry_date, description, status, notes, ai_confidence, ai_generated, requires_review, is_excluded,
        journal_entry_lines ( id, line_number, debit_credit, account_item_id, tax_category_id, amount, description,
          account_item:account_items(id, name), tax_category:tax_categories(id, name) )`)
      .eq('client_id', clientId).in('document_id', docIds)
      .in('status', ['draft', 'approved', 'posted']).order('entry_date', { ascending: true });

    const mappedEntries: EntryRow[] = (entriesData || []).map((entry: any) => {
      const dl = entry.journal_entry_lines?.find((l: any) => l.debit_credit === 'debit') || entry.journal_entry_lines?.[0];
      return { ...entry, lines: entry.journal_entry_lines || [],
        accountItemName: dl?.account_item?.name ?? (Array.isArray(dl?.account_item) ? dl.account_item[0]?.name : undefined),
        taxCategoryName: dl?.tax_category?.name ?? (Array.isArray(dl?.tax_category) ? dl.tax_category[0]?.name : undefined),
        amount: dl?.amount };
    });
    setEntries(mappedEntries);

    // 個別用
    const { data: entriesForDetail } = await supabase
      .from('journal_entries')
      .select(`id, entry_date, description, status, is_excluded, ai_confidence, document_id,
        journal_entry_lines ( id, debit_credit, account_item_id, tax_category_id, amount, tax_rate, description, supplier_id, item_id )`)
      .eq('client_id', clientId).in('document_id', docIds).in('status', ['draft', 'approved', 'posted']);

    const merged: DocumentWithEntry[] = await Promise.all(docs.map(async (doc: any) => {
      const path = doc.storage_path || doc.file_path || '';
      let imageUrl: string | null = null;
      if (path) { const { data: u } = await supabase.storage.from('documents').createSignedUrl(path, 3600); imageUrl = u?.signedUrl || null; }
      const entry = entriesForDetail?.find((e: any) => e.document_id === doc.id);
      const dl = entry?.journal_entry_lines?.find((l: any) => l.debit_credit === 'debit') || entry?.journal_entry_lines?.[0];
      return {
        docId: doc.id, fileName: doc.original_file_name || doc.file_name, storagePath: path, imageUrl,
        supplierName: doc.supplier_name, documentDate: doc.document_date, amount: doc.amount, taxAmount: doc.tax_amount,
        entryId: entry?.id || null, entryDate: entry?.entry_date || doc.document_date || new Date().toISOString().split('T')[0],
        description: entry?.description || doc.supplier_name || '', status: entry?.status || 'draft',
        isExcluded: entry?.is_excluded || false, isBusiness: !entry?.is_excluded,
        aiConfidence: entry?.ai_confidence || null, lineId: dl?.id || null,
        accountItemId: dl?.account_item_id || '', taxCategoryId: dl?.tax_category_id || '',
        lineAmount: dl?.amount || doc.amount || 0, taxRate: dl?.tax_rate || null,
        supplierId: dl?.supplier_id || null, itemId: dl?.item_id || null,
      } as DocumentWithEntry;
    }));
    setItems(merged);
    if (merged.length > 0) setForm({ ...merged[0] });

    // マスタ
    const [aRes, tRes] = await Promise.all([accountItemsApi.getAll(), taxCategoriesApi.getAll()]);
    if (aRes.data) setAccountItems(aRes.data);
    if (tRes.data) setTaxCategories(tRes.data);
    const { data: rates } = await supabase.from('tax_rates').select('id, rate, name').eq('is_current', true).order('rate', { ascending: false });
    if (rates) setTaxRates(rates.map((r: any) => ({ id: r.id, rate: Number(r.rate), name: r.name })));
    const { data: sData } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name');
    if (sData) setSuppliers(sData);
    const { data: inds } = await supabase.from('industries').select('id, name').eq('is_active', true).order('sort_order');
    if (inds) setIndustries(inds);
    setLoading(false);
  };

  // ============================================
  // 勘定科目→税区分自動割当
  // ============================================
  const handleAccountItemChange = (accountItemId: string) => {
    const ai = accountItems.find(a => a.id === accountItemId);
    const updates: Partial<DocumentWithEntry> = { accountItemId };
    if (ai?.tax_category_id) {
      updates.taxCategoryId = ai.tax_category_id;
      const tc = taxCategories.find(t => t.id === ai.tax_category_id);
      if (tc?.current_tax_rate_id) {
        // current_tax_rate_id から税率を直接取得（確実）
        const rate = taxRates.find(r => r.id === tc.current_tax_rate_id);
        if (rate) updates.taxRate = rate.rate;
      } else if (tc) {
        // フォールバック: 税区分名から税率を推定
        const mr = taxRates.find(r => tc.name.includes(`${Math.round(r.rate * 100)}%`));
        if (mr) updates.taxRate = mr.rate;
        else updates.taxRate = null; // 非課税・対象外は税率なし
      }
    }
    setForm(p => ({ ...p, ...updates }));
  };

  // ============================================
  // 取引先→デフォルト勘定科目/税区分
  // ============================================
  const handleSupplierChange = (supplierId: string) => {
    const s = suppliers.find(x => x.id === supplierId);
    const updates: Partial<DocumentWithEntry> = { supplierId: supplierId || null };
    if (s?.default_account_item_id && !form.accountItemId) updates.accountItemId = s.default_account_item_id;
    if (s?.default_tax_category_id && !form.taxCategoryId) updates.taxCategoryId = s.default_tax_category_id;
    setForm(p => ({ ...p, ...updates }));
  };

  // ============================================
  // 一覧→個別チェック遷移
  // ============================================
  const openDetail = (entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    const docItem = items.find(i => i.docId === entry?.document_id || i.entryId === entryId);
    if (docItem) { setCurrentIndex(items.indexOf(docItem)); setForm({ ...docItem }); }
    setSavedAt(null); setAddRule(false); setRuleIndustryId(''); setRotation(0);
    setViewMode('detail');
  };

  const openDetailFromTop = () => {
    if (items.length === 0) return;
    setCurrentIndex(0); setForm({ ...items[0] });
    setSavedAt(null); setAddRule(false); setRuleIndustryId(''); setRotation(0);
    setViewMode('detail');
  };

  // ============================================
  // 個別: 保存 + 次へ（次へ押したら approved に）
  // ============================================
  const saveCurrentItem = async (markApproved = false) => {
    const item = items[currentIndex];
    if (!item) return;
    setSaving(true);
    let entryId = form.entryId;
    const targetStatus = form.isExcluded ? 'draft' : (markApproved ? 'approved' : (item.status === 'posted' ? 'posted' : item.status));

    if (!entryId) {
      const { data: cd } = await supabase.from('clients').select('organization_id').eq('id', currentWorkflow!.clientId).single();
      if (!cd?.organization_id) { setSaving(false); return; }
      const { data: ne, error } = await supabase.from('journal_entries').insert({
        organization_id: cd.organization_id, client_id: currentWorkflow!.clientId, document_id: item.docId,
        entry_date: form.entryDate || new Date().toISOString().split('T')[0], entry_type: 'normal',
        description: form.description || '', status: targetStatus, is_excluded: form.isExcluded || false, ai_generated: false,
      }).select().single();
      if (error || !ne) { console.error('仕訳作成エラー:', error); setSaving(false); return; }
      entryId = ne.id;
      const { data: nl } = await supabase.from('journal_entry_lines').insert({
        journal_entry_id: entryId, line_number: 1, debit_credit: 'debit',
        account_item_id: form.accountItemId || null, tax_category_id: form.taxCategoryId || null,
        tax_rate: form.taxRate || null, amount: form.lineAmount || 0,
        supplier_id: form.supplierId || null, item_id: form.itemId || null,
      }).select().single();
      setForm(p => ({ ...p, entryId, lineId: nl?.id || null }));
    } else {
      await supabase.from('journal_entries').update({
        entry_date: form.entryDate, description: form.description,
        is_excluded: form.isExcluded, status: targetStatus,
      }).eq('id', entryId);
      if (form.lineId) {
        await supabase.from('journal_entry_lines').update({
          account_item_id: form.accountItemId || null, tax_category_id: form.taxCategoryId || null,
          tax_rate: form.taxRate || null, amount: form.lineAmount,
          supplier_id: form.supplierId || null, item_id: form.itemId || null,
        }).eq('id', form.lineId);
      }
    }
    // ルール追加
    if (addRule && form.accountItemId) {
      await supabase.from('processing_rules').insert([{
        rule_name: `${form.description || item.supplierName || '不明'} → 自動仕訳`, priority: 100,
        rule_type: '支出', scope: ruleIndustryId ? 'industry' : 'shared', industry_id: ruleIndustryId || null,
        conditions: { supplier_pattern: item.supplierName || null },
        actions: { account_item_id: form.accountItemId, tax_category_id: form.taxCategoryId || null, description_template: form.description || null },
        auto_apply: true, require_confirmation: false, is_active: true,
      }]);
    }
    setItems(prev => prev.map((it, i) => i === currentIndex ? { ...it, ...form, entryId, status: targetStatus } as DocumentWithEntry : it));
    setSaving(false); setSavedAt(new Date().toLocaleTimeString('ja-JP'));
  };

  // 次へ（保存+approved+次の証憑に移動）
  const goNext = async () => {
    await saveCurrentItem(true);
    if (currentIndex < items.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next); setForm({ ...items[next] }); setSavedAt(null); setAddRule(false); setRuleIndustryId(''); setRotation(0);
    }
  };
  const goPrev = async () => {
    await saveCurrentItem(false);
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      setCurrentIndex(prev); setForm({ ...items[prev] }); setSavedAt(null); setAddRule(false); setRuleIndustryId(''); setRotation(0);
    }
  };

  // 事業用/プライベート/対象外
  const setBusiness = (isBusiness: boolean) => {
    if (!isBusiness) {
      const jk = accountItems.find(a => a.name === '事業主貸');
      setForm(p => ({ ...p, isBusiness: false, isExcluded: false, accountItemId: jk?.id || p.accountItemId }));
    } else setForm(p => ({ ...p, isBusiness: true, isExcluded: false }));
  };
  const toggleExclude = () => setForm(p => ({ ...p, isExcluded: !p.isExcluded, isBusiness: p.isExcluded }));

  const groupedTaxCategories = useMemo(() => {
    const g: Record<string, TaxCategory[]> = {};
    taxCategories.forEach(tc => { const k = tc.direction || 'その他'; if (!g[k]) g[k] = []; g[k].push(tc); });
    return g;
  }, [taxCategories]);

  // ワークフロー次へ（仕訳出力に進む前に全件確定）
  const handleBeforeNext = async (): Promise<boolean> => {
    if (viewMode === 'detail') await saveCurrentItem(true);
    const drafts = entries.filter(e => e.status === 'draft');
    if (drafts.length > 0) {
      const ok = window.confirm(`未確認の仕訳が${drafts.length}件あります。\n\n仕訳を確定して出力に進みますか？`);
      if (!ok) return false;
      await supabase.from('journal_entries').update({ status: 'approved' }).in('id', drafts.map(e => e.id));
    }
    // 全件をpostedに
    const allIds = entries.map(e => e.id);
    if (allIds.length > 0) {
      await supabase.from('journal_entries').update({ status: 'posted' }).in('id', allIds);
    }
    updateWorkflowData({ reviewCompleted: true });
    return true;
  };

  const fmt = (n: number | undefined) => n == null ? '-' : `¥${Number(n).toLocaleString()}`;

  // ============================================
  // タブフィルター
  // ============================================
  const filteredEntries = useMemo(() => {
    if (activeTab === 'unchecked') return entries.filter(e => e.status === 'draft');
    if (activeTab === 'excluded') return entries.filter(e => e.is_excluded);
    return entries;
  }, [entries, activeTab]);

  const allCount = entries.length;
  const uncheckedCount = entries.filter(e => e.status === 'draft').length;
  const approvedCount = entries.filter(e => e.status === 'approved' || e.status === 'posted').length;
  const excludedCount = entries.filter(e => e.is_excluded).length;
  const reviewCount = entries.filter(e => e.requires_review || (e.ai_confidence != null && e.ai_confidence < 0.7)).length;

  // ============================================
  // ガード
  // ============================================
  if (!currentWorkflow) return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center max-w-md">
        <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
        <p className="text-gray-600 mb-6">顧客一覧からワークフローを開始してください。</p>
        <a href="/clients" className="btn-primary">顧客一覧へ戻る</a>
      </div>
    </div>
  );
  if (loading) return (
    <div className="flex flex-col h-screen">
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />
      <div className="flex-1 flex items-center justify-center">
        <Loader size={32} className="animate-spin text-blue-500" /><span className="ml-3 text-gray-500">読み込み中...</span>
      </div>
    </div>
  );

  // ============================================
  // レンダリング
  // ============================================
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />

      {/* タブ */}
      <div className="bg-white px-6 border-b border-gray-200 flex gap-0 flex-shrink-0">
        {([
          { key: 'all' as TabFilter, label: 'すべて', count: allCount },
          { key: 'unchecked' as TabFilter, label: '未確認', count: uncheckedCount },
          { key: 'excluded' as TabFilter, label: '対象外', count: excludedCount },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? 'text-blue-600 border-blue-600 font-semibold' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* サマリーカード */}
          {viewMode === 'list' && (
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: '全件', count: allCount, color: 'text-gray-900', bg: 'bg-white' },
                { label: '確認済み', count: approvedCount, color: 'text-green-600', bg: 'bg-green-50' },
                { label: '未確認', count: uncheckedCount, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: '要確認', count: reviewCount, color: 'text-orange-600', bg: 'bg-orange-50' },
              ]).map(c => (
                <div key={c.label} className={`${c.bg} rounded-lg border border-gray-200 p-4`}>
                  <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                  <div className={`text-3xl font-bold ${c.color}`}>{c.count}</div>
                </div>
              ))}
            </div>
          )}

          {/* テーブル */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">仕訳一覧</h2>
              {viewMode === 'list' ? (
                <button onClick={openDetailFromTop}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ background: '#dc4a3a' }}>
                  <Eye size={16} /> 個別チェックに切り替え
                </button>
              ) : (
                <button onClick={() => { saveCurrentItem(false); setViewMode('list'); loadAllData(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 bg-white hover:bg-gray-50">
                  <List size={16} /> 一覧に戻る
                </button>
              )}
            </div>

            <div className={viewMode === 'detail' ? 'max-h-[240px] overflow-y-auto' : ''}>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">取引日</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">摘要</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">勘定科目</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">税区分</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">金額</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEntries.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">データがありません</td></tr>
                  ) : filteredEntries.map(entry => {
                    const needsReview = entry.requires_review || (entry.ai_confidence != null && entry.ai_confidence < 0.7);
                    const isSelected = viewMode === 'detail' && items[currentIndex]?.entryId === entry.id;
                    return (
                      <tr key={entry.id} onClick={() => openDetail(entry.id)}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${needsReview ? 'bg-yellow-50' : ''} ${isSelected ? 'bg-blue-50' : ''} ${entry.status === 'approved' ? 'bg-green-50/30' : ''}`}>
                        <td className="px-4 py-3 text-sm">{new Date(entry.entry_date).toLocaleDateString('ja-JP')}</td>
                        <td className="px-4 py-3 text-sm max-w-[200px] truncate">{entry.description || '-'}</td>
                        <td className="px-4 py-3 text-sm">{entry.accountItemName || '-'}</td>
                        <td className="px-4 py-3 text-sm">{entry.taxCategoryName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{fmt(entry.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          {entry.is_excluded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><Ban size={10} />対象外</span>
                          ) : entry.status === 'approved' || entry.status === 'posted' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={10} />確認済</span>
                          ) : needsReview ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle size={10} />要確認</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">未確認</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== 個別チェック詳細 ===== */}
          {viewMode === 'detail' && items.length > 0 && (() => {
            const ci = items[currentIndex];
            return (
              <div className="grid grid-cols-2 gap-4" style={{ animation: 'fadeSlideUp .3s ease' }}>
                {/* 左: 証憑画像 */}
                <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ minHeight: 480 }}>
                  <div className="p-3 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <div>
                      <div className="font-semibold text-sm">証憑画像</div>
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">{ci.fileName}</div>
                    </div>
                    <div className="flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5">
                      <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={14} /></button>
                      <span className="text-xs px-1.5 text-gray-500">{zoom}%</span>
                      <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={14} /></button>
                      <div className="w-px h-3.5 bg-gray-200 mx-0.5" />
                      <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="90度回転"><RotateCcw size={14} /></button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-4">
                    {ci.imageUrl ? (
                      ci.fileName?.toLowerCase().endsWith('.pdf') ? (
                        <iframe src={ci.imageUrl} className="w-full h-full border-0" title={ci.fileName} />
                      ) : (
                        <img src={ci.imageUrl} alt={ci.fileName}
                          style={{ width: `${zoom}%`, maxWidth: 'none', transform: `rotate(${rotation}deg)`, transition: 'transform .3s' }}
                          className="rounded shadow-sm border border-gray-200 object-contain" />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><AlertCircle size={40} /><span className="text-sm">読み込めませんでした</span></div>
                    )}
                  </div>
                </div>

                {/* 右: 仕訳データ（HTMLモック準拠）*/}
                <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ minHeight: 480 }}>
                  <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap flex-shrink-0">
                    <span className="font-bold text-sm">仕訳データ</span>
                    {ci.supplierName && <span className="text-xs px-2.5 py-0.5 rounded bg-blue-50 text-blue-600">OCR: {ci.supplierName}</span>}
                    {ci.aiConfidence != null && (
                      <span className={`text-xs px-2.5 py-0.5 rounded font-semibold ml-auto ${ci.aiConfidence >= 0.8 ? 'bg-green-50 text-green-700' : ci.aiConfidence >= 0.5 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                        AI信頼度 {Math.round(ci.aiConfidence * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-y-auto">
                    {/* OCR読取 */}
                    {(ci.supplierName || ci.amount || ci.documentDate) && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1.5">OCR読取結果（参考）</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {ci.supplierName && <div><span className="text-gray-400">取引先:</span> <span className="font-medium">{ci.supplierName}</span></div>}
                          {ci.amount != null && <div><span className="text-gray-400">金額:</span> <span className="font-medium">{fmt(ci.amount)}</span></div>}
                          {ci.documentDate && <div><span className="text-gray-400">日付:</span> <span className="font-medium">{new Date(ci.documentDate).toLocaleDateString('ja-JP')}</span></div>}
                          {ci.taxAmount != null && <div><span className="text-gray-400">税額:</span> <span className="font-medium">{fmt(ci.taxAmount)}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* 対象外バナー */}
                    {form.isExcluded && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2"><Ban size={16} />対象外に設定されています</div>
                    )}

                    {/* 取引先（赤ハイライト）*/}
                    <div className="bg-red-50 border-[1.5px] border-red-200 rounded-lg p-3">
                      <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />取引先</label>
                      <SearchableSelect value={form.supplierId || ''} onChange={handleSupplierChange}
                        options={suppliers.map(s => ({ id: s.id, name: s.name, code: s.code || undefined, short_name: s.name_kana }))}
                        placeholder="取引先を検索" />
                    </div>

                    {/* 取引日（青）/ 金額（緑）*/}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 border-[1.5px] border-blue-200 rounded-lg p-3">
                        <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />取引日</label>
                        <input type="date" value={form.entryDate || ''} onChange={e => setForm(p => ({ ...p, entryDate: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="bg-green-50 border-[1.5px] border-green-200 rounded-lg p-3">
                        <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />金額（円）</label>
                        <input type="number" value={form.lineAmount || ''} onChange={e => setForm(p => ({ ...p, lineAmount: Number(e.target.value) }))}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    {/* 勘定科目 / 税区分 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold mb-1.5 flex items-center gap-1">勘定科目 <span className="text-[10px] text-gray-400 font-normal">ローマ字・番号可</span></label>
                        <SearchableSelect value={form.accountItemId || ''} onChange={handleAccountItemChange}
                          options={accountItems.map(a => ({ id: a.id, name: a.name, code: a.code, short_name: a.short_name, name_kana: a.name_kana }))}
                          placeholder="勘定科目を検索" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block">税区分</label>
                        <div className="relative">
                          <select value={form.taxCategoryId || ''} onChange={e => {
                            const tc = taxCategories.find(t => t.id === e.target.value);
                            let newRate = form.taxRate;
                            if (tc?.current_tax_rate_id) {
                              const rate = taxRates.find(r => r.id === tc.current_tax_rate_id);
                              newRate = rate?.rate ?? null;
                            } else {
                              newRate = null; // 非課税・対象外
                            }
                            setForm(p => ({ ...p, taxCategoryId: e.target.value, taxRate: newRate }));
                          }}
                            className="w-full border border-gray-300 rounded-lg p-2.5 pr-8 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- 選択 --</option>
                            {Object.entries(groupedTaxCategories).map(([g, cats]) => (
                              <optgroup key={g} label={g === '仕入' ? '課対仕入' : g === '売上' ? '課税売上' : g}>
                                {cats.map(t => <option key={t.id} value={t.id}>{t.display_name || t.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2.5 top-3.5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* 税率（黄ハイライト）*/}
                    <div className="w-1/2 pr-1.5">
                      <div className="bg-yellow-50 border-[1.5px] border-yellow-200 rounded-lg p-3">
                        <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />税率</label>
                        <select value={form.taxRate?.toString() || ''} onChange={e => setForm(p => ({ ...p, taxRate: e.target.value ? Number(e.target.value) : null }))}
                          className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ minWidth: 100 }}>
                          <option value="">--</option>
                          {taxRates.map(r => <option key={r.id} value={r.rate}>{r.name.replace('標準税率', '').replace('旧税率', '').replace('軽減税率', '').trim() || `${Math.round(r.rate * 100)}%`}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* 品目 */}
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">品目</label>
                      <input type="text" placeholder="品目を入力" value="" onChange={() => {}}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* 摘要 */}
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">摘要</label>
                      <input type="text" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="摘要を入力" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* 事業用/プライベート + ルール追加 */}
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                          <button onClick={() => setBusiness(true)}
                            className={`px-4 py-1.5 text-xs font-medium transition-colors ${form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>事業用</button>
                          <button onClick={() => setBusiness(false)}
                            className={`px-4 py-1.5 text-xs font-medium transition-colors ${!form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>プライベート</button>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded bg-gray-50 font-mono text-gray-500">P</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={addRule} onChange={e => setAddRule(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="text-xs font-medium">ルール追加</span>
                        </label>
                        <span className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded bg-gray-50 font-mono text-gray-500">R</span>
                        {addRule && (
                          <select value={ruleIndustryId} onChange={e => setRuleIndustryId(e.target.value)}
                            className="border border-gray-300 rounded-md p-1.5 text-xs bg-white">
                            <option value="">共通ルール</option>
                            {industries.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* ナビゲーション */}
                    <div className="flex gap-3 pt-3 border-t border-gray-200">
                      <button onClick={goPrev} disabled={currentIndex === 0}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft size={16} /> 前へ
                      </button>
                      <button onClick={goNext} disabled={currentIndex >= items.length - 1}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                        次へ <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* 対象外 */}
                    <button onClick={toggleExclude}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.isExcluded ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-500 bg-white hover:bg-gray-50'
                      }`}>
                      <Ban size={14} />{form.isExcluded ? '対象外を解除' : '対象外にする'}
                      <span className="text-[10px] px-1.5 py-0.5 border border-gray-300 rounded bg-white font-mono text-gray-400 ml-1">E</span>
                    </button>

                    {/* 保存状態 */}
                    <div className="flex items-center justify-between">
                      {ci.entryId && <span className="text-[10px] text-gray-400">仕訳ID: {ci.entryId.slice(0, 8)}...</span>}
                      <div className="flex items-center gap-2 ml-auto">
                        {saving && <Loader size={12} className="animate-spin text-blue-500" />}
                        {savedAt && <span className="text-xs text-green-600">✓ {savedAt} 保存済み</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}