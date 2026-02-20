import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clientsApi, industriesApi } from '@/client/lib/mockApi';
import type { Client, Industry } from '@/types';
import Modal from '@/client/components/ui/Modal';

interface ClientWithIndustry extends Client {
  industry?: Industry;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithIndustry[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    industry_id: '',
    annual_sales: '',
    tax_category: '原則課税' as '原則課税' | '簡易課税' | '免税',
    invoice_registered: false,
    use_custom_rules: false,
  });

  useEffect(() => {
    loadClients();
    loadIndustries();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const response = await clientsApi.getAll();
    if (response.data) {
      setClients(response.data as any);
    }
    setLoading(false);
  };

  const loadIndustries = async () => {
    const response = await industriesApi.getAll();
    if (response.data) {
      setIndustries(response.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newClient = {
      ...formData,
      organization_id: 'org-1',
      annual_sales: formData.annual_sales ? Number(formData.annual_sales) : null,
      status: 'active' as const,
    };

    const response = await clientsApi.create(newClient);
    
    if (response.data) {
      alert('顧客を登録しました');
      setShowModal(false);
      setFormData({
        name: '',
        industry_id: '',
        annual_sales: '',
        tax_category: '原則課税',
        invoice_registered: false,
        use_custom_rules: false,
      });
      loadClients();
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.industry?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '¥0';
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
          <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            仕訳入力処理を行う顧客を選択または新規登録してください
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 btn-primary"
        >
          <Plus size={18} />
          <span>新規顧客登録</span>
        </button>
      </div>

      {/* 顧客一覧カード */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">顧客一覧</h2>
          <p className="text-sm text-gray-500 mb-4">
            仕訳処理を行う顧客を選択してください
          </p>

          {/* 検索バー */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="顧客名または業種で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* 顧客リスト */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  顧客名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  業種
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  年商
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  課税区分
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  インボイス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ルール追加
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    顧客が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{client.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{client.industry?.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(client.annual_sales)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          client.tax_category === '原則課税'
                            ? 'badge-blue'
                            : client.tax_category === '簡易課税'
                            ? 'badge-green'
                            : 'badge-gray'
                        }`}
                      >
                        {client.tax_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          client.invoice_registered ? 'badge-green' : 'badge-gray'
                        }`}
                      >
                        {client.invoice_registered ? '取得済' : '未取得'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          client.use_custom_rules ? 'badge-green' : 'badge-gray'
                        }`}
                      >
                        {client.use_custom_rules ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit size={18} />
                        </button>
                        <button className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={18} />
                        </button>
                        <Link
                          to={`/clients/${client.id}`}
                          className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <ChevronRight size={18} />
                        </Link>
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
        title="新規顧客登録"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 顧客名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              顧客名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="山田太郎"
            />
          </div>

          {/* 業種 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              業種 <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.industry_id}
              onChange={(e) => setFormData({ ...formData, industry_id: e.target.value })}
              className="input"
            >
              <option value="">選択してください</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </div>

          {/* 年商 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              年商（円）
            </label>
            <input
              type="number"
              value={formData.annual_sales}
              onChange={(e) => setFormData({ ...formData, annual_sales: e.target.value })}
              className="input"
              placeholder="5000000"
            />
          </div>

          {/* 課税区分 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              課税区分 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              {['原則課税', '簡易課税', '免税'].map((category) => (
                <label key={category} className="flex items-center">
                  <input
                    type="radio"
                    name="tax_category"
                    value={category}
                    checked={formData.tax_category === category}
                    onChange={(e) => setFormData({ ...formData, tax_category: e.target.value as any })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* インボイス登録 */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.invoice_registered}
                onChange={(e) => setFormData({ ...formData, invoice_registered: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">インボイス登録済み</span>
            </label>
          </div>

          {/* ルール追加 */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.use_custom_rules}
                onChange={(e) => setFormData({ ...formData, use_custom_rules: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">顧客別ルールを使用する</span>
            </label>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
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