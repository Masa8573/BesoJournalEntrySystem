import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Search, FileText,
  TrendingUp, TrendingDown, Building, CreditCard, BookOpen,
  ChevronDown, ChevronUp
} from 'lucide-react';
import type { AccountItem, AccountCategory, TaxCategory } from '@/types';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

// 不動産賃貸業のindustry id（DB登録済み）
const REAL_ESTATE_INDUSTRY_ID = '55555555-0001-0001-0001-000000000030';

// account_categories のコード → 表示名・区分
const CATEGORY_CODE_MAP: Record<string, { label: string; filter: string }> = {
  '1': { label: '資産', filter: 'asset' },
  '2': { label: '負債', filter: 'liability' },
  '3': { label: '純資産', filter: 'equity' },
  '4': { label: '収入', filter: 'income' },
  '5': { label: '支出', filter: 'expense' },
};

// 新規登録フォームで使う category_id を名前から引けるようにするヘルパー
type CategoryFilterType = 'all' | 'income' | 'expense' | 'asset' | 'liability';

export default function AccountsPage() {
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [accountCategories, setAccountCategories] = useState<AccountCategory[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'real_estate'>('general');
  const [activeCategory, setActiveCategory] = useState<CategoryFilterType>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountItem | null>(null);
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null);

  // フォーム状態（DBカラムに合わせた構造）
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: '',    // account_categories の UUID
    tax_category_id: '', // tax_categories の UUID（空文字 = 対象外）
    short_name: '',
    description: '',
    sub_category: '',
  });

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (accountCategories.length > 0) {
      loadAccountItems();
    }
  }, [activeTab, showActiveOnly, accountCategories]);

  // マスタデータ（カテゴリ・税区分）を先に取得
  const loadMasterData = async () => {
    const [catRes, taxRes] = await Promise.all([
      supabase.from('account_categories').select('*').order('sort_order'),
      supabase.from('tax_categories').select('*').order('sort_order'),
    ]);
    if (catRes.data) setAccountCategories(catRes.data as AccountCategory[]);
    if (taxRes.data) setTaxCategories(taxRes.data as TaxCategory[]);
  };

  const loadAccountItems = async () => {
    setLoading(true);

    let query = supabase
      .from('account_items')
      .select(`
        *,
        account_category:account_categories(*),
        tax_category:tax_categories(*),
        industry:industries(*)
      `)
      .order('code', { ascending: true });

    // タブに応じて業種フィルタ
    if (activeTab === 'general') {
      query = query.is('industry_id', null);
    } else {
      query = query.eq('industry_id', REAL_ESTATE_INDUSTRY_ID);
    }

    // 有効のみ表示
    if (showActiveOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('取得エラー:', error.message);
      alert('データの取得に失敗しました: ' + error.message);
    } else if (data) {
      setAccountItems(data as AccountItem[]);
    }

    setLoading(false);
  };

  // カテゴリIDから表示名を取得
  const getCategoryName = (item: AccountItem): string => {
    const cat = item.account_category;
    if (!cat) return '-';
    return CATEGORY_CODE_MAP[cat.code]?.label ?? cat.name;
  };

  // カテゴリIDから絞り込みキーを取得
  const getCategoryFilter = (item: AccountItem): string => {
    const cat = item.account_category;
    if (!cat) return '';
    return CATEGORY_CODE_MAP[cat.code]?.filter ?? '';
  };

  // 税区分の表示名
  const getTaxCategoryName = (item: AccountItem): string => {
    if (!item.tax_category) return '対象外';
    return item.tax_category.display_name ?? item.tax_category.name;
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
      category_id: item.category_id,
      tax_category_id: item.tax_category_id ?? '',
      short_name: item.short_name ?? '',
      description: item.description ?? '',
      sub_category: item.sub_category ?? '',
    });
    setShowModal(true);
  };

  // 送信処理（CREATE / UPDATE）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category_id) {
      alert('区分を選択してください');
      return;
    }

    const itemData = {
      code: formData.code,
      name: formData.name,
      category_id: formData.category_id,
      tax_category_id: formData.tax_category_id || null,
      short_name: formData.short_name || null,
      description: formData.description || null,
      sub_category: formData.sub_category || null,
      industry_id: activeTab === 'real_estate' ? REAL_ESTATE_INDUSTRY_ID : null,
      is_default: false,
      is_system: false,
      is_active: true,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('account_items')
        .update(itemData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('更新エラー:', error.message);
        alert('更新に失敗しました: ' + error.message);
        return;
      }
      alert('勘定科目を更新しました');
    } else {
      const { error } = await supabase
        .from('account_items')
        .insert([itemData]);

      if (error) {
        console.error('登録エラー:', error.message);
        alert('登録に失敗しました: ' + error.message);
        return;
      }
      alert('勘定科目を登録しました');
    }

    setShowModal(false);
    setEditingItem(null);
    resetForm();
    loadAccountItems();
  };

  // 削除処理
  const handleDelete = async (item: AccountItem) => {
    if (item.is_system) {
      alert('システム科目は削除できません');
      return;
    }
    if (!window.confirm(`勘定科目「${item.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const { error } = await supabase
      .from('account_items')
      .delete()
      .eq('id', item.id);

    if (error) {
      console.error('削除エラー:', error.message);
      alert('削除に失敗しました: ' + error.message);
    } else {
      alert('勘定科目を削除しました');
      loadAccountItems();
    }
  };

  // 有効/無効トグル
  const handleToggleActive = async (item: AccountItem) => {
    if (item.is_system && item.is_active) {
      alert('システム科目は無効にできません');
      return;
    }
    const { error } = await supabase
      .from('account_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);

    if (!error) loadAccountItems();
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      category_id: '',
      tax_category_id: '',
      short_name: '',
      description: '',
      sub_category: '',
    });
  };

  // フィルタリング
  const filteredItems = accountItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.includes(searchQuery) ||
      (item.short_name && item.short_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeCategory === 'all') return true;
    return getCategoryFilter(item) === activeCategory;
  });

  // カテゴリ別カウント（絞り込みキーで集計）
  const getCategoryCount = (filter: string) => {
    if (filter === 'all') return accountItems.length;
    return accountItems.filter((item) => getCategoryFilter(item) === filter).length;
  };

  if (loading && accountItems.length === 0) {
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
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          新規勘定科目
        </button>
      </div>

      {/* タブ：一般用 / 不動産賃貸業用 */}
      <div className="flex gap-3">
        {(['general', 'real_estate'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setActiveCategory('all'); }}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'bg-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab === 'general' ? '一般用' : '不動産賃貸業用'}
          </button>
        ))}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={20} className="text-gray-600" />
            <span className="text-sm font-medium text-gray-600">全科目</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{accountItems.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-600">有効</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {accountItems.filter(i => i.is_active).length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-600">収入</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('income')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={20} className="text-red-600" />
            <span className="text-sm font-medium text-gray-600">支出</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('expense')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building size={20} className="text-green-600" />
            <span className="text-sm font-medium text-gray-600">資産</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('asset')}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={20} className="text-orange-600" />
            <span className="text-sm font-medium text-gray-600">負債</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{getCategoryCount('liability')}</div>
        </div>
      </div>

      {/* 勘定科目一覧 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* 検索バー + 有効のみトグル */}
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
          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { key: 'all', label: 'すべて' },
                { key: 'income', label: '収入' },
                { key: 'expense', label: '支出' },
                { key: 'asset', label: '資産' },
                { key: 'liability', label: '負債' },
              ] as { key: CategoryFilterType; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeCategory === key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {label} ({key === 'all' ? accountItems.length : getCategoryCount(key)})
              </button>
            ))}
          </div>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">コード</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">科目名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">区分</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">税区分</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">収入相手方</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">支出相手方</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ショートカット</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">知識ベース</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    読み込み中...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    勘定科目が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium font-mono">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        getCategoryFilter(item) === 'income'
                          ? 'bg-blue-100 text-blue-700'
                          : getCategoryFilter(item) === 'expense'
                          ? 'bg-red-100 text-red-700'
                          : getCategoryFilter(item) === 'asset'
                          ? 'bg-green-100 text-green-700'
                          : getCategoryFilter(item) === 'liability'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {getCategoryName(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getTaxCategoryName(item)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">事業主借</td>
                    <td className="px-4 py-3 text-sm text-gray-500">事業主貸</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500 font-mono">
                        <FileText size={14} className="text-gray-400 shrink-0" />
                        <span>{item.short_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {item.description ? (
                        <div>
                          <button
                            onClick={() => setExpandedDescription(
                              expandedDescription === item.id ? null : item.id
                            )}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 text-left"
                          >
                            <BookOpen size={13} className="shrink-0" />
                            <span className={expandedDescription === item.id ? '' : 'line-clamp-1'}>
                              {item.description}
                            </span>
                            {expandedDescription === item.id
                              ? <ChevronUp size={13} className="shrink-0" />
                              : <ChevronDown size={13} className="shrink-0" />
                            }
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(item)}
                        title={item.is_system ? 'システム科目' : item.is_active ? '無効にする' : '有効にする'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          item.is_active ? 'bg-blue-600' : 'bg-gray-300'
                        } ${item.is_system ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            item.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
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
                          disabled={item.is_system}
                          className={`p-1.5 rounded transition-colors ${
                            item.is_system
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                          title={item.is_system ? 'システム科目は削除不可' : '削除'}
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

        {/* フッター */}
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          {filteredItems.length} 件表示 / 全 {accountItems.length} 件
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
          resetForm();
        }}
        title={editingItem ? '勘定科目編集' : '新規勘定科目'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 科目コード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              科目コード <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="input"
              placeholder="例: 700"
            />
            <p className="text-xs text-gray-500 mt-1">
              {activeTab === 'real_estate' ? '不動産賃貸業用は「RE_」で始めることを推奨（例: RE_700）' : '3桁の数字を推奨'}
            </p>
          </div>

          {/* 科目名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              科目名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="例: 燃料費"
            />
          </div>

          {/* 区分（account_categories から動的取得） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              区分 <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="input"
            >
              <option value="">選択してください</option>
              {accountCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}（{cat.type === 'bs' ? '貸借対照表' : '損益計算書'}）
                </option>
              ))}
            </select>
          </div>

          {/* 補助区分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              補助区分
            </label>
            <input
              type="text"
              value={formData.sub_category}
              onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
              className="input"
              placeholder="例: 流動資産、販売費及び一般管理費"
            />
          </div>

          {/* 税区分（tax_categories から動的取得） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              税区分
            </label>
            <select
              value={formData.tax_category_id}
              onChange={(e) => setFormData({ ...formData, tax_category_id: e.target.value })}
              className="input"
            >
              <option value="">対象外（税区分なし）</option>
              {taxCategories
                .filter(tc => tc.is_active)
                .map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.display_name ?? tc.name}
                  </option>
                ))}
            </select>
          </div>

          {/* ショートカット */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ショートカット
            </label>
            <input
              type="text"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              className="input"
              placeholder="例: NENRYO"
            />
            <p className="text-xs text-gray-500 mt-1">freee検索用のショートカット（任意）</p>
          </div>

          {/* 説明（知識ベース） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              知識ベース（説明）
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input min-h-[80px] resize-y"
              placeholder="この科目の説明、使用例、注意点など"
            />
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