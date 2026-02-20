import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { industriesApi } from '@/client/lib/mockApi';
import type { Industry } from '@/types';
import Modal from '@/client/components/ui/Modal';

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    setLoading(true);
    const response = await industriesApi.getAll();
    if (response.data) {
      setIndustries(response.data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newIndustry = {
      ...formData,
      client_count: 0,
      status: 'active' as const,
    };

    const response = await industriesApi.create(newIndustry);

    if (response.data) {
      alert('業種を登録しました');
      setShowModal(false);
      resetForm();
      loadIndustries();
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
    });
  };

  const filteredIndustries = industries.filter(
    (industry) =>
      industry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      industry.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalClients = industries.reduce((sum, industry) => sum + industry.client_count, 0);

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
          <h1 className="text-2xl font-bold text-gray-900">業種管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            顧客の業種を管理します。業種別ルール設定で使用されます。
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          <span>業種を追加</span>
        </button>
      </div>

      {/* サマリーカード */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">業種一覧</h2>
        <p className="text-sm text-gray-500 mb-4">
          全{industries.length}件の業種が登録されています（総顧客数: {totalClients}名）
        </p>

        {/* 検索バー */}
        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="業種名またはコードで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>

        {/* 業種テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  コード
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  名前
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  説明
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  顧客数
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
              {filteredIndustries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    業種が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredIndustries.map((industry) => (
                  <tr key={industry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <code className="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-800 rounded">
                        {industry.code}
                      </code>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {industry.name}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{industry.description || '-'}</td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span className="inline-flex items-center badge badge-blue">
                        {industry.client_count}件
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${industry.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {industry.status === 'active' ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit size={18} />
                        </button>
                        <button
                          className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          disabled={industry.client_count > 0}
                        >
                          <Trash2
                            size={18}
                            className={industry.client_count > 0 ? 'opacity-30' : ''}
                          />
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

      {/* 注意事項 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">業種について</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>業種は顧客登録時に選択され、業種別ルールの適用に使用されます</li>
          <li>顧客が紐付いている業種は削除できません</li>
          <li>業種コードは一意である必要があります</li>
          <li>
            推奨コード: driver（ドライバー）、liver（ライバー）、freelance（フリーランス）、
            restaurant（飲食店）、retail（小売業）、service（サービス業）、
            real_estate（不動産賃貸業）
          </li>
        </ul>
      </div>

      {/* 新規登録モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="業種を追加"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 業種コード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              業種コード <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="input"
              placeholder="freelance"
            />
            <p className="text-xs text-gray-500 mt-1">
              半角英数字とアンダースコアのみ使用可能（例: driver, liver, freelance）
            </p>
          </div>

          {/* 業種名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              業種名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="フリーランス"
            />
          </div>

          {/* 説明 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              説明
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
              placeholder="IT・デザイナーなど"
            />
            <p className="text-xs text-gray-500 mt-1">
              業種の特徴や対象となる職業を記載してください
            </p>
          </div>

          {/* 業種例 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">業種例</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <strong>driver</strong> - ドライバー
              </div>
              <div>
                <strong>liver</strong> - ライバー
              </div>
              <div>
                <strong>freelance</strong> - フリーランス
              </div>
              <div>
                <strong>restaurant</strong> - 飲食店
              </div>
              <div>
                <strong>retail</strong> - 小売業
              </div>
              <div>
                <strong>service</strong> - サービス業
              </div>
              <div>
                <strong>real_estate</strong> - 不動産賃貸業
              </div>
              <div>
                <strong>other</strong> - その他
              </div>
            </div>
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