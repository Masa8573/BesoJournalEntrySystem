import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Briefcase, Users, AlertCircle } from 'lucide-react';
import { industriesApi, clientsApi } from '@/client/lib/mockApi';
import type { Industry, Client } from '@/types';
import Modal from '@/client/components/ui/Modal';

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [industriesRes, clientsRes] = await Promise.all([
      industriesApi.getAll(),
      clientsApi.getAll(),
    ]);
    
    if (industriesRes.data) setIndustries(industriesRes.data);
    if (clientsRes.data) setClients(clientsRes.data as any);
    setLoading(false);
  };

  // 新規登録モーダルを開く
  const handleOpenNewModal = () => {
    setEditingIndustry(null);
    resetForm();
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (industry: Industry) => {
    setEditingIndustry(industry);
    setFormData({
      code: industry.code,
      name: industry.name,
      description: industry.description || '',
    });
    setShowModal(true);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const industryData = {
      ...formData,
    };

    if (editingIndustry) {
      // 編集
      const response = await industriesApi.update(editingIndustry.id, industryData);
      if (response.data) {
        alert('業種を更新しました');
        setShowModal(false);
        setEditingIndustry(null);
        resetForm();
        loadData();
      }
    } else {
      // 新規登録
      const response = await industriesApi.create(industryData);
      if (response.data) {
        alert('業種を登録しました');
        setShowModal(false);
        resetForm();
        loadData();
      }
    }
  };

  // 削除処理
  const handleDelete = async (industry: Industry) => {
    // この業種を使用している顧客数をチェック
    const clientCount = clients.filter((c) => c.industry_id === industry.id).length;
    
    if (clientCount > 0) {
      alert(`この業種は${clientCount}件の顧客に紐付いています。\n先に顧客の業種を変更してから削除してください。`);
      return;
    }

    if (!window.confirm(`業種「${industry.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const response = await industriesApi.delete(industry.id);
    if (response.error === null) {
      alert('業種を削除しました');
      loadData();
    } else {
      alert('削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
    });
  };

  const filteredIndustries = industries.filter((industry) =>
    industry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    industry.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    industry.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 業種ごとの顧客数を取得
  const getClientCount = (industryId: string) => {
    return clients.filter((c) => c.industry_id === industryId).length;
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
          <h1 className="text-2xl font-bold text-gray-900">業種管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            顧客の業種マスタを管理します
          </p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          <span>新規業種</span>
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={20} className="text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600">登録業種数</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{industries.length}</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Users size={20} className="text-green-600" />
            <h3 className="text-sm font-medium text-gray-600">総顧客数</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{clients.length}</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>
      </div>

      {/* 業種一覧カード */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">業種一覧</h2>

          {/* 検索バー */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="業種名またはコードで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* 業種リスト */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  業種コード
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  業種名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  説明
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  顧客数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIndustries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    業種が見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredIndustries.map((industry) => {
                  const clientCount = getClientCount(industry.id);
                  const hasClients = clientCount > 0;

                  return (
                    <tr key={industry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">{industry.code}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{industry.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{industry.description || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{clientCount}</span>
                          {hasClients && (
                            <span className="badge badge-blue">{clientCount}件</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(industry)}
                            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(industry)}
                            className={`p-1 rounded transition-colors ${
                              hasClients
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={hasClients ? '顧客が紐付いているため削除できません' : '削除'}
                            disabled={hasClients}
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

      {/* 注意事項 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-900 mb-1">削除に関する注意</h3>
            <p className="text-sm text-yellow-800">
              顧客が紐付いている業種は削除できません。削除する場合は、先に該当する顧客の業種を変更してください。
            </p>
          </div>
        </div>
      </div>

      {/* 業種例 */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-sm font-medium text-blue-900 mb-3">💡 業種例</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { code: 'driver', name: 'ドライバー' },
            { code: 'liver', name: '配信者' },
            { code: 'freelance', name: 'フリーランス' },
            { code: 'restaurant', name: '飲食店' },
            { code: 'retail', name: '小売業' },
            { code: 'service', name: 'サービス業' },
            { code: 'real_estate', name: '不動産業' },
            { code: 'other', name: 'その他' },
          ].map((example) => (
            <div key={example.code} className="bg-white p-3 rounded-lg border border-blue-200">
              <p className="text-xs font-mono text-blue-600">{example.code}</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{example.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingIndustry(null);
        }}
        title={editingIndustry ? '業種編集' : '新規業種'}
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
              className="input font-mono"
              placeholder="例: driver"
            />
            <p className="text-xs text-gray-500 mt-1">
              半角英数字とアンダースコアのみ使用可能
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
              placeholder="例: ドライバー"
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
              placeholder="業種の説明や特徴を入力（任意）"
            />
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingIndustry(null);
              }}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              {editingIndustry ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}