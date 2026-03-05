import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit2, Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/client/lib/supabase';
import { accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import { useWorkflow } from '@/client/context/WorkflowContext';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';
import type { AccountItem, TaxCategory } from '@/types';

// journal_entries テーブルのローカル型（api.ts の JournalEntry 型と合わせる）
interface JournalEntryRow {
  id: string;
  client_id: string;
  document_id?: string;
  entry_date: string;
  description?: string;
  status: string;
  notes?: string;
  ai_confidence?: number;
  // journal_entry_lines JOIN
  journal_entry_lines?: JournalEntryLine[];
}

interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  line_number: number;
  debit_credit: 'debit' | 'credit';
  account_item_id?: string;
  tax_category_id?: string;
  amount?: number;
  description?: string;
  // relations
  account_item?: AccountItem;
  tax_category?: TaxCategory;
}

// 画面表示用の統合型
interface EntryWithLines extends JournalEntryRow {
  // 表示用フラット項目（単一仕訳用のプロキシ）
  account_item_name?: string;
  tax_category_name?: string;
  amount?: number;
}

export default function AiCheckPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [entries, setEntries] = useState<EntryWithLines[]>([]);
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

    // journal_entries + lines を取得（pending ステータスのみ）
    const { data: entriesData, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_entry_lines (
          *,
          account_item:account_items(*),
          tax_category:tax_categories(*)
        )
      `)
      .eq('client_id', clientId)
      .eq('status', 'draft')
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('仕訳取得エラー:', error);
    }

    if (entriesData) {
      // 表示用にフラット化
      const flatEntries: EntryWithLines[] = entriesData.map((entry: any) => {
        const debitLine = entry.journal_entry_lines?.find((l: any) => l.debit_credit === 'debit')
          ?? entry.journal_entry_lines?.[0];
        return {
          ...entry,
          account_item_name: debitLine?.account_item?.name,
          tax_category_name: debitLine?.tax_category?.name,
          amount: debitLine?.amount,
        };
      });
      setEntries(flatEntries);
    }

    // マスタデータ取得
    const [accountsRes, taxRes] = await Promise.all([
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);

    if (accountsRes.data) setAccountItems(accountsRes.data);
    if (taxRes.data) setTaxCategories(taxRes.data);

    setLoading(false);
  };

  // ============================================
  // 編集
  // ============================================
  const handleEdit = (entry: EntryWithLines) => {
    setEditingId(entry.id);
    const firstLine = entry.journal_entry_lines?.[0];
    setEditForm({
      account_item_id: firstLine?.account_item_id,
      tax_category_id: firstLine?.tax_category_id,
      amount: firstLine?.amount,
      notes: entry.notes,
    });
  };

  const handleSave = async (entry: EntryWithLines) => {
    // journal_entries の notes を更新
    await supabase
      .from('journal_entries')
      .update({ notes: editForm.notes })
      .eq('id', entry.id);

    // 最初の line を更新
    const firstLine = entry.journal_entry_lines?.[0];
    if (firstLine) {
      await supabase
        .from('journal_entry_lines')
        .update({
          account_item_id: editForm.account_item_id,
          tax_category_id: editForm.tax_category_id,
          amount: editForm.amount,
        })
        .eq('id', firstLine.id);
    }

    await loadData();
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  // ============================================
  // 個別承認
  // ============================================
  const handleApprove = async (id: string) => {
    await supabase
      .from('journal_entries')
      .update({ status: 'pending' })  // reviewページで pending をフィルタ
      .eq('id', id);
    await loadData();
  };

  // ============================================
  // 個別削除
  // ============================================
  const handleReject = async (id: string) => {
    if (window.confirm('この仕訳を削除しますか？')) {
      await supabase.from('journal_entries').delete().eq('id', id);
      await loadData();
    }
  };

  // ============================================
  // 一括承認
  // ============================================
  const handleApproveAll = async () => {
    if (window.confirm(`${entries.length}件の仕訳を一括承認しますか？`)) {
      await supabase
        .from('journal_entries')
        .update({ status: 'pending' })  // reviewページで pending をフィルタ
        .in(
          'id',
          entries.map((e) => e.id)
        );
      await loadData();
    }
  };

  // ============================================
  // 次へ進む前の検証
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    if (entries.length > 0) {
      alert('未承認の仕訳があります。すべて承認または削除してください。');
      return false;
    }

    // TODO: デュアルAI実装時にここを有効化する
    // const aiCheckResult = await dualAiCheck(entries)
    // if (aiCheckResult.hasMismatch) {
    //   // 不一致があれば「要レビュー」フラグを立てて次へ進める
    //   updateWorkflowData({ aiCheckHasMismatch: true });
    // }

    // aicheck_status を 'completed' に更新（workflowsテーブルのdataカラムに保存）
    updateWorkflowData({ journalEntries: ['approved'], aiCheckStatus: 'completed' } as any);

    return true;
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return `¥${Number(amount).toLocaleString()}`;
  };

  // ============================================
  // ワークフロー外アクセスガード
  // ============================================
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ワークフローが開始されていません
          </h2>
          <p className="text-gray-600 mb-6">
            AIチェックを行うには、顧客一覧からワークフローを開始してください。
          </p>
          <a href="/clients" className="btn-primary">
            顧客一覧へ戻る
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 進捗バー */}
      <ProgressBar />

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ページヘッダー */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AIチェック</h1>
              <p className="text-sm text-gray-500 mt-1">
                {currentWorkflow.clientName}さん -{' '}
                AIが自動生成した仕訳をレビュー・承認してください
              </p>
            </div>
            {entries.length > 0 && (
              <button onClick={handleApproveAll} className="btn-primary">
                <CheckCircle size={18} className="inline mr-2" />
                一括承認（{entries.length}件）
              </button>
            )}
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-600">確認待ち</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{entries.length}</div>
              <div className="text-xs text-gray-500 mt-1">件</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-600">AI信頼度</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {entries.length > 0
                  ? Math.round(
                      (entries.reduce((sum, e) => sum + (e.ai_confidence || 0.85), 0) /
                        entries.length) *
                        100
                    )
                  : 85}
                %
              </div>
              <div className="text-xs text-gray-500 mt-1">平均</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-600">要確認</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {entries.filter((e) => (e.ai_confidence || 0.85) < 0.7).length}
              </div>
              <div className="text-xs text-gray-500 mt-1">件</div>
            </div>
          </div>

          {/* 仕訳リスト */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">仕訳一覧</h2>

            {entries.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium text-gray-600 mb-2">
                  確認待ちの仕訳はありません
                </p>
                <p className="text-sm text-gray-500">
                  すべての仕訳を承認しました。次のステップに進んでください。
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        取引日
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        摘要
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        勘定科目（借方）
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        税区分
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        金額
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        備考
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        AI信頼度
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entries.map((entry) => {
                      const isEditing = editingId === entry.id;
                      const confidencePct = Math.round((entry.ai_confidence || 0.85) * 100);

                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {new Date(entry.entry_date).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {entry.description || '-'}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {isEditing ? (
                              <select
                                value={editForm.account_item_id || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, account_item_id: e.target.value })
                                }
                                className="input text-sm py-1"
                              >
                                <option value="">選択してください</option>
                                {accountItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-900">
                                {entry.account_item_name || '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {isEditing ? (
                              <select
                                value={editForm.tax_category_id || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, tax_category_id: e.target.value })
                                }
                                className="input text-sm py-1"
                              >
                                <option value="">選択してください</option>
                                {taxCategories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-900">
                                {entry.tax_category_name || '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editForm.amount || ''}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    amount: Number(e.target.value),
                                  })
                                }
                                className="input text-sm py-1 w-32"
                              />
                            ) : (
                              <span className="font-medium text-gray-900">
                                {formatCurrency(entry.amount)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.notes || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, notes: e.target.value })
                                }
                                className="input text-sm py-1"
                                placeholder="備考"
                              />
                            ) : (
                              entry.notes || '-'
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden w-20">
                                <div
                                  className={`h-full ${
                                    confidencePct >= 80
                                      ? 'bg-green-500'
                                      : confidencePct >= 60
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${confidencePct}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium text-gray-700">
                                {confidencePct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleSave(entry)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="保存"
                                >
                                  <Save size={18} />
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="キャンセル"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEdit(entry)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="編集"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleApprove(entry.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="承認"
                                >
                                  <CheckCircle size={18} />
                                </button>
                                <button
                                  onClick={() => handleReject(entry.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="削除"
                                >
                                  <XCircle size={18} />
                                </button>
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

          {/* ヘルプ */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">操作ガイド</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>
                <strong>編集アイコン</strong>: 勘定科目や税区分を修正できます
              </li>
              <li>
                <strong>承認アイコン</strong>: 仕訳を承認して次のステップへ進めます
              </li>
              <li>
                <strong>削除アイコン</strong>: 不要な仕訳を削除します
              </li>
              <li>
                <strong>一括承認</strong>: すべての仕訳をまとめて承認できます
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <WorkflowNavigation onBeforeNext={handleBeforeNext} nextLabel="仕訳確認へ" />
    </div>
  );
}