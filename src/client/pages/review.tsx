import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit2, Save, X } from 'lucide-react';
import { journalEntriesApi, accountItemsApi, taxCategoriesApi } from '@/client/lib/api';
import type { JournalEntry, AccountItem, TaxCategory } from '@/types';

interface JournalEntryWithRelations extends JournalEntry {
  account_item?: AccountItem;
  tax_category?: TaxCategory;
}

export default function ReviewPage() {
  const [entries, setEntries] = useState<JournalEntryWithRelations[]>([]);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<JournalEntry>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [entriesRes, accountsRes, taxRes] = await Promise.all([
      journalEntriesApi.getAll(),
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);

    if (entriesRes.data) {
      // pending（確認待ち）のみ表示
      const pendingEntries = (entriesRes.data as any).filter(
        (e: JournalEntry) => e.status === 'pending'
      );
      setEntries(pendingEntries);
    }
    if (accountsRes.data) setAccountItems(accountsRes.data);
    if (taxRes.data) setTaxCategories(taxRes.data);
    setLoading(false);
  };

  const handleEdit = (entry: JournalEntryWithRelations) => {
    setEditingId(entry.id);
    setEditForm({
      account_item_id: entry.account_item_id,
      tax_category_id: entry.tax_category_id,
      amount: entry.amount,
      notes: entry.notes,
    });
  };

  const handleSave = async (id: string) => {
    const response = await journalEntriesApi.update(id, editForm);
    if (response.data) {
      await loadData();
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleApprove = async (id: string) => {
    const response = await journalEntriesApi.update(id, { status: 'approved' });
    if (response.data) {
      await loadData();
    }
  };

  const handleReject = async (id: string) => {
    if (window.confirm('この仕訳を削除しますか？')) {
      await journalEntriesApi.delete(id);
      await loadData();
    }
  };

  const handleApproveAll = async () => {
    if (window.confirm(`${entries.length}件の仕訳を一括承認しますか？`)) {
      await Promise.all(
        entries.map((entry) => journalEntriesApi.update(entry.id, { status: 'approved' }))
      );
      await loadData();
    }
  };

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

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
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仕訳確認（AIチェック）</h1>
          <p className="text-sm text-gray-500 mt-1">
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
          <div className="text-3xl font-bold text-gray-900">85%</div>
          <div className="text-xs text-gray-500 mt-1">平均</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <h3 className="text-sm font-medium text-gray-600">要確認</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>
      </div>

      {/* 仕訳リスト */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">仕訳一覧</h2>

        {entries.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-600 mb-2">確認待ちの仕訳はありません</p>
            <p className="text-sm text-gray-500">
              新しい証憑がアップロードされると、ここに表示されます
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
                    取引先
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    勘定科目
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

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {new Date(entry.entry_date).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {entry.supplier || '-'}
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
                            {entry.account_item?.name || '-'}
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
                            {entry.tax_category?.name || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.amount || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, amount: Number(e.target.value) })
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
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: '85%' }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium text-gray-700">85%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSave(entry.id)}
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
  );
}