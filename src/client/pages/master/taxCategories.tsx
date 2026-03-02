import { useState, useEffect } from 'react';
import { ChevronDown, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import type { TaxCategory } from '@/types';
import { supabase } from '@/client/lib/supabase';

export default function TaxCategoriesPage() {
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [selectedClient, setSelectedClient] = useState('山田太郎');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTaxCategories();
  }, []);

  const loadTaxCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tax_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('税区分取得エラー:', error.message);
      alert('データの取得に失敗しました: ' + error.message);
    } else if (data) {
      setTaxCategories(data as TaxCategory[]);
    }
    setLoading(false);
  };

  // direction カラムで収入・支出を判定
  // direction: '売上' = 収入用, '仕入' = 支出用, 'その他' = 共通
  const isIncome = (cat: TaxCategory) => cat.direction === '売上' || cat.direction === 'その他';
  const isExpense = (cat: TaxCategory) => cat.direction === '仕入' || cat.direction === 'その他';

  const clientSettings = {
    totalCount: taxCategories.length,
    defaultCount: taxCategories.filter(c => c.is_default).length,
    incomeCount: taxCategories.filter(c => isIncome(c)).length,
    expenseCount: taxCategories.filter(c => isExpense(c)).length,
    sharedCount: taxCategories.filter(c => isIncome(c) && isExpense(c)).length,
  };

  const filteredCategories = taxCategories.filter((cat) => {
    const matchesSearch =
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cat.display_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'income') return isIncome(cat);
    if (activeTab === 'expense') return isExpense(cat);
    return true;
  });

  const getDirectionLabel = (cat: TaxCategory) => {
    if (cat.direction === 'その他') return '共通';
    if (cat.direction === '売上') return '収入';
    if (cat.direction === '仕入') return '支出';
    return cat.direction;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '課税': return 'bg-blue-100 text-blue-700';
      case '非課税': return 'bg-yellow-100 text-yellow-700';
      case '不課税': return 'bg-gray-100 text-gray-700';
      case '免税': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
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
          <h1 className="text-2xl font-bold text-gray-900">税区分管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            顧客ごとに消費税の税区分設定を管理します
          </p>
        </div>
        <button className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
          デフォルトに戻す
        </button>
      </div>

      {/* 顧客選択 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">顧客選択</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">税区分設定を行う顧客を選択してください</p>

        <div className="relative">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="input appearance-none"
          >
            <option value="山田太郎">山田太郎</option>
            <option value="佐藤花子">佐藤花子</option>
            <option value="鈴木一郎">鈴木一郎</option>
          </select>
          <ChevronDown
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
            size={20}
          />
        </div>
      </div>

      {/* 税区分設定サマリー */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-700 mb-4">
          {selectedClient}さんの税区分設定
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {clientSettings.totalCount}
            </div>
            <div className="text-xs text-gray-600">税区分数</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {clientSettings.defaultCount}
            </div>
            <div className="text-xs text-gray-600">デフォルト使用</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {clientSettings.incomeCount}
            </div>
            <div className="text-xs text-gray-600">収入用</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600 mb-1">
              {clientSettings.expenseCount}
            </div>
            <div className="text-xs text-gray-600">支出用</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {clientSettings.sharedCount}
            </div>
            <div className="text-xs text-gray-600">共通</div>
          </div>
        </div>
      </div>

      {/* 税区分一覧 */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">税区分一覧</h2>

          {/* タブ */}
          <div className="flex items-center gap-2 mb-4">
            {(
              [
                { key: 'all', label: `すべて (${taxCategories.length})` },
                { key: 'income', label: `収入 (${clientSettings.incomeCount})` },
                { key: 'expense', label: `支出 (${clientSettings.expenseCount})` },
              ] as { key: 'all' | 'income' | 'expense'; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 検索バー */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="税区分名、コードで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
        </div>

        {/* 税区分テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">コード</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">税区分</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">方向</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">説明</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">デフォルト</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">収入</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">支出</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    税区分が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {category.code}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {category.display_name ?? category.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(category.type)}`}>
                        {category.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getDirectionLabel(category)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                      <span className="line-clamp-2">{category.description || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {category.is_default ? (
                        <ToggleRight size={24} className="text-blue-600 mx-auto" />
                      ) : (
                        <ToggleLeft size={24} className="text-gray-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isIncome(category) ? (
                        <ToggleRight size={24} className="text-blue-600 mx-auto" />
                      ) : (
                        <ToggleLeft size={24} className="text-gray-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isExpense(category) ? (
                        <ToggleRight size={24} className="text-blue-600 mx-auto" />
                      ) : (
                        <ToggleLeft size={24} className="text-gray-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* フッター */}
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          {filteredCategories.length} 件表示 / 全 {taxCategories.length} 件
        </div>
      </div>

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">税区分について</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>
            <strong>デフォルト:</strong> オンにすると、この税区分がfreee上でデフォルトで選択されます
          </li>
          <li>
            <strong>収入:</strong> 売上方向の取引（direction=売上/共通）で使用可能な税区分
          </li>
          <li>
            <strong>支出:</strong> 仕入方向の取引（direction=仕入/共通）で使用可能な税区分
          </li>
          <li>顧客ごとに異なる税区分を有効/無効にできます</li>
        </ul>
      </div>
    </div>
  );
}