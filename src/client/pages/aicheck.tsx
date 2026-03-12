import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit2, Save, X, AlertCircle, Loader, ShieldCheck } from 'lucide-react';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import { useWorkflow } from '@/client/context/WorkflowContext';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';
import type { AccountItem, TaxCategory } from '@/types';

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
  // 表示用フラット
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
}

export default function AiCheckPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    account_item_id?: string;
    tax_category_id?: string;
    amount?: number;
    notes?: string;
  }>({});

  useEffect(() => {
    loadData();
  }, [currentWorkflow]);

  // ============================================
  // データ読み込み
  // ============================================
  const loadData = async () => {
    if (!currentWorkflow) return;
    setLoading(true);

    const clientId = currentWorkflow.clientId;

    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .eq('workflow_id', currentWorkflow.id)
      .eq('client_id', clientId);

    const docIds = docs?.map((d: any) => d.id) || [];

    if (docIds.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // -------------------------------------------------------
    // 修正: account_items/tax_categories へのネストJOINを排除
    // → journal_entry_lines の ID だけ取得し、
    //   マスタデータはフロントでマッピングする方式に変更
    // これにより PostgREST の "ambiguous relationship" 400 エラーを回避
    // -------------------------------------------------------
    const { data: entriesData, error } = await supabase
      .from('journal_entries')
      .select(`
        id, client_id, document_id, entry_date, description, status, notes, ai_confidence, ai_generated, requires_review,
        journal_entry_lines (
          id, line_number, debit_credit, account_item_id, tax_category_id, amount, description
        )
      `)
      .eq('client_id', clientId)
      .in('document_id', docIds)
      .in('status', ['draft', 'pending'])
      .order('entry_date', { ascending: true });

    if (error) {
      console.error('仕訳取得エラー:', error);
    }

    // マスタ取得
    const [accountsRes, taxRes] = await Promise.all([
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);
    const accountItemsList = accountsRes.data || [];
    const taxCategoriesList = taxRes.data || [];
    setAccountItems(accountItemsList);
    setTaxCategories(taxCategoriesList);

    // マスタをMapに変換（高速ルックアップ用）
    const accountMap = new Map(accountItemsList.map(a => [a.id, a.name]));
    const taxCatMap = new Map(taxCategoriesList.map(t => [t.id, t.display_name || t.name]));

    if (entriesData) {
      const mapped: EntryRow[] = entriesData.map((entry: any) => {
        const lines = entry.journal_entry_lines || [];
        const debitLine = lines.find((l: any) => l.debit_credit === 'debit') || lines[0];
        return {
          ...entry,
          lines,
          accountItemName: debitLine?.account_item_id ? accountMap.get(debitLine.account_item_id) || '-' : '-',
          taxCategoryName: debitLine?.tax_category_id ? taxCatMap.get(debitLine.tax_category_id) || '-' : '-',
          amount: debitLine?.amount,
        };
      });
      setEntries(mapped);
    }

    setLoading(false);
  };

  // ============================================
  // 編集
  // ============================================
  const handleEdit = (entry: EntryRow) => {
    setEditingId(entry.id);
    const debitLine = entry.lines.find(l => l.debit_credit === 'debit') || entry.lines[0];
    setEditForm({
      account_item_id: debitLine?.account_item_id,
      tax_category_id: debitLine?.tax_category_id,
      amount: debitLine?.amount,
      notes: entry.notes,
    });
  };

  const handleSave = async (entry: EntryRow) => {
    await supabase.from('journal_entries').update({ notes: editForm.notes }).eq('id', entry.id);

    const debitLine = entry.lines.find(l => l.debit_credit === 'debit') || entry.lines[0];
    if (debitLine) {
      await supabase.from('journal_entry_lines').update({
        account_item_id: editForm.account_item_id,
        tax_category_id: editForm.tax_category_id,
        amount: editForm.amount,
      }).eq('id', debitLine.id);
    }

    await loadData();
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => { setEditingId(null); setEditForm({}); };

  const handleApprove = async (id: string) => {
    await supabase.from('journal_entries').update({ status: 'approved' }).eq('id', id);
    await loadData();
  };

  const handleReject = async (id: string) => {
    if (window.confirm('この仕訳を削除しますか？')) {
      await supabase.from('journal_entries').delete().eq('id', id);
      await loadData();
    }
  };

  const handleApproveAll = async () => {
    if (entries.length === 0) return;
    if (!window.confirm(`${entries.length}件の仕訳を一括承認しますか？`)) return;
    await supabase.from('journal_entries').update({ status: 'approved' }).in('id', entries.map(e => e.id));
    await loadData();
  };

  const handleBeforeNext = async (): Promise<boolean> => {
    if (entries.length > 0) {
      const proceed = window.confirm(`未承認の仕訳が${entries.length}件あります。\n\n一括承認して次に進みますか？\n「キャンセル」で戻って個別確認できます。`);
      if (!proceed) return false;
      await supabase.from('journal_entries').update({ status: 'approved' }).in('id', entries.map(e => e.id));
    }
    updateWorkflowData({ aiCheckStatus: 'completed' } as any);
    return true;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return `¥${Number(amount).toLocaleString()}`;
  };

  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">AIチェックを行うには、顧客一覧からワークフローを開始してください。</p>
          <a href="/clients" className="btn-primary">顧客一覧へ戻る</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳確認へ" />
        <div className="flex-1 flex items-center justify-center">
          <Loader size={32} className="animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">データを読み込み中...</span>
        </div>
      </div>
    );
  }

  const reviewCount = entries.filter(e => e.requires_review || (e.ai_confidence && e.ai_confidence < 0.7)).length;

  return (
    <div className="flex flex-col h-screen">
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳確認へ" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AIチェック</h1>
              <p className="text-sm text-gray-500 mt-1">AIが生成した仕訳を確認・承認してください</p>
            </div>
            {entries.length > 0 && (
              <button onClick={handleApproveAll} className="btn-primary">
                <CheckCircle size={18} className="inline mr-2" />一括承認（{entries.length}件）
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><h3 className="text-sm font-medium text-gray-600">確認待ち</h3></div>
              <div className="text-3xl font-bold text-gray-900">{entries.length}</div><div className="text-xs text-gray-500 mt-1">件</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-2"><ShieldCheck size={20} className="text-green-500" /><h3 className="text-sm font-medium text-gray-600">AI生成済み</h3></div>
              <div className="text-3xl font-bold text-gray-900">{entries.filter(e => e.ai_generated).length}</div><div className="text-xs text-gray-500 mt-1">件</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-2"><AlertCircle size={20} className="text-orange-500" /><h3 className="text-sm font-medium text-gray-600">要確認</h3></div>
              <div className="text-3xl font-bold text-gray-900">{reviewCount}</div><div className="text-xs text-gray-500 mt-1">件</div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">仕訳一覧</h2>
            {entries.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={64} className="mx-auto text-green-300 mb-4" />
                <p className="text-lg font-medium text-gray-600 mb-2">確認待ちの仕訳はありません</p>
                <p className="text-sm text-gray-500">すべて承認済みです。「→」キーまたは上部の「仕訳確認へ」で次に進んでください。</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['取引日', '摘要', '勘定科目', '税区分', '金額', '備考', '状態', '操作'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entries.map((entry) => {
                      const isEditing = editingId === entry.id;
                      const needsReview = entry.requires_review || (entry.ai_confidence && entry.ai_confidence < 0.7);
                      return (
                        <tr key={entry.id} className={`hover:bg-gray-50 ${needsReview ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-4 text-sm text-gray-900">{new Date(entry.entry_date).toLocaleDateString('ja-JP')}</td>
                          <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">{entry.description || '-'}</td>
                          <td className="px-4 py-4 text-sm">
                            {isEditing ? (
                              <select value={editForm.account_item_id || ''} onChange={e => setEditForm({ ...editForm, account_item_id: e.target.value })} className="input text-sm py-1">
                                <option value="">選択</option>
                                {accountItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            ) : <span className={needsReview ? 'text-orange-700 font-medium' : 'text-gray-900'}>{entry.accountItemName || '-'}</span>}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {isEditing ? (
                              <select value={editForm.tax_category_id || ''} onChange={e => setEditForm({ ...editForm, tax_category_id: e.target.value })} className="input text-sm py-1">
                                <option value="">選択</option>
                                {taxCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>)}
                              </select>
                            ) : <span className={needsReview ? 'text-orange-700 font-medium' : 'text-gray-900'}>{entry.taxCategoryName || '-'}</span>}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {isEditing ? <input type="number" value={editForm.amount || ''} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })} className="input text-sm py-1 w-28" />
                              : <span className="font-medium text-gray-900">{formatCurrency(entry.amount)}</span>}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {isEditing ? <input type="text" value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="input text-sm py-1" placeholder="備考" />
                              : (entry.notes || '-')}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {needsReview
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle size={12} />要確認</span>
                              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><ShieldCheck size={12} />OK</span>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleSave(entry)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="保存"><Save size={18} /></button>
                                <button onClick={handleCancel} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="キャンセル"><X size={18} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleEdit(entry)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="編集"><Edit2 size={16} /></button>
                                <button onClick={() => handleApprove(entry.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="承認"><CheckCircle size={16} /></button>
                                <button onClick={() => handleReject(entry.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="削除"><XCircle size={16} /></button>
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">操作ガイド</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>黄色の行は要確認の仕訳です（AI信頼度が低い、またはダブルチェックで不一致）</li>
              <li>「一括承認」で全件をまとめて承認し、次のステップへ進めます</li>
              <li>個別に編集・承認・削除も可能です</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}