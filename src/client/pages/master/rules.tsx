import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Download, Upload as UploadIcon, Copy, ArrowLeft, User, Building2, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { rulesApi, industriesApi, clientsApi, accountItemsApi, taxCategoriesApi } from '@/client/lib/mockApi';
import type { Rule, Industry, Client, AccountItem, TaxCategory } from '@/types';
import Modal from '@/client/components/ui/Modal';

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

  const [formData, setFormData] = useState({
    priority: '',
    rule_type: '支出' as '支出' | '収入',
    scope: 'shared' as 'shared' | 'industry' | 'client',
    industry_id: '',
    client_id: '',
    supplier_pattern: '',
    amount_min: '',
    amount_max: '',
    account_item_id: '',
    tax_category_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [rulesRes, industriesRes, clientsRes, accountsRes, taxRes] = await Promise.all([
      rulesApi.getAll(),
      industriesApi.getAll(),
      clientsApi.getAll(),
      accountItemsApi.getAll(),
      taxCategoriesApi.getAll(),
    ]);

    if (rulesRes.data) setRules(rulesRes.data);
    if (industriesRes.data) setIndustries(industriesRes.data);
    if (clientsRes.data) setClients(clientsRes.data as any);
    if (accountsRes.data) setAccountItems(accountsRes.data);
    if (taxRes.data) setTaxCategories(taxRes.data);
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
    
    // scopeの判定
    let scope: 'shared' | 'industry' | 'client' = 'shared';
    if (rule.client_id) scope = 'client';
    else if (rule.industry_id) scope = 'industry';
    
    setFormData({
      priority: rule.priority.toString(),
      rule_type: rule.rule_type,
      scope: scope,
      industry_id: rule.industry_id || '',
      client_id: rule.client_id || '',
      supplier_pattern: rule.supplier_pattern || '',
      amount_min: rule.amount_min?.toString() || '',
      amount_max: rule.amount_max?.toString() || '',
      account_item_id: rule.account_item_id || '',
      tax_category_id: rule.tax_category_id || '',
    });
    setShowModal(true);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ruleData = {
      priority: Number(formData.priority),
      rule_type: formData.rule_type,
      industry_id: formData.scope === 'industry' ? formData.industry_id : null,
      client_id: formData.scope === 'client' ? formData.client_id : null,
      supplier_pattern: formData.supplier_pattern || null,
      amount_min: formData.amount_min ? Number(formData.amount_min) : null,
      amount_max: formData.amount_max ? Number(formData.amount_max) : null,
      account_item_id: formData.account_item_id,
      tax_category_id: formData.tax_category_id,
      status: 'active' as const,
    };

    if (editingRule) {
      // 編集
      await rulesApi.update(editingRule.id, ruleData);
      alert('ルールを更新しました');
    } else {
      // 新規登録
      await rulesApi.create(ruleData);
      alert('ルールを登録しました');
    }
    
    setShowModal(false);
    setEditingRule(null);
    resetForm();
    loadData();
  };

  // 削除処理
  const handleDelete = async (rule: Rule) => {
    const scopeName = rule.client_id ? '顧客別' : rule.industry_id ? '業種別' : '共通';
    if (!window.confirm(`${scopeName}ルール「優先度${rule.priority}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const response = await rulesApi.delete(rule.id);
    if (response.error === null) {
      alert('ルールを削除しました');
      loadData();
    } else {
      alert('削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      priority: '',
      rule_type: '支出',
      scope: 'shared',
      industry_id: '',
      client_id: '',
      supplier_pattern: '',
      amount_min: '',
      amount_max: '',
      account_item_id: '',
      tax_category_id: '',
    });
  };

  const filteredRules = rules.filter((rule) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'shared') return !rule.industry_id && !rule.client_id;
    if (activeTab === 'industry') return rule.industry_id && !rule.client_id;
    if (activeTab === 'client') return rule.client_id;
    return true;
  });

  const getScopeInfo = (rule: Rule) => {
    if (rule.client_id) {
      const client = clients.find(c => c.id === rule.client_id);
      return { icon: <User size={16} />, label: client?.name || '山田太郎', color: 'text-blue-600' };
    }
    if (rule.industry_id) {
      const industry = industries.find(i => i.id === rule.industry_id);
      return { icon: <Building2 size={16} />, label: industry?.name || 'ドライバー', color: 'text-orange-600' };
    }
    return { icon: <Globe size={16} />, label: '共通', color: 'text-green-600' };
  };

  const getAccountName = (accountItemId: string | null) => {
    if (!accountItemId) return '-';
    const account = accountItems.find(a => a.id === accountItemId);
    return account?.name || '燃料費';
  };

  const getTaxCategoryCode = (taxCategoryId: string | null) => {
    if (!taxCategoryId) return 'TAXABLE_10';
    const tax = taxCategories.find(t => t.id === taxCategoryId);
    return tax ? 'TAXABLE_10' : 'TAXABLE_10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">ルール管理</h1>
            <p className="text-sm text-gray-500">仕訳自動生成のルールを管理します</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <Download size={18} className="text-gray-700" />
            <span className="text-sm font-medium text-gray-700">エクスポート</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <UploadIcon size={18} className="text-gray-700" />
            <span className="text-sm font-medium text-gray-700">インポート</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <Copy size={18} className="text-gray-700" />
            <span className="text-sm font-medium text-gray-700">重複チェック</span>
          </button>
          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">新規ルール作成</span>
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'all'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'bg-transparent text-gray-600 hover:bg-white hover:shadow-sm'
          }`}
        >
          全て ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('shared')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'shared'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'bg-transparent text-gray-600 hover:bg-white hover:shadow-sm'
          }`}
        >
          <Globe size={16} />
          共通 ({rules.filter(r => !r.industry_id && !r.client_id).length})
        </button>
        <button
          onClick={() => setActiveTab('industry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'industry'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'bg-transparent text-gray-600 hover:bg-white hover:shadow-sm'
          }`}
        >
          <Building2 size={16} />
          業種別 ({rules.filter(r => r.industry_id && !r.client_id).length})
        </button>
        <button
          onClick={() => setActiveTab('client')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'client'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'bg-transparent text-gray-600 hover:bg-white hover:shadow-sm'
          }`}
        >
          <User size={16} />
          顧客別 ({rules.filter(r => r.client_id).length})
        </button>
      </div>

      {/* カード */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* カードヘッダー */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">ルール一覧</h2>
          <p className="text-sm text-gray-500">
            優先度が低い（数字が小さい）ほど優先的に適用されます。顧客別ルール → 業種別ルール → 共通ルールの順で適用されます。
          </p>
        </div>

        {/* テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">優先度</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">種別</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">適用範囲</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">取引先パターン</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">金額範囲</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">勘定科目</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">税区分</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">状態</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    ルールが見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const scopeInfo = getScopeInfo(rule);
                  return (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg">
                          <span className="text-sm font-semibold text-gray-900">{rule.priority}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center justify-center w-5 h-5 rounded-full ${
                            rule.rule_type === '支出' ? 'bg-red-100' : 'bg-blue-100'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${
                              rule.rule_type === '支出' ? 'bg-red-500' : 'bg-blue-500'
                            }`}></div>
                          </div>
                          <span className={`text-sm font-medium ${
                            rule.rule_type === '支出' ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {rule.rule_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 ${scopeInfo.color}`}>
                          {scopeInfo.icon}
                          <span className="text-sm font-medium">{scopeInfo.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{rule.supplier_pattern || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {rule.amount_min && rule.amount_max
                            ? `${rule.amount_min.toLocaleString()}〜${rule.amount_max.toLocaleString()}`
                            : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">{getAccountName(rule.account_item_id)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono text-gray-600">{getTaxCategoryCode(rule.tax_category_id)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                          rule.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rule.status === 'active' ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="編集"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(rule)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="削除"
                          >
                            <Trash2 size={18} />
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
      </div>

      {/* モーダル */}
      <Modal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false);
          setEditingRule(null);
        }} 
        title={editingRule ? 'ルール編集' : '新規ルール作成'} 
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                優先度 <span className="text-red-500">*</span>
              </label>
              <input type="number" required min="1" value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="input" placeholder="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">種別 *</label>
              <div className="flex gap-4">
                {['支出', '収入'].map((type) => (
                  <label key={type} className="flex items-center">
                    <input type="radio" name="rule_type" value={type}
                      checked={formData.rule_type === type}
                      onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
                      className="mr-2" />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">適用範囲 *</label>
            <div className="flex gap-4">
              {[
                { value: 'shared', label: '共通', icon: <Globe size={16} /> },
                { value: 'industry', label: '業種別', icon: <Building2 size={16} /> },
                { value: 'client', label: '顧客別', icon: <User size={16} /> },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input type="radio" name="scope" value={option.value}
                    checked={formData.scope === option.value}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })} />
                  {option.icon}
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {formData.scope === 'industry' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">業種 *</label>
              <select required value={formData.industry_id}
                onChange={(e) => setFormData({ ...formData, industry_id: e.target.value })} className="input">
                <option value="">選択してください</option>
                {industries.map((ind) => <option key={ind.id} value={ind.id}>{ind.name}</option>)}
              </select>
            </div>
          )}

          {formData.scope === 'client' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">顧客 *</label>
              <select required value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} className="input">
                <option value="">選択してください</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">取引先パターン</label>
            <input type="text" value={formData.supplier_pattern}
              onChange={(e) => setFormData({ ...formData, supplier_pattern: e.target.value })}
              className="input" placeholder="エネオス" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">最小金額</label>
              <input type="number" value={formData.amount_min}
                onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })}
                className="input" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">最大金額</label>
              <input type="number" value={formData.amount_max}
                onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })}
                className="input" placeholder="10000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">勘定科目 *</label>
            <select required value={formData.account_item_id}
              onChange={(e) => setFormData({ ...formData, account_item_id: e.target.value })} className="input">
              <option value="">選択</option>
              {accountItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">税区分 *</label>
            <select required value={formData.tax_category_id}
              onChange={(e) => setFormData({ ...formData, tax_category_id: e.target.value })} className="input">
              <option value="">選択</option>
              {taxCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={() => { 
                setShowModal(false); 
                setEditingRule(null);
                resetForm(); 
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {editingRule ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}