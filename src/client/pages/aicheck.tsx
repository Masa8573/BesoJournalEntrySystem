import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit2, Save, X, AlertCircle, Loader, ShieldCheck, HelpCircle, Trash2, Square, CheckSquare } from 'lucide-react';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ account_item_id?: string; tax_category_id?: string; amount?: number; notes?: string }>({});
  // チェックボックス選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, [currentWorkflow]);

  // ============================================
  // データ読み込み
  // ============================================
  const loadData = async () => {
    if (!currentWorkflow) return;
    setLoading(true);
    setLoadError(null);
    setSelectedIds(new Set());

    const clientId = currentWorkflow.clientId;

    const { data: docs, error: docsError } = await supabase
      .from('documents').select('id')
      .eq('workflow_id', currentWorkflow.id).eq('client_id', clientId);

    if (docsError) {
      setLoadError(`ドキュメント取得失敗: ${docsError.message} (code: ${docsError.code})`);
      setLoading(false);
      return;
    }

    const docIds = docs?.map((d: any) => d.id) || [];
    if (docIds.length === 0) { setEntries([]); setLoading(false); return; }

    const { data: entriesData, error } = await supabase
      .from('journal_entries')
      .select(`
        id, client_id, document_id, entry_date, description, status, notes,
        ai_confidence, ai_generated,
        journal_entry_lines!journal_entry_lines_journal_entry_id_fkey (
          id, line_number, debit_credit, account_item_id, tax_category_id, amount, description
        )
      `)
      .eq('client_id', clientId)
      .in('document_id', docIds)
      .in('status', ['draft', 'pending', 'approved'])
      .order('entry_date', { ascending: true });

    if (error) {
      console.error('仕訳取得エラー:', error);
      setLoadError(`仕訳取得失敗: ${error.message} (code: ${error.code}, hint: ${error.hint || 'なし'})`);
      setLoading(false);
      return;
    }

    const [accountsRes, taxRes] = await Promise.all([accountItemsApi.getAll(), taxCategoriesApi.getAll()]);
    const accts = accountsRes.data || [];
    const taxCats = taxRes.data || [];
    setAccountItems(accts);
    setTaxCategories(taxCats);

    const accountMap = new Map(accts.map(a => [a.id, a.name]));
    const taxCatMap = new Map(taxCats.map(t => [t.id, t.display_name || t.name]));

    if (entriesData) {
      setEntries(entriesData.map((entry: any) => {
        const lines = entry.journal_entry_lines || [];
        const debitLine = lines.find((l: any) => l.debit_credit === 'debit') || lines[0];
        return {
          ...entry,
          lines,
          accountItemName: debitLine?.account_item_id ? accountMap.get(debitLine.account_item_id) || '-' : '-',
          taxCategoryName: debitLine?.tax_category_id ? taxCatMap.get(debitLine.tax_category_id) || '-' : '-',
          amount: debitLine?.amount,
        };
      }));
    }
    setLoading(false);
  };

  // ============================================
  // 編集
  // ============================================
  const handleEdit = (entry: EntryRow) => {
    setEditingId(entry.id);
    const debitLine = entry.lines.find(l => l.debit_credit === 'debit') || entry.lines[0];
    setEditForm({ account_item_id: debitLine?.account_item_id, tax_category_id: debitLine?.tax_category_id, amount: debitLine?.amount, notes: entry.notes });
  };

  const handleSave = async (entry: EntryRow) => {
    await supabase.from('journal_entries').update({ notes: editForm.notes }).eq('id', entry.id);
    const debitLine = entry.lines.find(l => l.debit_credit === 'debit') || entry.lines[0];
    if (debitLine) {
      await supabase.from('journal_entry_lines').update({ account_item_id: editForm.account_item_id, tax_category_id: editForm.tax_category_id, amount: editForm.amount }).eq('id', debitLine.id);
    }
    // 承認履歴
    await insertApprovalLog(entry.id, 'approved', '編集保存');
    await loadData();
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => { setEditingId(null); setEditForm({}); };

  // ============================================
  // 単発アクション
  // ============================================
  const handleApprove = async (id: string) => {
    await supabase.from('journal_entries').update({ status: 'approved' }).eq('id', id);
    await insertApprovalLog(id, 'approved');
    await loadData();
  };

  const handleMarkReview = async (_id: string) => {
    alert('「要確認」機能を使うには、先にDBマイグレーション（requires_reviewカラム追加）を実行してください。');
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('この仕訳を削除しますか？')) return;
    await supabase.from('journal_entries').delete().eq('id', id);
    await loadData();
  };

  // ============================================
  // 一括アクション
  // ============================================
  const handleBulkApprove = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length}件を一括承認しますか？`)) return;
    await supabase.from('journal_entries').update({ status: 'approved' }).in('id', ids);
    for (const id of ids) await insertApprovalLog(id, 'approved', '一括承認');
    await loadData();
  };

  const handleBulkMarkReview = async () => {
    alert('「要確認」機能を使うには、先にDBマイグレーション（requires_reviewカラム追加）を実行してください。');
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length}件を一括削除しますか？この操作は取り消せません。`)) return;
    await supabase.from('journal_entries').delete().in('id', ids);
    await loadData();
  };

  // ============================================
  // 承認履歴記録
  // ============================================
  const insertApprovalLog = async (entryId: string, status: string, comments?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('journal_entry_approvals').insert({
      journal_entry_id: entryId,
      approver_id: user.id,
      approval_status: status,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      comments: comments || null,
    }).then(({ error }) => { if (error) console.warn('承認履歴記録エラー:', error.message); });
  };

  // ============================================
  // チェックボックス
  // ============================================
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === entries.length ? new Set() : new Set(entries.map(e => e.id)));
  };

  // ============================================
  // 次へ（強制承認なし）
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    const draftCount = entries.filter(e => e.status === 'draft' || e.status === 'pending').length;
    if (draftCount > 0) {
      const ok = window.confirm(`未承認の仕訳が${draftCount}件あります。\n\n仕訳確認ページに持ち越して個別に確認できます。\n次に進みますか？`);
      if (!ok) return false;
    }
    updateWorkflowData({ aiCheckStatus: 'completed' } as any);
    return true;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return `¥${Number(amount).toLocaleString()}`;
  };

  // ============================================
  // ガード
  // ============================================
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

  // ステータス集計
  const approvedCount = entries.filter(e => e.status === 'approved').length;
  const draftCount = entries.filter(e => e.status === 'draft' || e.status === 'pending').length;
  const reviewCount = entries.filter(e => e.ai_confidence != null && e.ai_confidence < 0.7).length;
  const lowConfCount = entries.filter(e => e.ai_confidence != null && e.ai_confidence < 0.7).length;
  const allSelected = entries.length > 0 && selectedIds.size === entries.length;

  // 状態バッジ
  const getStatusBadge = (entry: EntryRow) => {
    if (entry.status === 'approved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} />承認済</span>;
    if (entry.ai_confidence != null && entry.ai_confidence < 0.7) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle size={12} />低信頼度</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><Edit2 size={12} />未承認</span>;
  };

  return (
    <div className="flex flex-col h-screen">
      <WorkflowHeader onBeforeNext={handleBeforeNext} nextLabel="仕訳確認へ" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ヘッダー */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AIチェック</h1>
              <p className="text-sm text-gray-500 mt-1">AIが生成した仕訳を確認してください。未承認の仕訳は仕訳確認に持ち越せます。</p>
            </div>
          </div>

          {/* エラー */}
          {loadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-900">データ読み込みエラー</h3>
                  <p className="text-sm text-red-700 mt-1 font-mono break-all">{loadError}</p>
                  <button onClick={loadData} className="mt-3 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">再読み込み</button>
                </div>
              </div>
            </div>
          )}

          {/* サマリー */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card py-3">
              <div className="text-xs text-gray-500">全件数</div>
              <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
            </div>
            <div className="card py-3">
              <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} />承認済み</div>
              <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            </div>
            <div className="card py-3">
              <div className="text-xs text-gray-500 flex items-center gap-1"><Edit2 size={12} />未承認</div>
              <div className="text-2xl font-bold text-yellow-600">{draftCount}</div>
            </div>
            <div className="card py-3">
              <div className="text-xs text-orange-600 flex items-center gap-1"><HelpCircle size={12} />要確認</div>
              <div className="text-2xl font-bold text-orange-600">{reviewCount}</div>
            </div>
            <div className="card py-3">
              <div className="text-xs text-yellow-600 flex items-center gap-1"><AlertCircle size={12} />低信頼度</div>
              <div className="text-2xl font-bold text-yellow-500">{lowConfCount}</div>
            </div>
          </div>

          {/* 一括操作バー */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">{selectedIds.size}件を選択中</span>
              <div className="flex items-center gap-2">
                <button onClick={handleBulkApprove} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
                  <CheckCircle size={14} />一括承認
                </button>
                <button onClick={handleBulkMarkReview} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600">
                  <HelpCircle size={14} />要確認に
                </button>
                <button onClick={handleBulkDelete} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
                  <Trash2 size={14} />削除
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">選択解除</button>
              </div>
            </div>
          )}

          {/* 仕訳テーブル */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">仕訳一覧</h2>
            {entries.length === 0 && !loadError ? (
              <div className="text-center py-12">
                <AlertCircle size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium text-gray-600 mb-2">仕訳データがありません</p>
                <p className="text-sm text-gray-500">OCR処理で仕訳が生成されていません。前のステップに戻ってください。</p>
              </div>
            ) : entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left">
                        <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">
                          {allSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                        </button>
                      </th>
                      {['取引日', '摘要', '勘定科目', '税区分', '金額', '信頼度', '状態', '操作'].map((h, i) => (
                        <th key={h} className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entries.map((entry) => {
                      const isEditing = editingId === entry.id;
                      const isSelected = selectedIds.has(entry.id);
                      const rowBg = entry.status === 'approved' ? 'bg-green-50/50' : (entry.ai_confidence != null && entry.ai_confidence < 0.7) ? 'bg-yellow-50/50' : '';

                      return (
                        <tr key={entry.id} className={`hover:bg-gray-50 ${rowBg}`}>
                          <td className="px-3 py-3">
                            <button onClick={() => toggleSelect(entry.id)} className="text-gray-400 hover:text-blue-600">
                              {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">{new Date(entry.entry_date).toLocaleDateString('ja-JP')}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 max-w-[180px] truncate">{entry.description || '-'}</td>
                          <td className="px-3 py-3 text-sm">
                            {isEditing ? (
                              <select value={editForm.account_item_id || ''} onChange={e => setEditForm({ ...editForm, account_item_id: e.target.value })} className="input text-sm py-1">
                                <option value="">選択</option>{accountItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                              </select>
                            ) : <span className="text-gray-900">{entry.accountItemName || '-'}</span>}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {isEditing ? (
                              <select value={editForm.tax_category_id || ''} onChange={e => setEditForm({ ...editForm, tax_category_id: e.target.value })} className="input text-sm py-1">
                                <option value="">選択</option>{taxCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>)}
                              </select>
                            ) : <span className="text-gray-900">{entry.taxCategoryName || '-'}</span>}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {isEditing ? <input type="number" value={editForm.amount || ''} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) })} className="input text-sm py-1 w-24" />
                              : <span className="font-medium text-gray-900">{formatCurrency(entry.amount)}</span>}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {entry.ai_confidence != null ? (
                              <span className={`text-xs font-medium ${entry.ai_confidence >= 0.8 ? 'text-green-600' : entry.ai_confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {Math.round(entry.ai_confidence * 100)}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm">{getStatusBadge(entry)}</td>
                          <td className="px-3 py-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => handleSave(entry)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="保存"><Save size={16} /></button>
                                <button onClick={handleCancel} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="キャンセル"><X size={16} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-0.5">
                                {entry.status !== 'approved' && (
                                  <button onClick={() => handleApprove(entry.id)} className="p-1 text-green-600 hover:bg-green-50 rounded" title="承認"><CheckCircle size={16} /></button>
                                )}
                                <button onClick={() => handleMarkReview(entry.id)} className="p-1 rounded text-orange-400 hover:bg-orange-50" title="要確認"><HelpCircle size={16} /></button>
                                <button onClick={() => handleEdit(entry)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="編集"><Edit2 size={16} /></button>
                                <button onClick={() => handleReject(entry.id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="削除"><XCircle size={16} /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {/* ガイド */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">操作ガイド</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>チェックボックスで複数選択 → 一括承認・要確認・削除が可能</li>
              <li>「要確認」マークは仕訳確認ページでフィルタ表示できます</li>
              <li>未承認の仕訳はそのまま仕訳確認に持ち越して、1件ずつ確認できます</li>
              <li>信頼度が70%未満の仕訳は黄色で表示されています</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}