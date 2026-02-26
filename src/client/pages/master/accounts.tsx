import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, FileText, TrendingUp, TrendingDown, Building, CreditCard, BookOpen } from 'lucide-react';
import { accountItemsApi } from '@/client/lib/mockApi';
import type { AccountItem } from '@/types';
import Modal from '@/client/components/ui/Modal';

export default function AccountsPage() {
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'real_estate'>('general');
  const [activeCategory, setActiveCategory] = useState<'all' | 'income' | 'expense' | 'asset' | 'liability'>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountItem | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '支出',
    tax_category: '課税',
    short_name: '',
  });

  useEffect(() => {
    loadAccountItems();
  }, []);

  const loadAccountItems = async () => {
    setLoading(true);
    const response = await accountItemsApi.getAll();
    if (response.data) {
      setAccountItems(response.data);
    }
    setLoading(false);
  };

  // 新規登録モーダルを開く
  const handleOpenNewModal = () => {
    setEditingItem(null);
    resetForm();
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (item: AccountItem) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      category: item.category,
      tax_category: item.tax_category || '',
      short_name: item.short_name || '',
    });
    setShowModal(true);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemData = {
      ...formData,
      is_default: false,
      industry_id: null,
    };

    if (editingItem) {
      // 編集
      const response = await accountItemsApi.update(editingItem.id, itemData);
      if (response.data) {
        alert('勘定科目を更新しました');
        setShowModal(false);
        setEditingItem(null);
        resetForm();
        loadAccountItems();
      }
    } else {
      // 新規登録
      const response = await accountItemsApi.create(itemData);
      if (response.data) {
        alert('勘定科目を登録しました');
        setShowModal(false);
        resetForm();
        loadAccountItems();
      }
    }
  };

  // 削除処理
  const handleDelete = async (item: AccountItem) => {
    if (!window.confirm(`勘定科目「${item.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const response = await accountItemsApi.delete(item.id);
    if (response.error === null) {
      alert('勘定科目を削除しました');
      loadAccountItems();
    } else {
      alert('削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category: '支出',
      tax_category: '課税',
      short_name: '',
    });
  };

  const filteredItems = accountItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.includes(searchQuery) ||
      (item.short_name && item.short_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeCategory === 'all') return matchesSearch;
    if (activeCategory === 'income') return matchesSearch && item.category === '収入';
    if (activeCategory === 'expense') return matchesSearch && item.category === '支出';
    if (activeCategory === 'asset') return matchesSearch && item.category === '資産';
    if (activeCategory === 'liability') return matchesSearch && item.category === '負債';

    return matchesSearch;
  });

  const getCategoryCount = (category: string) => {
    if (category === 'all') return accountItems.length;
    return accountItems.filter((item) => item.category === category).length;
  };

  const activeCount = accountItems.length; // 実際は is_active フィールドでフィルタ

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
          <h1 className="text-2xl font-bold text-gray-900">勘定科目管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            仕訳で使用する勘定科目を管理します
          </p>
        </div>
        <button onClick={handleOpenNewModal} className="btn-primary">
          <Plus size={18} className="mr-2" />
          新規勘定科目
        </button>
      </div>

      {/* タブ */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'general'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'bg-transparent text-gray-600 hover:bg-gray-50'
          }`}
        >
          一般用
        </button>
        <button
          onClick={() => setActiveTab('real_estate')}
          className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'real_estate'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'bg-transparent text-gray-600 hover:bg-gray-50'
          }`}
        >
          不動産賃貸業用
        </button>
      </div>

      {/* サマリーカード（6枚） */}
      <div className="grid grid-cols-6 gap-4">
        {/* 全科目 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-600">全科目</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{accountItems.length}</div>
        </div>

        {/* 有効 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600">有効</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{activeCount}</div>
        </div>

        {/* 収入 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-600">収入</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('収入')}</div>
        </div>

        {/* 支出 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={20} className="text-red-600" />
            <span className="text-sm font-medium text-gray-600">支出</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('支出')}</div>
        </div>

        {/* 資産 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building size={20} className="text-green-600" />
            <span className="text-sm font-medium text-gray-600">資産</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('資産')}</div>
        </div>

        {/* 負債 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={20} className="text-orange-600" />
            <span className="text-sm font-medium text-gray-600">負債</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('負債')}</div>
        </div>
      </div>

      {/* 勘定科目一覧カード */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* 検索バー＋有効のみ表示トグル */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="科目名、コード、ショートカットで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">有効のみ表示</span>
              <button 
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showActiveOnly ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showActiveOnly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* カテゴリフィルタータブ */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              すべて ({accountItems.length})
            </button>
            <button
              onClick={() => setActiveCategory('income')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === 'income'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              収入 ({getCategoryCount('収入')})
            </button>
            <button
              onClick={() => setActiveCategory('expense')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === 'expense'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              支出 ({getCategoryCount('支出')})
            </button>
            <button
              onClick={() => setActiveCategory('asset')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === 'asset'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              資産 ({getCategoryCount('資産')})
            </button>
            <button
              onClick={() => setActiveCategory('liability')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeCategory === 'liability'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              負債 ({getCategoryCount('負債')})
            </button>
          </div>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  コード
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  科目名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  区分
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  税区分
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  収入相手方
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  支出相手方
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ショートカット
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  知識ベース
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    勘定科目が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {item.category === '資産' && <Building size={14} className="text-gray-500" />}
                        {item.category === '資産' && <CreditCard size={14} className="text-gray-500" />}
                        <span className="text-sm text-gray-600">{item.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.tax_category || '対象外'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">事業主借</td>
                    <td className="px-4 py-3 text-sm text-gray-500">事業主貸</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500 font-mono">
                        <FileText size={14} className="text-gray-400" />
                        {item.short_name || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
                        <BookOpen size={14} />
                        <span className="text-xs">手持ちの現金、小口現金、レジの...</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-blue-600`}
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="編集"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        title={editingItem ? '勘定科目編集' : '新規勘定科目'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 科目コード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              科目コード <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="input"
              placeholder="501"
            />
            <p className="text-xs text-gray-500 mt-1">3桁の数字を入力してください</p>
          </div>

          {/* 科目名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              科目名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="燃料費"
            />
          </div>

          {/* 区分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              区分 <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input"
            >
              <option value="収入">収入</option>
              <option value="支出">支出</option>
              <option value="資産">資産</option>
              <option value="負債">負債</option>
            </select>
          </div>

          {/* 税区分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              税区分
            </label>
            <select
              value={formData.tax_category}
              onChange={(e) => setFormData({ ...formData, tax_category: e.target.value })}
              className="input"
            >
              <option value="課税">課税</option>
              <option value="対象外">対象外</option>
              <option value="非課税">非課税</option>
            </select>
          </div>

          {/* ショートカット */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ショートカット
            </label>
            <input
              type="text"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              className="input"
              placeholder="NENRYO_501"
            />
            <p className="text-xs text-gray-500 mt-1">
              freeeでの検索用ショートカット（任意）
            </p>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingItem(null);
                resetForm();
              }}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              {editingItem ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}