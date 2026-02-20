import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newItem = {
      ...formData,
      is_default: false,
      industry_id: null,
    };

    const response = await accountItemsApi.create(newItem);

    if (response.data) {
      alert('勘定科目を登録しました');
      setShowModal(false);
      resetForm();
      loadAccountItems();
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
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          <span>新規勘定科目</span>
        </button>
      </div>

      {/* 勘定科目一覧カード */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          {/* タブ */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'general'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              一般用
            </button>
            <button
              onClick={() => setActiveTab('real_estate')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'real_estate'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              不動産賃貸業用
            </button>
          </div>

          {/* カテゴリフィルター */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全科目 ({getCategoryCount('all')})
              </button>
              <button
                onClick={() => setActiveCategory('income')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === 'income'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                収入 ({getCategoryCount('収入')})
              </button>
              <button
                onClick={() => setActiveCategory('expense')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === 'expense'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                支出 ({getCategoryCount('支出')})
              </button>
              <button
                onClick={() => setActiveCategory('asset')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === 'asset'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                資産 ({getCategoryCount('資産')})
              </button>
              <button
                onClick={() => setActiveCategory('liability')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === 'liability'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                負債 ({getCategoryCount('負債')})
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-700">有効のみ表示</span>
              <button onClick={() => setShowActiveOnly(!showActiveOnly)}>
                {showActiveOnly ? (
                  <ToggleRight size={24} className="text-blue-600" />
                ) : (
                  <ToggleLeft size={24} className="text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* 検索バー */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="科目名、コード、ショートカットで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* 勘定科目テーブル */}
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
                  ショートカット
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    勘定科目が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{item.code}</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.category}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">{item.tax_category || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-500 font-mono">
                      {item.short_name || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <button>
                        <ToggleRight size={20} className="text-blue-600" />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit size={18} />
                        </button>
                        <button className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={18} />
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

      {/* 新規登録モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="新規勘定科目"
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
                resetForm();
              }}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              登録する
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}