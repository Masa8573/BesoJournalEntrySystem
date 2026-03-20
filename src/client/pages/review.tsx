import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ZoomOut, ZoomIn, RotateCcw, ChevronLeft, ChevronRight,
  ChevronDown, Ban, AlertCircle, Loader, CheckCircle, Save,
  Edit2, XCircle, ShieldCheck, List, Eye, X, Search, Unlock,
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';
import type { AccountItem, TaxCategory, Supplier } from '@/types';

// ============================================
// ローマ字 → ひらがな 変換テーブル（C6用）
// ============================================
const ROMAJI_MAP: Record<string, string> = {
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',
  sa:'さ',si:'し',shi:'し',su:'す',se:'せ',so:'そ',
  ta:'た',ti:'ち',chi:'ち',tu:'つ',tsu:'つ',te:'て',to:'と',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',
  ha:'は',hi:'ひ',hu:'ふ',fu:'ふ',he:'へ',ho:'ほ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',
  ya:'や',yu:'ゆ',yo:'よ',
  ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',
  wa:'わ',wi:'ゐ',we:'ゑ',wo:'を',n:'ん',
  ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
  za:'ざ',zi:'じ',ji:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
  pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',
  sha:'しゃ',shu:'しゅ',sho:'しょ',
  cha:'ちゃ',chu:'ちゅ',cho:'ちょ',
  nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',
  mya:'みゃ',myu:'みゅ',myo:'みょ',
  rya:'りゃ',ryu:'りゅ',ryo:'りょ',
  gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',
  bya:'びゃ',byu:'びゅ',byo:'びょ',
  pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
};

function romajiToHiragana(input: string): string {
  let result = '';
  let i = 0;
  const lower = input.toLowerCase();
  while (i < lower.length) {
    // 3文字マッチ
    if (i + 3 <= lower.length && ROMAJI_MAP[lower.slice(i, i + 3)]) {
      result += ROMAJI_MAP[lower.slice(i, i + 3)];
      i += 3;
    // 2文字マッチ
    } else if (i + 2 <= lower.length && ROMAJI_MAP[lower.slice(i, i + 2)]) {
      result += ROMAJI_MAP[lower.slice(i, i + 2)];
      i += 2;
    // 1文字マッチ
    } else if (ROMAJI_MAP[lower[i]]) {
      result += ROMAJI_MAP[lower[i]];
      i += 1;
    // 促音: nn → ん の処理は上でカバー、残りはそのまま
    } else {
      result += lower[i];
      i += 1;
    }
  }
  return result;
}

// ============================================
// SearchableSelect コンポーネント（C6用）
// 日本語 + ローマ字 + 番号（code）で検索
// ============================================
interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; name: string; code?: string; name_kana?: string | null }>;
  placeholder?: string;
  className?: string;
}

function SearchableSelect({ value, onChange, options, placeholder = '-- 選択 --', className = '' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.id === value);

  // クリック外で閉じる
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // フィルタリング: 日本語名 / ローマ字→ひらがな変換 / コード番号
  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    const hiraganaQ = romajiToHiragana(q);

    return options.filter(o => {
      const name = o.name.toLowerCase();
      const kana = (o.name_kana || '').toLowerCase();
      const code = (o.code || '').toLowerCase();
      return (
        name.includes(q) ||
        kana.includes(q) ||
        kana.includes(hiraganaQ) ||
        code.includes(q) ||
        code.startsWith(q)
      );
    });
  }, [query, options]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full border border-gray-300 rounded-md p-2 pr-7 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {selectedOption ? (
          <span>{selectedOption.code ? `${selectedOption.code} ` : ''}{selectedOption.name}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* 検索入力 */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="名前・ローマ字・番号で検索"
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onKeyDown={e => {
                  if (e.key === 'Enter' && filtered.length === 1) {
                    handleSelect(filtered[0].id);
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
              />
            </div>
          </div>
          {/* オプションリスト */}
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">該当なし</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleSelect(o.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    o.id === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  {o.code && <span className="text-gray-400 mr-1.5">{o.code}</span>}
                  {o.name}
                  {o.name_kana && <span className="text-gray-400 ml-1 text-xs">({o.name_kana})</span>}
                </button>
              ))
            )}
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

interface TaxRateOption {
  id: string;
  rate: number;
  name: string;
}

type ViewMode = 'list' | 'detail';

// ============================================
// メインコンポーネント
// ============================================
export default function ReviewPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();

  // ── 共通 state ──
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [industries, setIndustries] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // ── 一覧モード state ──
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    account_item_id?: string;
    tax_category_id?: string;
    amount?: number;
    notes?: string;
  }>({});

  // ── 個別チェックモード state ──
  const [items, setItems] = useState<DocumentWithEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [form, setForm] = useState<Partial<DocumentWithEntry>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [addRule, setAddRule] = useState(false);
  const [ruleIndustryId, setRuleIndustryId] = useState('');

  // ============================================
  // データ読み込み
  // ============================================
  useEffect(() => {
    if (!currentWorkflow) return;
    loadAllData();
  }, [currentWorkflow]);

  const loadAllData = async () => {
    if (!currentWorkflow) return;
    setLoading(true);
    const clientId = currentWorkflow.clientId;

    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, original_file_name, storage_path, file_path, supplier_name, document_date, amount, tax_amount')
      .eq('workflow_id', currentWorkflow.id)
      .eq('client_id', clientId)
      .order('created_at');

    if (!docs || docs.length === 0) {
      setEntries([]); setItems([]); setLoading(false); return;
    }

    const docIds = docs.map((d: any) => d.id);

    // 一覧モード用
    const { data: entriesData, error: entriesError } = await supabase
      .from('journal_entries')
      .select(`
        id, client_id, document_id, entry_date, description, status, notes, ai_confidence, ai_generated, requires_review,
        journal_entry_lines (
          id, line_number, debit_credit, account_item_id, tax_category_id, amount, description,
          account_item:account_items(id, name),
          tax_category:tax_categories(id, name)
        )
      `)
      .eq('client_id', clientId)
      .in('document_id', docIds)
      .in('status', ['draft', 'pending', 'approved'])
      .order('entry_date', { ascending: true });

    if (entriesError) console.error('仕訳取得エラー:', entriesError);

    const mappedEntries: EntryRow[] = (entriesData || []).map((entry: any) => {
      const debitLine = entry.journal_entry_lines?.find((l: any) => l.debit_credit === 'debit')
        || entry.journal_entry_lines?.[0];
      return {
        ...entry,
        lines: entry.journal_entry_lines || [],
        accountItemName: debitLine?.account_item?.name
          ?? (Array.isArray(debitLine?.account_item) ? debitLine.account_item[0]?.name : undefined),
        taxCategoryName: debitLine?.tax_category?.name
          ?? (Array.isArray(debitLine?.tax_category) ? debitLine.tax_category[0]?.name : undefined),
        amount: debitLine?.amount,
      };
    });
    setEntries(mappedEntries);

    // 個別チェックモード用
    const { data: entriesForDetail } = await supabase
      .from('journal_entries')
      .select(`
        id, entry_date, description, status, is_excluded, ai_confidence,
        document_id,
        journal_entry_lines (
          id, debit_credit, account_item_id, tax_category_id, amount, tax_rate, description, supplier_id, item_id
        )
      `)
      .eq('client_id', clientId)
      .in('document_id', docIds)
      .in('status', ['draft', 'pending', 'approved']);

    const merged: DocumentWithEntry[] = await Promise.all(
      docs.map(async (doc: any) => {
        const path = doc.storage_path || doc.file_path || '';
        let imageUrl: string | null = null;
        if (path) {
          const { data: urlData } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
          imageUrl = urlData?.signedUrl || null;
        }
        const entry = entriesForDetail?.find((e: any) => e.document_id === doc.id);
        const debitLine = entry?.journal_entry_lines?.find((l: any) => l.debit_credit === 'debit')
          || entry?.journal_entry_lines?.[0];
        return {
          docId: doc.id,
          fileName: doc.original_file_name || doc.file_name,
          storagePath: path,
          imageUrl,
          supplierName: doc.supplier_name,
          documentDate: doc.document_date,
          amount: doc.amount,
          taxAmount: doc.tax_amount,
          entryId: entry?.id || null,
          entryDate: entry?.entry_date || doc.document_date || new Date().toISOString().split('T')[0],
          description: entry?.description || doc.supplier_name || '',
          status: entry?.status || 'draft',
          isExcluded: entry?.is_excluded || false,
          isBusiness: !entry?.is_excluded,
          aiConfidence: entry?.ai_confidence || null,
          lineId: debitLine?.id || null,
          accountItemId: debitLine?.account_item_id || '',
          taxCategoryId: debitLine?.tax_category_id || '',
          lineAmount: debitLine?.amount || doc.amount || 0,
          taxRate: debitLine?.tax_rate || null,
          supplierId: debitLine?.supplier_id || null,
          itemId: debitLine?.item_id || null,
        } as DocumentWithEntry;
      })
    );
    setItems(merged);
    if (merged.length > 0) setForm({ ...merged[0] });

    // マスタ取得（並列）
    const [accountsRes, taxRes] = await Promise.all([
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);
    if (accountsRes.data) setAccountItems(accountsRes.data);
    if (taxRes.data) setTaxCategories(taxRes.data);

    const { data: rates } = await supabase.from('tax_rates').select('id, rate, name').eq('is_current', true).order('rate', { ascending: false });
    if (rates) setTaxRates(rates.map((r: any) => ({ id: r.id, rate: Number(r.rate), name: r.name })));

    // C8: 取引先マスタ取得
    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (suppliersData) setSuppliers(suppliersData);

    const { data: inds } = await supabase.from('industries').select('id, name').eq('is_active', true).order('sort_order');
    if (inds) setIndustries(inds);

    setLoading(false);
  };

  // ============================================
  // C7: 勘定科目変更時に税区分を自動割り当て
  // ============================================
  const handleAccountItemChange = (accountItemId: string) => {
    const ai = accountItems.find(a => a.id === accountItemId);
    const updates: Partial<DocumentWithEntry> = { accountItemId };

    // account_items.tax_category_id があれば税区分を自動セット
    if (ai?.tax_category_id) {
      updates.taxCategoryId = ai.tax_category_id;
      // 税率も自動セット
      const tc = taxCategories.find(t => t.id === ai.tax_category_id);
      if (tc) {
        const matchRate = taxRates.find(r => tc.name.includes(`${Math.round(r.rate * 100)}%`));
        if (matchRate) updates.taxRate = matchRate.rate;
      }
    }

    setForm(p => ({ ...p, ...updates }));
  };

  // ============================================
  // C8: 取引先変更時にデフォルト勘定科目・税区分を自動セット
  // ============================================
  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    const updates: Partial<DocumentWithEntry> = { supplierId: supplierId || null };

    if (supplier) {
      // 取引先のデフォルト勘定科目があればセット
      if (supplier.default_account_item_id && !form.accountItemId) {
        updates.accountItemId = supplier.default_account_item_id;
      }
      // 取引先のデフォルト税区分があればセット
      if (supplier.default_tax_category_id && !form.taxCategoryId) {
        updates.taxCategoryId = supplier.default_tax_category_id;
      }
    }

    setForm(p => ({ ...p, ...updates }));
  };

  // ============================================
  // 一覧モード: 編集 / 承認 / 削除
  // ============================================
  const handleListEdit = (entry: EntryRow) => {
    setEditingId(entry.id);
    const debitLine = entry.lines.find(l => l.debit_credit === 'debit') || entry.lines[0];
    setEditForm({
      account_item_id: debitLine?.account_item_id,
      tax_category_id: debitLine?.tax_category_id,
      amount: debitLine?.amount,
      notes: entry.notes,
    });
  };

  const handleListSave = async (entry: EntryRow) => {
    await supabase.from('journal_entries').update({ notes: editForm.notes }).eq('id', entry.id);
    const debitLine = entry.lines.find(l => l.debit_credit === 'debit') || entry.lines[0];
    if (debitLine) {
      await supabase.from('journal_entry_lines').update({
        account_item_id: editForm.account_item_id,
        tax_category_id: editForm.tax_category_id,
        amount: editForm.amount,
      }).eq('id', debitLine.id);
    }
    await loadAllData();
    setEditingId(null); setEditForm({});
  };

  const handleListCancel = () => { setEditingId(null); setEditForm({}); };

  const handleApprove = async (id: string) => {
    await supabase.from('journal_entries').update({ status: 'approved' }).eq('id', id);
    await loadAllData();
  };

  // C3: 承認済み → pending に戻して再編集可能にする
  const handleUnlock = async (id: string) => {
    await supabase.from('journal_entries').update({ status: 'pending' }).eq('id', id);
    await loadAllData();
  };

  const handleReject = async (id: string) => {
    if (window.confirm('この仕訳を削除しますか？')) {
      await supabase.from('journal_entries').delete().eq('id', id);
      await loadAllData();
    }
  };

  const handleApproveAll = async () => {
    const pendingEntries = entries.filter(e => e.status !== 'approved');
    if (pendingEntries.length === 0) return;
    if (!window.confirm(`${pendingEntries.length}件の仕訳を一括承認しますか？`)) return;
    await supabase.from('journal_entries').update({ status: 'approved' }).in('id', pendingEntries.map(e => e.id));
    await loadAllData();
  };

  const openDetail = (entryId: string) => {
    const docEntry = items.find(i => i.entryId === entryId);
    if (!docEntry) {
      const entry = entries.find(e => e.id === entryId);
      const docItem = items.find(i => i.docId === entry?.document_id);
      if (docItem) {
        const idx = items.indexOf(docItem);
        setCurrentIndex(idx);
        setForm({ ...docItem });
      }
    } else {
      const idx = items.indexOf(docEntry);
      setCurrentIndex(idx);
      setForm({ ...docEntry });
    }
    setSavedAt(null); setAddRule(false); setRuleIndustryId('');
    setViewMode('detail');
  };

  // ============================================
  // 個別チェックモード: 保存 / 切り替え
  // ============================================
  const switchTo = async (nextIndex: number) => {
    await saveCurrentItem();
    setCurrentIndex(nextIndex);
    setForm({ ...items[nextIndex] });
    setSavedAt(null); setAddRule(false); setRuleIndustryId('');
  };

  const saveCurrentItem = async () => {
    const item = items[currentIndex];
    if (!item) return;
    setSaving(true);

    let entryId = form.entryId;

    if (!entryId) {
      const { data: clientData } = await supabase.from('clients').select('organization_id').eq('id', currentWorkflow!.clientId).single();
      if (!clientData?.organization_id) { setSaving(false); return; }

      const { data: newEntry, error: insertError } = await supabase
        .from('journal_entries')
        .insert({
          organization_id: clientData.organization_id,
          client_id: currentWorkflow!.clientId,
          document_id: item.docId,
          entry_date: form.entryDate || new Date().toISOString().split('T')[0],
          entry_type: 'normal',
          description: form.description || '',
          status: form.isExcluded ? 'draft' : 'approved',
          is_excluded: form.isExcluded || false,
          ai_generated: false,
        })
        .select().single();

      if (insertError || !newEntry) { console.error('仕訳新規作成エラー:', insertError); setSaving(false); return; }
      entryId = newEntry.id;

      const { data: newLine } = await supabase
        .from('journal_entry_lines')
        .insert({
          journal_entry_id: entryId,
          line_number: 1,
          debit_credit: 'debit',
          account_item_id: form.accountItemId || null,
          tax_category_id: form.taxCategoryId || null,
          tax_rate: form.taxRate || null,
          amount: form.lineAmount || 0,
          supplier_id: form.supplierId || null,   // C8: 取引先保存
          item_id: form.itemId || null,
        })
        .select().single();

      setForm(p => ({ ...p, entryId, lineId: newLine?.id || null }));
    } else {
      // C3: 承認済みの場合は pending に戻す（内容変更があった場合）
      const newStatus = form.isExcluded ? 'draft' : (item.status === 'approved' ? 'pending' : 'approved');

      await supabase.from('journal_entries').update({
        entry_date: form.entryDate,
        description: form.description,
        is_excluded: form.isExcluded,
        status: newStatus,
      }).eq('id', entryId);

      if (form.lineId) {
        await supabase.from('journal_entry_lines').update({
          account_item_id: form.accountItemId || null,
          tax_category_id: form.taxCategoryId || null,
          tax_rate: form.taxRate || null,
          amount: form.lineAmount,
          supplier_id: form.supplierId || null,   // C8: 取引先保存
          item_id: form.itemId || null,
        }).eq('id', form.lineId);
      }
    }

    // ルール追加
    if (addRule && form.accountItemId) {
      const ruleData = {
        rule_name: `${form.description || item.supplierName || '不明'} → 自動仕訳`,
        priority: 100,
        rule_type: '支出' as const,
        scope: ruleIndustryId ? 'industry' as const : 'shared' as const,
        industry_id: ruleIndustryId || null,
        conditions: { supplier_pattern: item.supplierName || null },
        actions: {
          account_item_id: form.accountItemId || null,
          tax_category_id: form.taxCategoryId || null,
          description_template: form.description || null,
        },
        auto_apply: true, require_confirmation: false, is_active: true,
      };
      const { error } = await supabase.from('processing_rules').insert([ruleData]);
      if (error) console.error('ルール追加エラー:', error);
    }

    setItems(prev => prev.map((it, i) => i === currentIndex ? { ...it, ...form, entryId } as DocumentWithEntry : it));
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('ja-JP'));
  };

  const setBusiness = (isBusiness: boolean) => {
    if (!isBusiness) {
      const jigyounushiKashi = accountItems.find(a => a.name === '事業主貸');
      setForm(p => ({ ...p, isBusiness: false, isExcluded: false, accountItemId: jigyounushiKashi?.id || p.accountItemId }));
    } else {
      setForm(p => ({ ...p, isBusiness: true, isExcluded: false }));
    }
  };

  const toggleExclude = () => {
    setForm(prev => ({ ...prev, isExcluded: !prev.isExcluded, isBusiness: prev.isExcluded }));
  };

  const groupedTaxCategories = useMemo(() => {
    const groups: Record<string, TaxCategory[]> = {};
    taxCategories.forEach(tc => {
      const group = tc.direction || 'その他';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tc);
    });
    return groups;
  }, [taxCategories]);

  // ============================================
  // ワークフロー次へ
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    if (viewMode === 'detail') await saveCurrentItem();
    const pendingEntries = entries.filter(e => e.status !== 'approved');
    if (pendingEntries.length > 0) {
      const proceed = window.confirm(`未承認の仕訳が${pendingEntries.length}件あります。\n\n一括承認して次に進みますか？`);
      if (!proceed) return false;
      await supabase.from('journal_entries').update({ status: 'approved' }).in('id', pendingEntries.map(e => e.id));
    }
    updateWorkflowData({ reviewCompleted: true });
    return true;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return `¥${Number(amount).toLocaleString()}`;
  };

  // ============================================
  // ガード / ローディング
  // ============================================
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">顧客一覧からワークフローを開始してください。</p>
          <a href="/clients" className="btn-primary">顧客一覧へ戻る</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />
        <div className="flex-1 flex items-center justify-center">
          <Loader size={32} className="animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  const totalCount = entries.length;
  const approvedCount = entries.filter(e => e.status === 'approved').length;
  const reviewCount = entries.filter(e => e.requires_review || (e.ai_confidence != null && e.ai_confidence < 0.7)).length;
  const pendingCount = totalCount - approvedCount;

  // ============================================
  // レンダリング
  // ============================================
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />

      {/* ──── 一覧モード ──── */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">仕訳確認</h1>
                <p className="text-sm text-gray-500 mt-1">行をクリックして個別チェック。金額や勘定科目を目視確認できます。</p>
              </div>
              {pendingCount > 0 && (
                <button onClick={handleApproveAll} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  <CheckCircle size={18} />一括承認（{pendingCount}件）
                </button>
              )}
            </div>

            {/* サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: '全件', count: totalCount, color: 'text-gray-900', bg: 'bg-white', icon: <List size={20} className="text-gray-400" /> },
                { label: '確認済み', count: approvedCount, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle size={20} className="text-green-500" /> },
                { label: '未承認', count: pendingCount, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Edit2 size={20} className="text-blue-500" /> },
                { label: '要確認', count: reviewCount, color: 'text-orange-600', bg: 'bg-orange-50', icon: <AlertCircle size={20} className="text-orange-500" /> },
              ].map(card => (
                <div key={card.label} className={`${card.bg} rounded-lg border border-gray-200 p-4`}>
                  <div className="flex items-center gap-2 mb-2">{card.icon}<h3 className="text-sm font-medium text-gray-600">{card.label}</h3></div>
                  <div className={`text-3xl font-bold ${card.color}`}>{card.count}</div>
                </div>
              ))}
            </div>

            {/* 仕訳一覧テーブル */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">仕訳一覧</h2>
              </div>
              {entries.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">証憑が見つかりません。OCR処理を先に完了してください。</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引日</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">摘要</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">勘定科目</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">税区分</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">状態</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {entries.map((entry) => {
                        const isEditing = editingId === entry.id;
                        const needsReview = entry.requires_review || (entry.ai_confidence != null && entry.ai_confidence < 0.7);
                        const isApproved = entry.status === 'approved';
                        return (
                          <tr key={entry.id}
                            className={`hover:bg-gray-50 cursor-pointer transition-colors ${needsReview ? 'bg-yellow-50' : isApproved ? 'bg-green-50/30' : ''}`}
                            onClick={() => !isEditing && openDetail(entry.id)}>
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(entry.entry_date).toLocaleDateString('ja-JP')}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{entry.description || '-'}</td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <select value={editForm.account_item_id || ''} onChange={e => setEditForm({ ...editForm, account_item_id: e.target.value })}
                                  className="input text-sm py-1" onClick={e => e.stopPropagation()}>
                                  <option value="">選択</option>
                                  {accountItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                              ) : (
                                <span className={needsReview ? 'text-orange-700 font-medium' : 'text-gray-900'}>{entry.accountItemName || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {isEditing ? (
                                <select value={editForm.tax_category_id || ''} onChange={e => setEditForm({ ...editForm, tax_category_id: e.target.value })}
                                  className="input text-sm py-1" onClick={e => e.stopPropagation()}>
                                  <option value="">選択</option>
                                  {taxCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>)}
                                </select>
                              ) : (
                                <span className={needsReview ? 'text-orange-700 font-medium' : 'text-gray-900'}>{entry.taxCategoryName || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {isEditing ? (
                                <input type="number" value={editForm.amount || ''} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                                  className="input text-sm py-1 w-28 text-right" onClick={e => e.stopPropagation()} />
                              ) : (
                                <span className="font-medium text-gray-900">{formatCurrency(entry.amount)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} />承認済</span>
                              ) : needsReview ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle size={12} />要確認</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><ShieldCheck size={12} />AI生成</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => handleListSave(entry)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={16} /></button>
                                  <button onClick={handleListCancel} className="p-1 text-gray-600 hover:bg-gray-100 rounded"><X size={16} /></button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => openDetail(entry.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="個別チェック"><Eye size={16} /></button>
                                  {/* C3: 承認済みの場合は「ロック解除」ボタンを表示 */}
                                  {isApproved ? (
                                    <button onClick={() => handleUnlock(entry.id)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="ロック解除（再編集）"><Unlock size={16} /></button>
                                  ) : (
                                    <>
                                      <button onClick={() => handleListEdit(entry)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="インライン編集"><Edit2 size={16} /></button>
                                      <button onClick={() => handleApprove(entry.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="承認"><CheckCircle size={16} /></button>
                                    </>
                                  )}
                                  <button onClick={() => handleReject(entry.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="削除"><XCircle size={16} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──── 個別チェックモード ──── */}
      {viewMode === 'detail' && items.length > 0 && (() => {
        const currentItem = items[currentIndex];
        const detailTotalCount = items.length;
        const detailApprovedCount = items.filter(i => i.status === 'approved' || i.isExcluded).length;

        return (
          <>
            {/* ナビゲーションバー */}
            <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <button onClick={() => { saveCurrentItem(); setViewMode('list'); loadAllData(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                  <List size={14} /> 一覧へ戻る
                </button>
                <span className="text-sm text-gray-500">{currentIndex + 1} / {detailTotalCount} 件</span>
                <div className="flex items-center gap-1">
                  <CheckCircle size={14} className="text-green-500" />
                  <span className="text-sm text-gray-500">確認済み {detailApprovedCount} 件</span>
                </div>
                {/* C3: 承認済みバッジ */}
                {currentItem.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle size={12} />承認済み（編集すると再確認が必要になります）
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => currentIndex > 0 && switchTo(currentIndex - 1)} disabled={currentIndex === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ChevronLeft size={14} /> 前へ
                </button>
                <button onClick={() => currentIndex < detailTotalCount - 1 && switchTo(currentIndex + 1)} disabled={currentIndex === detailTotalCount - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  次へ <ChevronRight size={14} />
                </button>
                <button onClick={saveCurrentItem} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60">
                  {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} 保存
                </button>
                {savedAt && <span className="text-xs text-green-600">{savedAt} 保存済み</span>}
              </div>
            </div>

            {/* メイン 2カラム */}
            <div className="flex-1 p-4 grid grid-cols-2 gap-4 max-w-7xl mx-auto w-full overflow-hidden">

              {/* 左: 証憑画像 */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h2 className="font-bold text-sm">証憑画像</h2>
                    <p className="text-xs text-gray-400 truncate max-w-xs">{currentItem.fileName}</p>
                  </div>
                  <div className="flex items-center gap-1 border border-gray-300 rounded-md p-1">
                    <button onClick={() => setZoom(z => Math.max(50, z - 25))} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={14} /></button>
                    <span className="text-xs px-1">{zoom}%</span>
                    <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={14} /></button>
                    <div className="w-px h-3 bg-gray-300 mx-0.5"></div>
                    <button onClick={() => setZoom(100)} className="p-1 hover:bg-gray-100 rounded text-gray-600"><RotateCcw size={14} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-4">
                  {currentItem.imageUrl ? (
                    currentItem.fileName?.toLowerCase().endsWith('.pdf') ? (
                      <iframe src={currentItem.imageUrl} className="w-full h-full border-0" title={currentItem.fileName} />
                    ) : (
                      <img src={currentItem.imageUrl} alt={currentItem.fileName} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="rounded shadow-sm border border-gray-200 object-contain" />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                      <AlertCircle size={40} /><span className="text-sm">画像を読み込めませんでした</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 右: 仕訳データ */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                  <h2 className="font-bold text-sm">仕訳データ</h2>
                  <div className="flex items-center gap-2">
                    {currentItem.supplierName && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">OCR: {currentItem.supplierName}</span>
                    )}
                    {currentItem.aiConfidence != null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        currentItem.aiConfidence >= 0.8 ? 'bg-green-50 text-green-600' : currentItem.aiConfidence >= 0.5 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                      }`}>AI信頼度 {Math.round(currentItem.aiConfidence * 100)}%</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">
                  {form.isExcluded && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                      <Ban size={16} />この証憑は対象外に設定されています
                    </div>
                  )}

                  {/* OCR読取結果 */}
                  {(currentItem.supplierName || currentItem.amount || currentItem.documentDate) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-medium text-slate-500 mb-1">OCR読取結果（参考）</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {currentItem.supplierName && <div><span className="text-slate-400">取引先:</span><span className="ml-1 font-medium text-slate-700">{currentItem.supplierName}</span></div>}
                        {currentItem.amount != null && <div><span className="text-slate-400">金額:</span><span className="ml-1 font-medium text-slate-700">¥{Number(currentItem.amount).toLocaleString()}</span></div>}
                        {currentItem.documentDate && <div><span className="text-slate-400">日付:</span><span className="ml-1 font-medium text-slate-700">{new Date(currentItem.documentDate).toLocaleDateString('ja-JP')}</span></div>}
                        {currentItem.taxAmount != null && <div><span className="text-slate-400">税額:</span><span className="ml-1 font-medium text-slate-700">¥{Number(currentItem.taxAmount).toLocaleString()}</span></div>}
                      </div>
                    </div>
                  )}

                  {/* フォーム */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                    {/* 取引日 */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span>取引日</label>
                      <input type="date" value={form.entryDate || ''} onChange={e => setForm(p => ({ ...p, entryDate: e.target.value }))}
                        className="w-full border border-blue-200 bg-blue-50/30 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {/* 金額 */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span>金額（円）</label>
                      <input type="number" value={form.lineAmount || ''} onChange={e => setForm(p => ({ ...p, lineAmount: Number(e.target.value) }))}
                        className="w-full border border-green-200 bg-green-50/30 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* C6: 勘定科目（SearchableSelect） + C7: 税区分自動割当 */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">勘定科目</label>
                      <SearchableSelect
                        value={form.accountItemId || ''}
                        onChange={handleAccountItemChange}
                        options={accountItems.map(a => ({ id: a.id, name: a.name, code: a.code, name_kana: a.name_kana }))}
                        placeholder="名前・ローマ字・番号で検索"
                      />
                    </div>

                    {/* 税区分 */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">税区分</label>
                      <div className="relative">
                        <select value={form.taxCategoryId || ''} onChange={e => {
                          const tc = taxCategories.find(t => t.id === e.target.value);
                          const matchRate = taxRates.find(r => tc && tc.name.includes(`${Math.round(r.rate * 100)}%`));
                          setForm(p => ({ ...p, taxCategoryId: e.target.value, taxRate: matchRate?.rate ?? p.taxRate }));
                        }}
                          className="w-full border border-gray-300 rounded-md p-2 pr-7 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">-- 選択 --</option>
                          {Object.entries(groupedTaxCategories).map(([group, cats]) => (
                            <optgroup key={group} label={group === '仕入' ? '課対仕入' : group === '売上' ? '課税売上' : group}>
                              {cats.map(t => <option key={t.id} value={t.id}>{t.display_name || t.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* 税率 */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>税率</label>
                      <div className="relative">
                        <select value={form.taxRate?.toString() || ''} onChange={e => setForm(p => ({ ...p, taxRate: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full border border-yellow-200 bg-yellow-50/30 rounded-md p-2 pr-7 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- 選択 --</option>
                          {taxRates.map(r => <option key={r.id} value={r.rate}>{r.name} ({Math.round(r.rate * 100)}%)</option>)}
                          <option value="0">非課税 (0%)</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* C8: 取引先（suppliersテーブル連携） */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium">取引先</label>
                      <SearchableSelect
                        value={form.supplierId || ''}
                        onChange={handleSupplierChange}
                        options={suppliers.map(s => ({ id: s.id, name: s.name, code: s.code || undefined, name_kana: s.name_kana }))}
                        placeholder="取引先を検索"
                      />
                    </div>

                    {/* 摘要 */}
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-medium">摘要</label>
                      <input type="text" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="摘要を入力" className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* 事業用/プライベート/ルール追加 */}
                  <div className="border border-gray-200 rounded-lg p-3 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-1">
                        <button onClick={() => setBusiness(true)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                          事業用
                        </button>
                        <button onClick={() => setBusiness(false)}
                          className={`px-3 py-1 text-sm rounded-md transition-colors ${!form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                          プライベート
                        </button>
                      </div>
                      <button onClick={toggleExclude}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${form.isExcluded ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        <Ban size={14} />{form.isExcluded ? '対象外を解除' : '対象外にする'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={addRule} onChange={e => setAddRule(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">ルール追加</span>
                      </label>
                      {addRule && (
                        <select value={ruleIndustryId} onChange={e => setRuleIndustryId(e.target.value)}
                          className="border border-gray-300 rounded-md p-1.5 text-sm bg-white">
                          <option value="">共通ルール</option>
                          {industries.map(ind => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>

                  {currentItem.entryId && (
                    <div className="text-xs text-gray-400 text-right">仕訳ID: {currentItem.entryId.slice(0, 8)}...</div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}