import { useState, useEffect } from 'react';
import {
  ZoomOut, ZoomIn, RotateCcw, ChevronLeft, ChevronRight,
  ChevronDown, Ban, AlertCircle, Loader, CheckCircle, Save, Plus
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';
import type { AccountItem, TaxCategory, Tag } from '@/types';

// ============================================
// 型定義
// ============================================
interface DocumentWithEntry {
  docId: string;
  fileName: string;
  storagePath: string;
  imageUrl: string | null;
  supplierName: string | null;
  documentDate: string | null;
  amount: number | null;
  taxAmount: number | null;
  // journal_entry
  entryId: string | null;
  entryDate: string;
  description: string;
  status: string;
  isExcluded: boolean;
  isBusiness: boolean;
  aiConfidence: number | null;
  // journal_entry_lines (借方1行目)
  lineId: string | null;
  accountItemId: string;
  taxCategoryId: string;
  lineAmount: number;
  taxRate: number | null;
  // 追加フィールド
  supplierId: string | null;
  itemId: string | null;
}

interface TaxRateOption {
  id: string;
  rate: number;
  name: string;
}

// ============================================
// review.tsx
// ============================================
export default function ReviewPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();

  const [items, setItems] = useState<DocumentWithEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [supplierTags, setSupplierTags] = useState<Tag[]>([]);
  const [itemTags, setItemTags] = useState<Tag[]>([]);
  const [industries, setIndustries] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  // 編集フォーム
  const [form, setForm] = useState<Partial<DocumentWithEntry>>({});

  // ルール追加
  const [addRule, setAddRule] = useState(false);
  const [ruleIndustryId, setRuleIndustryId] = useState('');

  // ============================================
  // データ読み込み
  // ============================================
  useEffect(() => {
    if (!currentWorkflow) return;
    loadData();
  }, [currentWorkflow]);

  const loadData = async () => {
    if (!currentWorkflow) return;
    setLoading(true);
    const clientId = currentWorkflow.clientId;

    // 1. documents 取得
    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, original_file_name, storage_path, file_path, supplier_name, document_date, amount, tax_amount')
      .eq('workflow_id', currentWorkflow.id)
      .eq('client_id', clientId)
      .order('created_at');

    if (!docs || docs.length === 0) { setLoading(false); return; }

    // 2. journal_entries (document_id IN)
    const docIds = docs.map((d: any) => d.id);
    const { data: entries } = await supabase
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

    // 3. マージ
    const merged: DocumentWithEntry[] = await Promise.all(
      docs.map(async (doc: any) => {
        const path = doc.storage_path || doc.file_path || '';
        let imageUrl: string | null = null;
        if (path) {
          const { data: urlData } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
          imageUrl = urlData?.signedUrl || null;
        }
        const entry = entries?.find((e: any) => e.document_id === doc.id);
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
    if (merged.length > 0) {
      setForm({ ...merged[0] });
      setAddRule(false);
      setRuleIndustryId('');
    }

    // 4. マスタ取得
    const [accountsRes, taxRes] = await Promise.all([
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);
    if (accountsRes.data) setAccountItems(accountsRes.data);
    if (taxRes.data) setTaxCategories(taxRes.data);

    // tax_rates 取得
    const { data: rates } = await supabase
      .from('tax_rates')
      .select('id, rate, name')
      .eq('is_current', true)
      .order('rate', { ascending: false });
    if (rates) setTaxRates(rates.map((r: any) => ({ id: r.id, rate: Number(r.rate), name: r.name })));

    // タグ取得
    const { data: tags } = await supabase
      .from('tags')
      .select('*')
      .eq('is_active', true)
      .in('tag_type', ['supplier', 'item'])
      .order('name');
    if (tags) {
      setSupplierTags(tags.filter((t: any) => t.tag_type === 'supplier'));
      setItemTags(tags.filter((t: any) => t.tag_type === 'item'));
    }

    // 業種取得（ルール追加用）
    const { data: inds } = await supabase.from('industries').select('id, name').eq('is_active', true).order('sort_order');
    if (inds) setIndustries(inds);

    setLoading(false);
  };

  // ============================================
  // 証憑切り替え
  // ============================================
  const switchTo = async (nextIndex: number) => {
    await saveCurrentItem();
    setCurrentIndex(nextIndex);
    setForm({ ...items[nextIndex] });
    setSavedAt(null);
    setAddRule(false);
    setRuleIndustryId('');
  };

  // ============================================
  // 保存
  // ============================================
  const saveCurrentItem = async () => {
    const item = items[currentIndex];
    if (!item || !form.entryId) return;
    setSaving(true);

    // journal_entries 更新
    await supabase.from('journal_entries').update({
      entry_date: form.entryDate,
      description: form.description,
      is_excluded: form.isExcluded,
      status: form.isExcluded ? 'draft' : 'approved',
    }).eq('id', form.entryId);

    // journal_entry_lines 更新
    if (form.lineId) {
      await supabase.from('journal_entry_lines').update({
        account_item_id: form.accountItemId || null,
        tax_category_id: form.taxCategoryId || null,
        tax_rate: form.taxRate || null,
        amount: form.lineAmount,
      }).eq('id', form.lineId);
    }

    // ルール追加
    if (addRule && form.accountItemId) {
      const ruleData = {
        rule_name: `${form.description || item.supplierName || '不明'} → 自動仕訳`,
        priority: 100,
        rule_type: '支出' as const,
        scope: ruleIndustryId ? 'industry' as const : 'shared' as const,
        industry_id: ruleIndustryId || null,
        conditions: {
          supplier_pattern: item.supplierName || null,
        },
        actions: {
          account_item_id: form.accountItemId || null,
          tax_category_id: form.taxCategoryId || null,
          description_template: form.description || null,
        },
        auto_apply: true,
        require_confirmation: false,
        is_active: true,
      };
      const { error } = await supabase.from('processing_rules').insert([ruleData]);
      if (error) console.error('ルール追加エラー:', error);
    }

    setItems(prev => prev.map((it, i) => i === currentIndex ? { ...it, ...form } as DocumentWithEntry : it));
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('ja-JP'));
  };

  // ============================================
  // 事業用/プライベート切り替え
  // ============================================
  const setBusiness = (isBusiness: boolean) => {
    if (!isBusiness) {
      // プライベート → 事業主貸に自動切替
      const jigyounushiKashi = accountItems.find(a => a.name === '事業主貸');
      setForm(p => ({
        ...p,
        isBusiness: false,
        isExcluded: false,
        accountItemId: jigyounushiKashi?.id || p.accountItemId,
      }));
    } else {
      setForm(p => ({ ...p, isBusiness: true, isExcluded: false }));
    }
  };

  const toggleExclude = () => {
    setForm(prev => ({ ...prev, isExcluded: !prev.isExcluded, isBusiness: prev.isExcluded }));
  };

  // ============================================
  // 税区分をグループ化
  // ============================================
  const groupedTaxCategories = (() => {
    const groups: Record<string, TaxCategory[]> = {};
    taxCategories.forEach(tc => {
      const group = tc.direction || 'その他';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tc);
    });
    return groups;
  })();

  // ============================================
  // 次へ
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    await saveCurrentItem();
    updateWorkflowData({ reviewCompleted: true });
    return true;
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

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle size={48} className="text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">証憑が見つかりません。OCR処理を先に完了してください。</p>
          </div>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const totalCount = items.length;
  const approvedCount = items.filter(i => i.status === 'approved' || i.isExcluded).length;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* ワークフローヘッダー */}
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />

      {/* 証憑ナビゲーション */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{currentIndex + 1} / {totalCount} 件</span>
          <div className="flex items-center gap-1">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm text-gray-500">確認済み {approvedCount} 件</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => currentIndex > 0 && switchTo(currentIndex - 1)} disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft size={14} /> 前へ
          </button>
          <button onClick={() => currentIndex < totalCount - 1 && switchTo(currentIndex + 1)} disabled={currentIndex === totalCount - 1}
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

        {/* 左：証憑画像 */}
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
              <img src={currentItem.imageUrl} alt={currentItem.fileName} style={{ width: `${zoom}%`, maxWidth: 'none' }} className="rounded shadow-sm border border-gray-200 object-contain" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <AlertCircle size={40} /><span className="text-sm">画像を読み込めませんでした</span>
              </div>
            )}
          </div>
        </div>

        {/* 右：仕訳データ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <h2 className="font-bold text-sm">仕訳データ</h2>
            {currentItem.aiConfidence != null && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                currentItem.aiConfidence >= 0.8 ? 'bg-green-50 text-green-600' : currentItem.aiConfidence >= 0.5 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
              }`}>AI信頼度 {Math.round(currentItem.aiConfidence * 100)}%</span>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto">
            {/* 対象外バナー */}
            {form.isExcluded && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <Ban size={16} />この証憑は対象外に設定されています
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

              {/* 勘定科目 */}
              <div className="space-y-1">
                <label className="text-xs font-medium">勘定科目</label>
                <div className="relative">
                  <select value={form.accountItemId || ''} onChange={e => setForm(p => ({ ...p, accountItemId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md p-2 pr-7 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">-- 選択 --</option>
                    {accountItems.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 税区分（direction グループ化） */}
              <div className="space-y-1">
                <label className="text-xs font-medium">税区分</label>
                <div className="relative">
                  <select value={form.taxCategoryId || ''} onChange={e => {
                    const tc = taxCategories.find(t => t.id === e.target.value);
                    // 税区分選択時に税率も自動セット（対応するtax_rateがあれば）
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

              {/* 取引先タグ */}
              <div className="space-y-1">
                <label className="text-xs font-medium">取引先タグ</label>
                <div className="relative">
                  <select value="" onChange={e => { /* TODO: タグ紐付け処理 */ }}
                    className="w-full border border-gray-300 rounded-md p-2 pr-7 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">-- 選択 --</option>
                    {supplierTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 摘要 */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">摘要</label>
                <input type="text" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="摘要を入力" className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* 事業用 / プライベート / ルール追加 */}
            <div className="border border-gray-200 rounded-lg p-3 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                {/* 事業用/プライベート */}
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

                {/* 対象外 */}
                <button onClick={toggleExclude}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    form.isExcluded ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Ban size={14} />{form.isExcluded ? '対象外を解除' : '対象外にする'}
                </button>
              </div>

              {/* ルール追加チェックボックス + 業種セレクト */}
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

            {/* 仕訳ID */}
            {currentItem.entryId && (
              <div className="text-xs text-gray-400 text-right">
                仕訳ID: {currentItem.entryId.slice(0, 8)}...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}