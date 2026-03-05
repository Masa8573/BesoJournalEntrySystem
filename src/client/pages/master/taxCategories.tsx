import { useState, useEffect } from 'react';
import { ChevronDown, Search, Settings } from 'lucide-react';
import type { TaxCategory, Client } from '@/types';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

// 顧客別設定（client_tax_category_settingsが未作成のためtax_categoriesの値を参照）
interface ClientTaxSetting {
  tax_category_id: string;
  use_as_default: boolean;
  use_for_income: boolean;
  use_for_expense: boolean;
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function TaxCategoriesPage() {
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSettings, setClientSettings] = useState<ClientTaxSetting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TaxCategory | null>(null);
  const [editSettings, setEditSettings] = useState<ClientTaxSetting>({ tax_category_id: '', use_as_default: false, use_for_income: false, use_for_expense: false });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedClientId) loadClientSettings(selectedClientId); else setClientSettings([]); }, [selectedClientId]);

  const loadData = async () => {
    setLoading(true);
    const [taxRes, clientRes] = await Promise.all([
      supabase.from('tax_categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    ]);
    if (taxRes.data) setTaxCategories(taxRes.data as TaxCategory[]);
    if (clientRes.data) setClients(clientRes.data as Client[]);
    setLoading(false);
  };

  const loadClientSettings = async (clientId: string) => {
    // client_tax_category_settings テーブルが存在する場合に取得
    // テーブル未作成時は空配列のまま
    try {
      const { data } = await supabase
        .from('client_tax_category_settings' as any)
        .select('*')
        .eq('client_id', clientId);
      if (data) setClientSettings(data as ClientTaxSetting[]);
    } catch {
      setClientSettings([]);
    }
  };

  const getClientSetting = (catId: string): ClientTaxSetting => {
    const found = clientSettings.find(s => s.tax_category_id === catId);
    if (found) return found;
    const cat = taxCategories.find(c => c.id === catId);
    return {
      tax_category_id: catId,
      use_as_default: cat?.is_default ?? false,
      use_for_income: isIncome(cat!),
      use_for_expense: isExpense(cat!),
    };
  };

  const isIncome = (cat: TaxCategory) => cat.direction === '売上' || cat.direction === 'その他';
  const isExpense = (cat: TaxCategory) => cat.direction === '仕入' || cat.direction === 'その他';

  const handleOpenDetail = (cat: TaxCategory) => {
    setSelectedCategory(cat);
    const setting = getClientSetting(cat.id);
    setEditSettings({ ...setting });
    setShowDetailModal(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedClientId || !selectedCategory) {
      alert('顧客を選択してから設定を保存してください');
      return;
    }
    try {
      await (supabase as any)
        .from('client_tax_category_settings')
        .upsert({
          client_id: selectedClientId,
          tax_category_id: selectedCategory.id,
          use_as_default: editSettings.use_as_default,
          use_for_income: editSettings.use_for_income,
          use_for_expense: editSettings.use_for_expense,
        }, { onConflict: 'client_id,tax_category_id' });
      await loadClientSettings(selectedClientId);
      setShowDetailModal(false);
      alert('設定を保存しました');
    } catch {
      alert('保存に失敗しました（client_tax_category_settings テーブルが未作成の可能性があります）');
    }
  };

  const filteredCategories = taxCategories.filter(cat => {
    const matchesSearch =
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cat.display_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'income') return isIncome(cat);
    if (activeTab === 'expense') return isExpense(cat);
    return true;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case '課税': return 'bg-blue-100 text-blue-700';
      case '非課税': return 'bg-yellow-100 text-yellow-700';
      case '不課税': return 'bg-gray-100 text-gray-700';
      case '免税': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDirectionLabel = (cat: TaxCategory) => {
    if (cat.direction === 'その他') return '共通';
    if (cat.direction === '売上') return '収入';
    if (cat.direction === '仕入') return '支出';
    return cat.direction;
  };

  const incomeCount = taxCategories.filter(c => isIncome(c)).length;
  const expenseCount = taxCategories.filter(c => isExpense(c)).length;
  const selectedClientName = clients.find(c => c.id === selectedClientId)?.name ?? '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">税区分管理</h1>
          <p className="text-sm text-gray-500 mt-1">マスタ47項目はシステム共通・変更不可。顧客別設定は「詳細」から変更できます。</p>
        </div>
      </div>

      {/* 顧客選択 */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-700 mb-2">顧客別設定を確認する（任意）</h2>
        <div className="relative max-w-sm">
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="input appearance-none pr-10"
          >
            <option value="">全体のマスタ設定を表示</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
        {selectedClientId && (
          <p className="text-xs text-blue-600 mt-2">
            {selectedClientName} の設定を表示中。「詳細」ボタンから顧客別のON/OFFを変更できます。
          </p>
        )}
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '税区分数', count: taxCategories.length, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'デフォルト', count: taxCategories.filter(c => c.is_default).length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '収入用', count: incomeCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '支出用', count: expenseCount, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(item => (
          <div key={item.label} className={`${item.bg} rounded-lg p-4 text-center`}>
            <div className={`text-2xl font-bold ${item.color} mb-1`}>{item.count}</div>
            <div className="text-xs text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>

      {/* 税区分一覧 */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">税区分一覧</h2>
          <div className="flex items-center gap-2 mb-4">
            {([
              { key: 'all', label: `すべて (${taxCategories.length})` },
              { key: 'income', label: `収入 (${incomeCount})` },
              { key: 'expense', label: `支出 (${expenseCount})` },
            ] as { key: 'all' | 'income' | 'expense'; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="税区分名、コードで検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">コード</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">税区分</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">方向</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">デフォルト</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">収入</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">支出</th>
                {selectedClientId && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">詳細</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.map(cat => {
                const setting = selectedClientId ? getClientSetting(cat.id) : null;
                return (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{cat.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.display_name ?? cat.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(cat.type)}`}>{cat.type}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getDirectionLabel(cat)}</td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={setting ? setting.use_as_default : cat.is_default} disabled={!selectedClientId} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={setting ? setting.use_for_income : isIncome(cat)} disabled={!selectedClientId} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch checked={setting ? setting.use_for_expense : isExpense(cat)} disabled={!selectedClientId} />
                    </td>
                    {selectedClientId && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenDetail(cat)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="詳細設定"
                        >
                          <Settings size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          {filteredCategories.length} 件表示 / 全 {taxCategories.length} 件
        </div>
      </div>

      {/* 詳細モーダル */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={`税区分設定：${selectedCategory?.display_name ?? selectedCategory?.name}`} size="md">
        {selectedCategory && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">コード：</span><span className="font-mono">{selectedCategory.code}</span></div>
                <div><span className="text-gray-500">種類：</span>{selectedCategory.type}</div>
                <div><span className="text-gray-500">方向：</span>{getDirectionLabel(selectedCategory)}</div>
              </div>
            </div>

            {!selectedClientId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                顧客を選択すると顧客別の設定を保存できます。現在はマスタ設定（変更不可）を表示しています。
              </div>
            )}

            <div className="space-y-3">
              {[
                { key: 'use_as_default' as const, label: 'デフォルトとして使用', desc: 'freeeでデフォルト選択される税区分として設定' },
                { key: 'use_for_income' as const, label: '収入に使用', desc: '売上方向の取引で使用可能にする' },
                { key: 'use_for_expense' as const, label: '支出に使用', desc: '仕入方向の取引で使用可能にする' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <Switch
                    checked={editSettings[key]}
                    onChange={v => setEditSettings({ ...editSettings, [key]: v })}
                    disabled={!selectedClientId}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setShowDetailModal(false)} className="btn-secondary">キャンセル</button>
              <button type="button" onClick={handleSaveSettings} disabled={!selectedClientId} className="btn-primary disabled:opacity-50">
                保存する
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}