import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ArrowLeft, User, Building2, Globe, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Rule, Industry, Client, AccountItem, TaxCategory } from '@/types';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

export default function RulesPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<Rule[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [accountItems, setAccountItems] = useState<AccountItem[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'shared' | 'industry' | 'client'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // フォーム状態
  // conditions/actionsのJSONBフィールドをフラットに扱う
  const [formData, setFormData] = useState({
    rule_name: '',
    priority: '100',
    rule_type: '支出' as '支出' | '収入',
    scope: 'shared' as 'shared' | 'industry' | 'client',
    industry_id: '',
    client_id: '',
    // conditions
    supplier_pattern: '',
    transaction_pattern: '',
    amount_min: '',
    amount_max: '',
    // actions
    account_item_id: '',
    tax_category_id: '',
    description_template: '',
    // flags
    auto_apply: true,
    require_confirmation: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [rulesRes, industriesRes, clientsRes, accountsRes, taxRes] = await Promise.all([
      supabase
        .from('processing_rules')
        .select('*, industry:industries(*), client:clients(*)')
        .order('priority', { ascending: true }),
      supabase.from('industries').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('account_items').select('*').eq('is_active', true).is('industry_id', null).order('code'),
      supabase.from('tax_categories').select('*').eq('is_active', true).order('sort_order'),
    ]);

    if (rulesRes.data) setRules(rulesRes.data as Rule[]);
    if (industriesRes.data) setIndustries(industriesRes.data as Industry[]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (accountsRes.data) setAccountItems(accountsRes.data as AccountItem[]);
    if (taxRes.data) setTaxCategories(taxRes.data as TaxCategory[]);

    // エラーログ
    [rulesRes, industriesRes, clientsRes, accountsRes, taxRes].forEach((r, i) => {
      if (r.error) console.error(`データ取得エラー[${i}]:`, r.error.message);
    });

    setLoading(false);
  };

  // 新規登録モーダルを開く
  const handleOpenNewModal = () => {
    setEditingRule(null);
    resetForm();
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (rule: Rule) => {
    setEditingRule(rule);
    let scope: 'shared' | 'industry' | 'client' = rule.scope ?? 'shared';

    setFormData({
      rule_name: rule.rule_name,
      priority: rule.priority.toString(),
      rule_type: rule.rule_type,
      scope,
      industry_id: rule.industry_id || '',
      client_id: rule.client_id || '',
      // conditions から展開
      supplier_pattern: rule.conditions?.supplier_pattern || '',
      transaction_pattern: rule.conditions?.transaction_pattern || '',
      amount_min: rule.conditions?.amount_min?.toString() || '',
      amount_max: rule.conditions?.amount_max?.toString() || '',
      // actions から展開
      account_item_id: rule.actions?.account_item_id || '',
      tax_category_id: rule.actions?.tax_category_id || '',
      description_template: rule.actions?.description_template || '',
      auto_apply: rule.auto_apply,
      require_confirmation: rule.require_confirmation,
    });
    setShowModal(true);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.account_item_id) {
      alert('勘定科目を選択してください');
      return;
    }

    // JSONB形式に組み立て
    const ruleData = {
      rule_name: formData.rule_name,
      priority: Number(formData.priority),
      rule_type: formData.rule_type,
      scope: formData.scope,
      industry_id: formData.scope === 'industry' ? formData.industry_id || null : null,
      client_id: formData.scope === 'client' ? formData.client_id || null : null,
      conditions: {
        supplier_pattern: formData.supplier_pattern || null,
        transaction_pattern: formData.transaction_pattern || null,
        amount_min: formData.amount_min ? Number(formData.amount_min) : null,
        amount_max: formData.amount_max ? Number(formData.amount_max) : null,
      },
      actions: {
        account_item_id: formData.account_item_id || null,
        tax_category_id: formData.tax_category_id || null,
        description_template: formData.description_template || null,
      },
      auto_apply: formData.auto_apply,
      require_confirmation: formData.require_confirmation,
      is_active: true,
    };

    if (editingRule) {
      const { error } = await supabase
        .from('processing_rules')
        .update(ruleData)
        .eq('id', editingRule.id);

      if (error) {
        console.error('更新エラー:', error.message);
        alert('更新に失敗しました: ' + error.message);
        return;
      }
      alert('ルールを更新しました');
    } else {
      const { error } = await supabase
        .from('processing_rules')
        .insert([ruleData]);

      if (error) {
        console.error('登録エラー:', error.message);
        alert('登録に失敗しました: ' + error.message);
        return;
      }
      alert('ルールを登録しました');
    }

    setShowModal(false);
    setEditingRule(null);
    resetForm();
    loadData();
  };

  // 削除処理
  const handleDelete = async (rule: Rule) => {
    if (!window.confirm(`ルール「${rule.rule_name}」を削除しますか？\n\nこの操作は取り消せません。`)) return;

    const { error } = await supabase
      .from('processing_rules')
      .delete()
      .eq('id', rule.id);

    if (error) {
      console.error('削除エラー:', error.message);
      alert('削除に失敗しました: ' + error.message);
    } else {
      alert('ルールを削除しました');
      loadData();
    }
  };

  // 有効/無効トグル
  const handleToggleActive = async (rule: Rule) => {
    const { error } = await supabase
      .from('processing_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);

    if (!error) loadData();
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      priority: '100',
      rule_type: '支出',
      scope: 'shared',
      industry_id: '',
      client_id: '',
      supplier_pattern: '',
      transaction_pattern: '',
      amount_min: '',
      amount_max: '',
      account_item_id: '',
      tax_category_id: '',
      description_template: '',
      auto_apply: true,
      require_confirmation: false,
    });
  };

  const filteredRules = rules.filter((rule) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'shared') return rule.scope === 'shared';
    if (activeTab === 'industry') return rule.scope === 'industry';
    if (activeTab === 'client') return rule.scope === 'client';
    return true;
  });

  const getScopeInfo = (rule: Rule) => {
    if (rule.scope === 'client') {
      return { icon: <User size={16} />, label: rule.client?.name || '顧客別', color: 'text-blue-600 bg-blue-50' };
    }
    if (rule.scope === 'industry') {
      return { icon: <Building2 size={16} />, label: rule.industry?.name || '業種別', color: 'text-orange-600 bg-orange-50' };
    }
    return { icon: <Globe size={16} />, label: '共通', color: 'text-green-600 bg-green-50' };
  };

  const getAccountName = (rule: Rule) => {
    const id = rule.actions?.account_item_id;
    if (!id) return '-';
    return accountItems.find(a => a.id === id)?.name || '-';
  };

  const getTaxCategoryName = (rule: Rule) => {
    const id = rule.actions?.tax_category_id;
    if (!id) return '-';
    const tc = taxCategories.find(t => t.id === id);
    return tc?.display_name ?? tc?.name ?? '-';
  };

  const getConditionSummary = (rule: Rule) => {
    const parts: string[] = [];
    if (rule.conditions?.supplier_pattern) parts.push(`取引先: ${rule.conditions.supplier_pattern}`);
    if (rule.conditions?.transaction_pattern) parts.push(`摘要: ${rule.conditions.transaction_pattern}`);
    if (rule.conditions?.amount_min || rule.conditions?.amount_max) {
      const min = rule.conditions.amount_min?.toLocaleString() ?? '0';
      const max = rule.conditions.amount_max?.toLocaleString() ?? '∞';
      parts.push(`金額: ${min}〜${max}`);
    }
    return parts.length > 0 ? parts.join(' / ') : '条件なし（全一致）';
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
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">ルール管理</h1>
          <p className="text-sm text-gray-500 mt-1">仕訳自動生成のルールを管理します（優先度が小さいほど優先）</p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          新規ルール作成
        </button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { key: 'all', label: '全ルール', color: 'text-gray-900' },
          { key: 'shared', label: '共通', color: 'text-green-600' },
          { key: 'industry', label: '業種別', color: 'text-orange-600' },
          { key: 'client', label: '顧客別', color: 'text-blue-600' },
        ] as const).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`bg-white rounded-lg border p-4 text-left transition-all ${
              activeTab === key ? 'border-blue-400 shadow-sm' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`text-2xl font-bold ${color} mb-1`}>
              {key === 'all' ? rules.length : rules.filter(r => r.scope === key).length}
            </div>
            <div className="text-sm text-gray-600">{label}</div>
          </button>
        ))}
      </div>

      {/* タブ */}
      <div className="flex gap-2">
        {([
          { key: 'all', label: 'すべて' },
          { key: 'shared', label: '共通' },
          { key: 'industry', label: '業種別' },
          { key: 'client', label: '顧客別' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === key
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">優先度</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ルール名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">適用範囲</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">条件</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">勘定科目</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">税区分</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">有効</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-gray-500">
                    {rules.length === 0
                      ? 'ルールがまだ登録されていません。「新規ルール作成」から追加してください。'
                      : 'このカテゴリのルールはありません'}
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const scopeInfo = getScopeInfo(rule);
                  return (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                          {rule.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{rule.rule_name}</div>
                        {rule.match_count > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5">{rule.match_count}回マッチ</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          rule.rule_type === '支出' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {rule.rule_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${scopeInfo.color}`}>
                          {scopeInfo.icon}
                          <span>{scopeInfo.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">
                        <span className="line-clamp-2">{getConditionSummary(rule)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{getAccountName(rule)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{getTaxCategoryName(rule)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleActive(rule)}>
                          {rule.is_active
                            ? <ToggleRight size={24} className="text-blue-600 mx-auto" />
                            : <ToggleLeft size={24} className="text-gray-400 mx-auto" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(rule)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* フッター */}
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          {filteredRules.length} 件表示 / 全 {rules.length} 件
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRule(null); resetForm(); }}
        title={editingRule ? 'ルール編集' : '新規ルール作成'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ルール名・優先度 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ルール名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text" required
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                className="input" placeholder="例: エネオス → 燃料費"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                優先度 <span className="text-red-500">*</span>
              </label>
              <input
                type="number" required min="1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="input" placeholder="100"
              />
              <p className="text-xs text-gray-500 mt-1">小さいほど優先</p>
            </div>
          </div>

          {/* 種別・適用範囲 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">種別 *</label>
              <div className="flex gap-4">
                {(['支出', '収入'] as const).map((type) => (
                  <label key={type} className="flex items-center cursor-pointer">
                    <input type="radio" name="rule_type" value={type}
                      checked={formData.rule_type === type}
                      onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
                      className="mr-2" />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">適用範囲 *</label>
              <div className="flex gap-4">
                {([
                  { value: 'shared', label: '共通', icon: <Globe size={14} /> },
                  { value: 'industry', label: '業種別', icon: <Building2 size={14} /> },
                  { value: 'client', label: '顧客別', icon: <User size={14} /> },
                ] as const).map(({ value, label, icon }) => (
                  <label key={value} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="scope" value={value}
                      checked={formData.scope === value}
                      onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })} />
                    {icon}
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 業種選択（業種別の場合） */}
          {formData.scope === 'industry' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">業種 *</label>
              <select required value={formData.industry_id}
                onChange={(e) => setFormData({ ...formData, industry_id: e.target.value })} className="input">
                <option value="">選択してください</option>
                {industries.map((ind) => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
              </select>
            </div>
          )}

          {/* 顧客選択（顧客別の場合） */}
          {formData.scope === 'client' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顧客 *</label>
              <select required value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className="input">
                <option value="">選択してください</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* 条件（conditions JSONB） */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">マッチ条件（いずれかが一致したら適用）</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">取引先パターン</label>
              <input type="text" value={formData.supplier_pattern}
                onChange={(e) => setFormData({ ...formData, supplier_pattern: e.target.value })}
                className="input" placeholder="例: エネオス（部分一致）" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">摘要パターン</label>
              <input type="text" value={formData.transaction_pattern}
                onChange={(e) => setFormData({ ...formData, transaction_pattern: e.target.value })}
                className="input" placeholder="例: ガソリン（部分一致）" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最小金額</label>
                <input type="number" value={formData.amount_min}
                  onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })}
                  className="input" placeholder="0" min="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最大金額</label>
                <input type="number" value={formData.amount_max}
                  onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })}
                  className="input" placeholder="上限なし" min="0" />
              </div>
            </div>
          </div>

          {/* アクション（actions JSONB） */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">適用アクション</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                勘定科目 <span className="text-red-500">*</span>
              </label>
              <select required value={formData.account_item_id}
                onChange={(e) => setFormData({ ...formData, account_item_id: e.target.value })} className="input">
                <option value="">選択してください</option>
                {accountItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.code} {item.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">税区分</label>
              <select value={formData.tax_category_id}
                onChange={(e) => setFormData({ ...formData, tax_category_id: e.target.value })} className="input">
                <option value="">選択してください</option>
                {taxCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.display_name ?? cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">摘要テンプレート</label>
              <input type="text" value={formData.description_template}
                onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
                className="input" placeholder="例: ガソリン代 {supplier}" />
              <p className="text-xs text-gray-500 mt-1">{`{supplier}`} で取引先名を埋め込み可能</p>
            </div>
          </div>

          {/* フラグ */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.auto_apply}
                onChange={(e) => setFormData({ ...formData, auto_apply: e.target.checked })} />
              <span className="text-sm text-gray-700">自動適用</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.require_confirmation}
                onChange={(e) => setFormData({ ...formData, require_confirmation: e.target.checked })} />
              <span className="text-sm text-gray-700">確認を必要とする</span>
            </label>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setShowModal(false); setEditingRule(null); resetForm(); }}
              className="btn-secondary">
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              {editingRule ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}