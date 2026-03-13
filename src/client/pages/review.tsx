import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ZoomOut, ZoomIn, RotateCcw, ChevronLeft, ChevronRight,
  ChevronDown, Ban, AlertCircle, Loader, CheckCircle, Save, Search, X,
  HelpCircle, Lightbulb, History
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';
import type { AccountItem, TaxCategory, Tag } from '@/types';

// ============================================
// SearchableSelect（インライン）
// ============================================
interface SearchableSelectOption { value: string; label: string; group?: string; }

function SearchableSelect({ options, value, onChange, placeholder = '-- 選択 --', disabled = false, grouped = false }: {
  options: SearchableSelectOption[]; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; grouped?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label || '';
  const filtered = useMemo(() => { if (!search.trim()) return options; const q = search.toLowerCase(); return options.filter(o => o.label.toLowerCase().includes(q) || (o.group?.toLowerCase().includes(q))); }, [options, search]);
  const groups = useMemo(() => { if (!grouped) return null; const g: Record<string, SearchableSelectOption[]> = {}; filtered.forEach(o => { const k = o.group || 'その他'; if (!g[k]) g[k] = []; g[k].push(o); }); return g; }, [filtered, grouped]);
  useEffect(() => { const h = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setIsOpen(false); setSearch(''); } }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);
  const select = (v: string) => { onChange(v); setIsOpen(false); setSearch(''); };
  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled}
        className={`w-full border rounded-md p-2 pr-14 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${disabled ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-gray-400'}`}>
        <span className={selectedLabel ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>{selectedLabel || placeholder}</span>
      </button>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {value && !disabled && <button type="button" onClick={e => { e.stopPropagation(); onChange(''); }} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={12} /></button>}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 flex flex-col">
          <div className="p-2 border-b border-gray-100"><div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="検索..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div></div>
          <div className="overflow-y-auto flex-1">
            <button type="button" onClick={() => select('')} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-400'}`}>{placeholder}</button>
            {grouped && groups ? Object.entries(groups).map(([g, opts]) => (
              <div key={g}><div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">{g}</div>
              {opts.map(o => <button key={o.value} type="button" onClick={() => select(o.value)} className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${value === o.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>{o.label}</button>)}</div>
            )) : filtered.map(o => <button key={o.value} type="button" onClick={() => select(o.value)} className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${value === o.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>{o.label}</button>)}
            {filtered.length === 0 && <div className="px-3 py-4 text-sm text-gray-400 text-center">該当なし</div>}
          </div>
          <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400">{filtered.length} / {options.length} 件</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 型定義
// ============================================
interface DocumentWithEntry {
  docId: string; fileName: string; storagePath: string; imageUrl: string | null;
  supplierName: string | null; documentDate: string | null; amount: number | null; taxAmount: number | null;
  entryId: string | null; entryDate: string; description: string; status: string;
  isExcluded: boolean; isBusiness: boolean; aiConfidence: number | null; requiresReview: boolean;
  lineId: string | null; accountItemId: string; taxCategoryId: string; lineAmount: number; taxRate: number | null;
  supplierId: string | null; itemId: string | null;
}

interface TaxRateOption { id: string; rate: number; name: string; }
interface RuleSuggestion { ruleName: string; accountItemId: string; accountItemName: string; taxCategoryId: string; taxCategoryName: string; }
type ReviewFilter = '全て' | '未承認' | '要確認' | '対象外';

// ============================================
// ReviewPage
// ============================================
export default function ReviewPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [items, setItems] = useState<DocumentWithEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [supplierTags, setSupplierTags] = useState<Tag[]>([]);
  const [industries, setIndustries] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [form, setForm] = useState<Partial<DocumentWithEntry>>({});
  const [addRule, setAddRule] = useState(false);
  const [ruleIndustryId, setRuleIndustryId] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('全て');
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);
  const [showApprovalHistory, setShowApprovalHistory] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);

  // SearchableSelect options
  const accountItemOptions = useMemo(() => accountItems.map(a => ({ value: a.id, label: a.name })), [accountItems]);
  const taxCategoryOptions = useMemo(() => taxCategories.map(t => ({ value: t.id, label: t.display_name || t.name, group: t.direction === '仕入' ? '課対仕入' : t.direction === '売上' ? '課税売上' : t.direction || 'その他' })), [taxCategories]);
  const taxRateOptions = useMemo(() => [...taxRates.map(r => ({ value: r.rate.toString(), label: `${r.name} (${Math.round(r.rate * 100)}%)` })), { value: '0', label: '非課税 (0%)' }], [taxRates]);
  const supplierTagOptions = useMemo(() => supplierTags.map(t => ({ value: t.id, label: t.name })), [supplierTags]);

  // フィルタ適用後のアイテム
  const filteredItems = useMemo(() => {
    if (reviewFilter === '全て') return items;
    if (reviewFilter === '未承認') return items.filter(i => i.status !== 'approved' && !i.isExcluded);
    if (reviewFilter === '要確認') return items.filter(i => i.requiresReview);
    if (reviewFilter === '対象外') return items.filter(i => i.isExcluded);
    return items;
  }, [items, reviewFilter]);

  // ステータス集計
  const statusCounts = useMemo(() => ({
    total: items.length,
    approved: items.filter(i => i.status === 'approved').length,
    draft: items.filter(i => i.status !== 'approved' && !i.isExcluded).length,
    excluded: items.filter(i => i.isExcluded).length,
    review: items.filter(i => i.requiresReview).length,
  }), [items]);

  // ============================================
  // データ読み込み
  // ============================================
  useEffect(() => { if (currentWorkflow) loadData(); }, [currentWorkflow]);

  const loadData = async () => {
    if (!currentWorkflow) return;
    setLoading(true);
    const clientId = currentWorkflow.clientId;

    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, original_file_name, storage_path, file_path, supplier_name, document_date, amount, tax_amount')
      .eq('workflow_id', currentWorkflow.id).eq('client_id', clientId).order('created_at');

    if (!docs || docs.length === 0) { setLoading(false); return; }

    const docIds = docs.map((d: any) => d.id);
    const { data: entries } = await supabase
      .from('journal_entries')
      .select(`id, entry_date, description, status, is_excluded, ai_confidence, requires_review, document_id,
        journal_entry_lines!journal_entry_lines_journal_entry_id_fkey (id, debit_credit, account_item_id, tax_category_id, amount, tax_rate, description, supplier_id, item_id)`)
      .eq('client_id', clientId).in('document_id', docIds).in('status', ['draft', 'pending', 'approved']);

    const merged: DocumentWithEntry[] = await Promise.all(docs.map(async (doc: any) => {
      const path = doc.storage_path || doc.file_path || '';
      let imageUrl: string | null = null;
      if (path) { const { data: u } = await supabase.storage.from('documents').createSignedUrl(path, 3600); imageUrl = u?.signedUrl || null; }
      const entry = entries?.find((e: any) => e.document_id === doc.id);
      const debitLine = entry?.journal_entry_lines?.find((l: any) => l.debit_credit === 'debit') || entry?.journal_entry_lines?.[0];
      return {
        docId: doc.id, fileName: doc.original_file_name || doc.file_name, storagePath: path, imageUrl,
        supplierName: doc.supplier_name, documentDate: doc.document_date, amount: doc.amount, taxAmount: doc.tax_amount,
        entryId: entry?.id || null, entryDate: entry?.entry_date || doc.document_date || new Date().toISOString().split('T')[0],
        description: entry?.description || doc.supplier_name || '', status: entry?.status || 'draft',
        isExcluded: entry?.is_excluded || false, isBusiness: !entry?.is_excluded, aiConfidence: entry?.ai_confidence || null,
        requiresReview: entry?.requires_review || false,
        lineId: debitLine?.id || null, accountItemId: debitLine?.account_item_id || '', taxCategoryId: debitLine?.tax_category_id || '',
        lineAmount: debitLine?.amount || doc.amount || 0, taxRate: debitLine?.tax_rate || null,
        supplierId: debitLine?.supplier_id || null, itemId: debitLine?.item_id || null,
      } as DocumentWithEntry;
    }));

    setItems(merged);
    if (merged.length > 0) { setForm({ ...merged[0] }); setAddRule(false); setRuleIndustryId(''); }

    const [aRes, tRes] = await Promise.all([accountItemsApi.getAll(), taxCategoriesApi.getAll()]);
    if (aRes.data) setAccountItems(aRes.data);
    if (tRes.data) setTaxCategories(tRes.data);

    const { data: rates } = await supabase.from('tax_rates').select('id, rate, name').eq('is_current', true).order('rate', { ascending: false });
    if (rates) setTaxRates(rates.map((r: any) => ({ id: r.id, rate: Number(r.rate), name: r.name })));
    const { data: tags } = await supabase.from('tags').select('*').eq('is_active', true).in('tag_type', ['supplier', 'item']).order('name');
    if (tags) setSupplierTags(tags.filter((t: any) => t.tag_type === 'supplier'));
    const { data: inds } = await supabase.from('industries').select('id, name').eq('is_active', true).order('sort_order');
    if (inds) setIndustries(inds);
    setLoading(false);
  };

  // ============================================
  // ルールサジェスト
  // ============================================
  const loadRuleSuggestion = async (supplierName: string | null) => {
    setRuleSuggestion(null);
    if (!supplierName) return;
    const { data: rules } = await supabase
      .from('processing_rules')
      .select('rule_name, conditions, actions')
      .eq('is_active', true).order('priority', { ascending: true }).limit(10);
    if (!rules) return;
    const match = rules.find((r: any) => {
      const pattern = r.conditions?.supplier_pattern;
      return pattern && supplierName.includes(pattern);
    });
    if (match) {
      const acctName = accountItems.find(a => a.id === match.actions?.account_item_id)?.name || '';
      const taxName = taxCategories.find(t => t.id === match.actions?.tax_category_id)?.display_name || taxCategories.find(t => t.id === match.actions?.tax_category_id)?.name || '';
      setRuleSuggestion({
        ruleName: match.rule_name,
        accountItemId: match.actions?.account_item_id || '',
        accountItemName: acctName,
        taxCategoryId: match.actions?.tax_category_id || '',
        taxCategoryName: taxName,
      });
    }
  };

  const applyRuleSuggestion = () => {
    if (!ruleSuggestion) return;
    setForm(p => ({
      ...p,
      accountItemId: ruleSuggestion.accountItemId || p.accountItemId,
      taxCategoryId: ruleSuggestion.taxCategoryId || p.taxCategoryId,
    }));
  };

  // ============================================
  // 承認履歴
  // ============================================
  const loadApprovalHistory = async (entryId: string) => {
    const { data } = await supabase
      .from('journal_entry_approvals')
      .select('id, approval_status, approved_at, comments, approver_id')
      .eq('journal_entry_id', entryId)
      .order('created_at', { ascending: false }).limit(10);
    setApprovalHistory(data || []);
    setShowApprovalHistory(true);
  };

  const insertApprovalLog = async (entryId: string, status: string, comments?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('journal_entry_approvals').insert({
      journal_entry_id: entryId, approver_id: user.id, approval_status: status,
      approved_at: status === 'approved' ? new Date().toISOString() : null, comments: comments || null,
    });
  };

  // ============================================
  // 証憑切り替え
  // ============================================
  const switchTo = async (nextIndex: number) => {
    await saveCurrentItem();
    const realIndex = items.indexOf(filteredItems[nextIndex]);
    setCurrentIndex(realIndex >= 0 ? realIndex : 0);
    const item = filteredItems[nextIndex] || items[0];
    setForm({ ...item });
    setSavedAt(null); setAddRule(false); setRuleIndustryId('');
    setShowApprovalHistory(false);
    loadRuleSuggestion(item.supplierName);
  };

  // currentIndexからfiltered内の位置
  const currentFilteredIndex = filteredItems.indexOf(items[currentIndex]);
  const displayIndex = currentFilteredIndex >= 0 ? currentFilteredIndex : 0;

  // 初回ロード時にルールサジェスト
  useEffect(() => {
    if (items.length > 0 && accountItems.length > 0) {
      loadRuleSuggestion(items[currentIndex]?.supplierName);
    }
  }, [items, accountItems]);

  // ============================================
  // 保存
  // ============================================
  const saveCurrentItem = async () => {
    const item = items[currentIndex];
    if (!item) return;
    setSaving(true);
    let entryId = form.entryId;

    if (!entryId) {
      const { data: cd } = await supabase.from('clients').select('organization_id').eq('id', currentWorkflow!.clientId).single();
      if (!cd?.organization_id) { setSaving(false); return; }
      const { data: ne, error: ie } = await supabase.from('journal_entries').insert({
        organization_id: cd.organization_id, client_id: currentWorkflow!.clientId, document_id: item.docId,
        entry_date: form.entryDate || new Date().toISOString().split('T')[0], entry_type: 'normal',
        description: form.description || '', status: 'draft', is_excluded: form.isExcluded || false, ai_generated: false,
      }).select().single();
      if (ie || !ne) { setSaving(false); return; }
      entryId = ne.id;
      const { data: nl } = await supabase.from('journal_entry_lines').insert({
        journal_entry_id: entryId, line_number: 1, debit_credit: 'debit',
        account_item_id: form.accountItemId || null, tax_category_id: form.taxCategoryId || null,
        tax_rate: form.taxRate || null, amount: form.lineAmount || 0,
      }).select().single();
      setForm(p => ({ ...p, entryId, lineId: nl?.id || null }));
    } else {
      await supabase.from('journal_entries').update({
        entry_date: form.entryDate, description: form.description,
        is_excluded: form.isExcluded, status: form.isExcluded ? 'draft' : (form.status || 'draft'),
      }).eq('id', entryId);
      if (form.lineId) {
        await supabase.from('journal_entry_lines').update({
          account_item_id: form.accountItemId || null, tax_category_id: form.taxCategoryId || null,
          tax_rate: form.taxRate || null, amount: form.lineAmount,
        }).eq('id', form.lineId);
      }
    }

    if (addRule && form.accountItemId) {
      await supabase.from('processing_rules').insert([{
        rule_name: `${form.description || item.supplierName || '不明'} → 自動仕訳`, priority: 100, rule_type: '支出',
        scope: ruleIndustryId ? 'industry' : 'shared', industry_id: ruleIndustryId || null,
        conditions: { supplier_pattern: item.supplierName || null },
        actions: { account_item_id: form.accountItemId, tax_category_id: form.taxCategoryId, description_template: form.description },
        auto_apply: true, require_confirmation: false, is_active: true,
      }]);
    }

    setItems(prev => prev.map((it, i) => i === currentIndex ? { ...it, ...form, entryId } as DocumentWithEntry : it));
    setSaving(false); setSavedAt(new Date().toLocaleTimeString('ja-JP'));
  };

  // ============================================
  // 承認 / 対象外
  // ============================================
  const handleApproveEntry = async () => {
    await saveCurrentItem();
    const entryId = form.entryId || items[currentIndex]?.entryId;
    if (!entryId) return;
    await supabase.from('journal_entries').update({ status: 'approved', requires_review: false }).eq('id', entryId);
    await insertApprovalLog(entryId, 'approved', '仕訳確認から承認');
    setItems(prev => prev.map((it, i) => i === currentIndex ? { ...it, status: 'approved', requiresReview: false } : it));
    setForm(p => ({ ...p, status: 'approved' }));
    setSavedAt(new Date().toLocaleTimeString('ja-JP') + ' 承認済');
  };

  const setBusiness = (isBusiness: boolean) => {
    if (!isBusiness) {
      const j = accountItems.find(a => a.name === '事業主貸');
      setForm(p => ({ ...p, isBusiness: false, isExcluded: false, accountItemId: j?.id || p.accountItemId }));
    } else { setForm(p => ({ ...p, isBusiness: true, isExcluded: false })); }
  };

  const toggleExclude = () => setForm(p => ({ ...p, isExcluded: !p.isExcluded, isBusiness: p.isExcluded }));

  const handleBeforeNext = async (): Promise<boolean> => {
    await saveCurrentItem();
    // 対象外証憑の確認ゲート
    const excludedCount = items.filter(i => i.isExcluded).length;
    if (excludedCount > 0) {
      const ok = window.confirm(`対象外に設定された証憑が${excludedCount}件あります。\n\nこのまま仕訳出力に進みますか？\n「キャンセル」で戻って対象外証憑を確認できます。`);
      if (!ok) {
        setReviewFilter('対象外');
        return false;
      }
    }
    updateWorkflowData({ reviewCompleted: true });
    return true;
  };

  // ============================================
  // ガード
  // ============================================
  if (!currentWorkflow) return <div className="flex flex-col items-center justify-center h-full"><div className="text-center max-w-md"><AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2><a href="/clients" className="btn-primary">顧客一覧へ戻る</a></div></div>;
  if (loading) return <div className="flex flex-col h-screen"><WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" /><div className="flex-1 flex items-center justify-center"><Loader size={32} className="animate-spin text-blue-500" /><span className="ml-3 text-gray-500">データを読み込み中...</span></div></div>;
  if (items.length === 0) return <div className="flex flex-col h-screen"><WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" /><div className="flex-1 flex items-center justify-center"><AlertCircle size={48} className="text-gray-400 mx-auto mb-3" /><p className="text-gray-500">証憑が見つかりません。</p></div></div>;

  const currentItem = items[currentIndex];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />

      {/* ステータスバー */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* フィルタ */}
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {(['全て', '未承認', '要確認', '対象外'] as ReviewFilter[]).map(f => (
              <button key={f} onClick={() => { setReviewFilter(f); }}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${reviewFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {f}{f === '未承認' ? `(${statusCounts.draft})` : f === '要確認' ? `(${statusCounts.review})` : f === '対象外' ? `(${statusCounts.excluded})` : ''}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">{displayIndex + 1} / {filteredItems.length} 件</span>
          {/* ステータス集計 */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600"><CheckCircle size={12} className="inline -mt-0.5" /> 承認{statusCounts.approved}</span>
            <span className="text-yellow-600">未承認{statusCounts.draft}</span>
            <span className="text-red-500">対象外{statusCounts.excluded}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => displayIndex > 0 && switchTo(displayIndex - 1)} disabled={displayIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft size={14} /> 前へ</button>
          <button onClick={() => displayIndex < filteredItems.length - 1 && switchTo(displayIndex + 1)} disabled={displayIndex >= filteredItems.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">次へ <ChevronRight size={14} /></button>
          <button onClick={saveCurrentItem} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-60">
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} 保存
          </button>
          <button onClick={handleApproveEntry} disabled={saving || form.status === 'approved'} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60">
            <CheckCircle size={14} /> {form.status === 'approved' ? '承認済' : '承認'}
          </button>
          {savedAt && <span className="text-xs text-green-600">{savedAt}</span>}
        </div>
      </div>

      {/* 全件承認済みバナー */}
      {statusCounts.draft === 0 && statusCounts.total > 0 && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-2 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle size={16} /> 全件承認済み。「仕訳出力へ」進めます。
        </div>
      )}

      {/* メイン 2カラム */}
      <div className="flex-1 p-4 grid grid-cols-2 gap-4 max-w-7xl mx-auto w-full overflow-hidden">
        {/* 左：証憑画像 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div><h2 className="font-bold text-sm">証憑画像</h2><p className="text-xs text-gray-400 truncate max-w-xs">{currentItem.fileName}</p></div>
            <div className="flex items-center gap-1 border border-gray-300 rounded-md p-1">
              <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={14} /></button>
              <span className="text-xs px-1">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={14} /></button>
              <div className="w-px h-3 bg-gray-300 mx-0.5"></div>
              <button onClick={() => setZoom(100)} className="p-1 hover:bg-gray-100 rounded text-gray-600"><RotateCcw size={14} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-4">
            {currentItem.imageUrl ? <img src={currentItem.imageUrl} alt={currentItem.fileName} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="rounded shadow-sm border border-gray-200 object-contain" />
              : <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><AlertCircle size={40} /><span className="text-sm">画像を読み込めませんでした</span></div>}
          </div>
        </div>

        {/* 右：仕訳データ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm">仕訳データ</h2>
              {/* ステータスバッジ */}
              {form.status === 'approved' ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">承認済</span>
                : form.isExcluded ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">対象外</span>
                : currentItem.requiresReview ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">要確認</span>
                : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">未承認</span>}
            </div>
            <div className="flex items-center gap-2">
              {currentItem.aiConfidence != null && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${currentItem.aiConfidence >= 0.8 ? 'bg-green-50 text-green-600' : currentItem.aiConfidence >= 0.5 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
                  AI {Math.round(currentItem.aiConfidence * 100)}%
                </span>
              )}
              {/* 承認履歴ボタン */}
              {currentItem.entryId && (
                <button onClick={() => loadApprovalHistory(currentItem.entryId!)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="承認履歴"><History size={14} /></button>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">
            {form.isExcluded && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2"><Ban size={16} />対象外に設定されています</div>}

            {/* ルールサジェスト */}
            {ruleSuggestion && form.status !== 'approved' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <Lightbulb size={16} className="text-amber-500" />
                    <span>ルール提案: <strong>{ruleSuggestion.accountItemName}</strong> / {ruleSuggestion.taxCategoryName}</span>
                  </div>
                  <button onClick={applyRuleSuggestion} className="px-2.5 py-1 text-xs bg-amber-600 text-white rounded-md hover:bg-amber-700">適用</button>
                </div>
                <p className="text-xs text-amber-600 mt-1">{ruleSuggestion.ruleName}</p>
              </div>
            )}

            {/* 承認履歴パネル */}
            {showApprovalHistory && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1"><History size={12} />承認履歴</h4>
                  <button onClick={() => setShowApprovalHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                {approvalHistory.length === 0 ? <p className="text-xs text-gray-400">履歴なし</p>
                  : approvalHistory.map(h => (
                    <div key={h.id} className="text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                      <span className={`font-medium ${h.approval_status === 'approved' ? 'text-green-600' : 'text-gray-600'}`}>{h.approval_status}</span>
                      {h.approved_at && <span className="ml-2 text-gray-400">{new Date(h.approved_at).toLocaleString('ja-JP')}</span>}
                      {h.comments && <span className="ml-2">{h.comments}</span>}
                    </div>
                  ))}
              </div>
            )}

            {/* OCRサマリー */}
            {(currentItem.supplierName || currentItem.amount || currentItem.documentDate) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 mb-1">OCR読取結果（参考）</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {currentItem.supplierName && <div><span className="text-slate-400">取引先:</span><span className="ml-1 font-medium text-slate-700">{currentItem.supplierName}</span></div>}
                  {currentItem.amount != null && <div><span className="text-slate-400">金額:</span><span className="ml-1 font-medium text-slate-700">¥{Number(currentItem.amount).toLocaleString()}</span></div>}
                  {currentItem.documentDate && <div><span className="text-slate-400">日付:</span><span className="ml-1 font-medium text-slate-700">{new Date(currentItem.documentDate).toLocaleDateString('ja-JP')}</span></div>}
                </div>
              </div>
            )}

            {/* フォーム */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span>取引日</label>
                <input type="date" value={form.entryDate || ''} onChange={e => setForm(p => ({ ...p, entryDate: e.target.value }))} className="w-full border border-blue-200 bg-blue-50/30 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span>金額（円）</label>
                <input type="number" value={form.lineAmount || ''} onChange={e => setForm(p => ({ ...p, lineAmount: Number(e.target.value) }))} className="w-full border border-green-200 bg-green-50/30 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">勘定科目</label>
                <SearchableSelect options={accountItemOptions} value={form.accountItemId || ''} onChange={v => setForm(p => ({ ...p, accountItemId: v }))} placeholder="-- 勘定科目を検索 --" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">税区分</label>
                <SearchableSelect options={taxCategoryOptions} value={form.taxCategoryId || ''} onChange={v => {
                  const tc = taxCategories.find(t => t.id === v);
                  const mr = taxRates.find(r => tc && tc.name.includes(`${Math.round(r.rate * 100)}%`));
                  setForm(p => ({ ...p, taxCategoryId: v, taxRate: mr?.rate ?? p.taxRate }));
                }} placeholder="-- 税区分を検索 --" grouped />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>税率</label>
                <SearchableSelect options={taxRateOptions} value={form.taxRate?.toString() || ''} onChange={v => setForm(p => ({ ...p, taxRate: v ? Number(v) : null }))} placeholder="-- 税率 --" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">取引先タグ</label>
                <SearchableSelect options={supplierTagOptions} value="" onChange={() => {}} placeholder="-- タグを検索 --" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">摘要</label>
                <input type="text" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="摘要を入力" className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* 事業用/プライベート/ルール追加 */}
            <div className="border border-gray-200 rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-1">
                  <button onClick={() => setBusiness(true)} className={`px-3 py-1 text-sm rounded-md transition-colors ${form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>事業用</button>
                  <button onClick={() => setBusiness(false)} className={`px-3 py-1 text-sm rounded-md transition-colors ${!form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>プライベート</button>
                </div>
                <button onClick={toggleExclude} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${form.isExcluded ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  <Ban size={14} />{form.isExcluded ? '対象外を解除' : '対象外にする'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={addRule} onChange={e => setAddRule(e.target.checked)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">ルール追加</span>
                </label>
                {addRule && <select value={ruleIndustryId} onChange={e => setRuleIndustryId(e.target.value)} className="border border-gray-300 rounded-md p-1.5 text-sm bg-white"><option value="">共通ルール</option>{industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
              </div>
            </div>

            {currentItem.entryId && <div className="text-xs text-gray-400 text-right">仕訳ID: {currentItem.entryId.slice(0, 8)}...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}