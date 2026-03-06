import { useState, useEffect } from 'react';
import {
  ZoomOut, ZoomIn, RotateCcw, ChevronLeft, ChevronRight,
  ChevronDown, Ban, AlertCircle, Loader, CheckCircle, Save
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';
import type { AccountItem, TaxCategory } from '@/types';

// ============================================
// 型定義
// ============================================
interface DocumentWithEntry {
  // documents
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
  // journal_entry_lines (最初の1行 = 借方)
  lineId: string | null;
  accountItemId: string;
  taxCategoryId: string;
  lineAmount: number;
  taxRate: number | null;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  // 編集フォームの状態（現在表示中の1件分）
  const [form, setForm] = useState<Partial<DocumentWithEntry>>({});

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

    // このワークフローの documents を取得
    const { data: docs } = await supabase
      .from('documents')
      .select('id, file_name, original_file_name, storage_path, file_path, supplier_name, document_date, amount, tax_amount')
      .eq('workflow_id', currentWorkflow.id)
      .eq('client_id', clientId)
      .order('created_at');

    if (!docs || docs.length === 0) {
      setLoading(false);
      return;
    }

    // journal_entries + lines を取得
    const { data: entries } = await supabase
      .from('journal_entries')
      .select(`
        id, entry_date, description, status, is_excluded,
        document_id,
        journal_entry_lines (
          id, debit_credit, account_item_id, tax_category_id, amount, tax_rate,
          account_item:account_items!journal_entry_lines_account_item_id_fkey(id, name),
          tax_category:tax_categories!journal_entry_lines_tax_category_id_fkey(id, name)
        )
      `)
      .eq('client_id', clientId)
      .eq('workflow_id', currentWorkflow.id)
      .in('status', ['pending', 'approved', 'draft']);

    // docs と entries をマージ
    const merged: DocumentWithEntry[] = await Promise.all(
      docs.map(async (doc: any) => {
        // Storage 署名付きURL取得
        const path = doc.storage_path || doc.file_path || '';
        let imageUrl: string | null = null;
        if (path) {
          const { data: urlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(path, 3600);
          imageUrl = urlData?.signedUrl || null;
        }

        // 対応する仕訳を探す
        const entry = entries?.find((e: any) => e.document_id === doc.id);
        // 借方行を優先、なければ最初の行
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
          description: entry?.description || '',
          status: entry?.status || 'pending',
          isExcluded: entry?.is_excluded || false,
          isBusiness: !entry?.is_excluded,
          lineId: debitLine?.id || null,
          accountItemId: debitLine?.account_item_id || '',
          taxCategoryId: debitLine?.tax_category_id || '',
          lineAmount: debitLine?.amount || doc.amount || 0,
          taxRate: debitLine?.tax_rate || null,
        } as DocumentWithEntry;
      })
    );

    setItems(merged);
    if (merged.length > 0) setForm({ ...merged[0] });

    // マスタ取得
    const [accountsRes, taxRes] = await Promise.all([
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);
    if (accountsRes.data) setAccountItems(accountsRes.data);
    if (taxRes.data) setTaxCategories(taxRes.data);

    setLoading(false);
  };

  // ============================================
  // 証憑切り替え（保存してから移動）
  // ============================================
  const switchTo = async (nextIndex: number) => {
    await saveCurrentItem();
    setCurrentIndex(nextIndex);
    setForm({ ...items[nextIndex] });
    setSavedAt(null);
  };

  // ============================================
  // 現在の仕訳を保存
  // ============================================
  const saveCurrentItem = async () => {
    const item = items[currentIndex];
    if (!item || !form.entryId) return;

    setSaving(true);

    // journal_entries 更新
    await supabase
      .from('journal_entries')
      .update({
        entry_date: form.entryDate,
        description: form.description,
        is_excluded: form.isExcluded,
        status: form.isExcluded ? 'draft' : 'approved',
      })
      .eq('id', form.entryId);

    // journal_entry_lines 更新（借方行）
    if (form.lineId) {
      await supabase
        .from('journal_entry_lines')
        .update({
          account_item_id: form.accountItemId,
          tax_category_id: form.taxCategoryId,
          amount: form.lineAmount,
        })
        .eq('id', form.lineId);
    }

    // items ステートも更新
    setItems(prev => prev.map((it, i) => i === currentIndex ? { ...it, ...form } as DocumentWithEntry : it));
    setSaving(false);
    setSavedAt(new Date().toLocaleTimeString('ja-JP'));
  };

  // ============================================
  // 対象外トグル
  // ============================================
  const toggleExclude = () => {
    setForm(prev => ({ ...prev, isExcluded: !prev.isExcluded, isBusiness: prev.isExcluded }));
  };

  // ============================================
  // 次へ進む前の検証
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    await saveCurrentItem();
    updateWorkflowData({ reviewCompleted: true });
    return true;
  };

  // ============================================
  // ワークフロー外ガード
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
        <ProgressBar />
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
        <ProgressBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle size={48} className="text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">このワークフローに証憑が見つかりません。</p>
            <p className="text-sm text-gray-400 mt-1">OCR処理ステップを先に完了してください。</p>
          </div>
        </div>
        <WorkflowNavigation onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const totalCount = items.length;
  const approvedCount = items.filter(i => i.status === 'approved' || i.isExcluded).length;

  // ============================================
  // レンダリング
  // ============================================
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <ProgressBar />

      {/* 上部: 件数ナビゲーション */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {totalCount} 件
          </span>
          <div className="flex items-center gap-1">
            <CheckCircle size={14} className="text-green-500" />
            <span className="text-sm text-gray-500">確認済み {approvedCount} 件</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => currentIndex > 0 && switchTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> 前へ
          </button>
          <button
            onClick={() => currentIndex < totalCount - 1 && switchTo(currentIndex + 1)}
            disabled={currentIndex === totalCount - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            次へ <ChevronRight size={14} />
          </button>
          <button
            onClick={saveCurrentItem}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>
          {savedAt && <span className="text-xs text-green-600">{savedAt} 保存済み</span>}
        </div>
      </div>

      {/* メインコンテンツ（2カラム） */}
      <div className="flex-1 p-4 grid grid-cols-2 gap-4 max-w-7xl mx-auto w-full overflow-hidden">

        {/* 左カラム：証憑画像 */}
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
              <img
                src={currentItem.imageUrl}
                alt={currentItem.fileName}
                style={{ width: `${zoom}%`, maxWidth: 'none' }}
                className="rounded shadow-sm border border-gray-200 object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <AlertCircle size={40} />
                <span className="text-sm">画像を読み込めませんでした</span>
                <span className="text-xs text-gray-300">{currentItem.storagePath}</span>
              </div>
            )}
          </div>
        </div>

        {/* 右カラム：仕訳データ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-bold text-sm">仕訳データ</h2>
              <p className="text-xs text-gray-400">{currentWorkflow.clientName}</p>
            </div>
            {currentItem.status === 'approved' && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle size={12} /> 承認済み
              </span>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">

            {/* 対象外バナー */}
            {form.isExcluded && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
                <Ban size={16} />
                この証憑は対象外に設定されています
              </div>
            )}

            {/* フォーム */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">

              {/* 取引日 */}
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>取引日
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={form.entryDate || ''}
                    onChange={e => setForm(p => ({ ...p, entryDate: e.target.value }))}
                    className="w-full border border-blue-200 bg-blue-50/30 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 金額 */}
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>金額（円）
                </label>
                <input
                  type="number"
                  value={form.lineAmount || ''}
                  onChange={e => setForm(p => ({ ...p, lineAmount: Number(e.target.value) }))}
                  className="w-full border border-green-200 bg-green-50/30 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 勘定科目 */}
              <div className="space-y-1">
                <label className="text-xs font-medium">勘定科目</label>
                <div className="relative">
                  <select
                    value={form.accountItemId || ''}
                    onChange={e => setForm(p => ({ ...p, accountItemId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md p-2 pr-7 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- 選択 --</option>
                    {accountItems.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 税区分 */}
              <div className="space-y-1">
                <label className="text-xs font-medium">税区分</label>
                <div className="relative">
                  <select
                    value={form.taxCategoryId || ''}
                    onChange={e => setForm(p => ({ ...p, taxCategoryId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md p-2 pr-7 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- 選択 --</option>
                    {taxCategories.map(t => (
                      <option key={t.id} value={t.id}>{t.display_name || t.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 摘要 */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-medium">摘要</label>
                <input
                  type="text"
                  value={form.description || ''}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="摘要を入力"
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 事業用 / 対象外 */}
            <div className="mt-auto border border-gray-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-1">
                <button
                  onClick={() => setForm(p => ({ ...p, isBusiness: true, isExcluded: false }))}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  事業用
                </button>
                <button
                  onClick={() => setForm(p => ({ ...p, isBusiness: false, isExcluded: false }))}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${!form.isBusiness && !form.isExcluded ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  プライベート
                </button>
              </div>

              <button
                onClick={toggleExclude}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  form.isExcluded
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Ban size={14} />
                {form.isExcluded ? '対象外を解除' : '対象外にする'}
              </button>
            </div>

            {/* AI信頼度 */}
            {currentItem.entryId && (
              <div className="text-xs text-gray-400 text-right">
                仕訳ID: {currentItem.entryId.slice(0, 8)}...
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkflowNavigation onBeforeNext={handleBeforeNext} nextLabel="仕訳出力へ" />
    </div>
  );
}