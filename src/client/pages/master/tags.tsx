import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Download, Upload as UploadIcon, Search } from 'lucide-react';
import { tagsApi } from '@/client/lib/mockApi';
import type { Tag } from '@/types';
import Modal from '@/client/components/ui/Modal';

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<'all' | 'supplier' | 'item'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    type: 'supplier' as 'supplier' | 'item',
    name: '',
    color: 'blue',
    description: '',
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setLoading(true);
    const response = await tagsApi.getAll();
    if (response.data) {
      setTags(response.data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newTag = {
      ...formData,
      status: 'active' as const,
    };

    const response = await tagsApi.create(newTag);

    if (response.data) {
      alert('タグを登録しました');
      setShowModal(false);
      resetForm();
      loadTags();
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'supplier',
      name: '',
      color: 'blue',
      description: '',
    });
  };

  const filteredTags = tags.filter((tag) => {
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeType === 'all' || tag.type === activeType;
    return matchesSearch && matchesType;
  });

  const getColorClass = (color: string | null) => {
    const colorMap: { [key: string]: string } = {
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      green: 'bg-green-500',
      blue: 'bg-blue-500',
      yellow: 'bg-yellow-500',
      purple: 'bg-purple-500',
      pink: 'bg-pink-500',
      gray: 'bg-gray-500',
    };
    return color ? colorMap[color] || 'bg-gray-500' : 'bg-gray-500';
  };

  const supplierTagCount = tags.filter((tag) => tag.type === 'supplier').length;
  const itemTagCount = tags.filter((tag) => tag.type === 'item').length;

  const colorOptions = [
    { name: 'red', label: '赤', class: 'bg-red-500' },
    { name: 'orange', label: 'オレンジ', class: 'bg-orange-500' },
    { name: 'yellow', label: '黄', class: 'bg-yellow-500' },
    { name: 'green', label: '緑', class: 'bg-green-500' },
    { name: 'blue', label: '青', class: 'bg-blue-500' },
    { name: 'purple', label: '紫', class: 'bg-purple-500' },
    { name: 'pink', label: 'ピンク', class: 'bg-pink-500' },
    { name: 'gray', label: 'グレー', class: 'bg-gray-500' },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">タグ管理</h1>
          <p className="text-sm text-gray-500 mt-1">取引先タグと品目タグを管理します</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 btn-secondary">
            <Download size={18} />
            <span>エクスポート</span>
          </button>
          <button className="flex items-center gap-2 btn-secondary">
            <UploadIcon size={18} />
            <span>インポート</span>
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 btn-primary">
            <Plus size={18} />
            <span>新規タグ</span>
          </button>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h3 className="text-sm font-medium text-gray-600">取引先タグ</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{supplierTagCount}</div>
          <div className="text-xs text-gray-500 mt-1">全業務の取引先タグ</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h3 className="text-sm font-medium text-gray-600">品目タグ</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{itemTagCount}</div>
          <div className="text-xs text-gray-500 mt-1">全業務の品目タグ</div>
        </div>
      </div>

      {/* タグ一覧カード */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ一覧</h2>
          <p className="text-sm text-gray-500 mb-4">
            仕訳やルールで使用するタグを管理します
          </p>

          {/* フィルターとサーチ */}
          <div className="flex items-center gap-4">
            {/* タイプフィルター */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveType('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeType === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setActiveType('supplier')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeType === 'supplier'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  取引先タグ
                </span>
              </button>
              <button
                onClick={() => setActiveType('item')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  activeType === 'item'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  品目タグ
                </span>
              </button>
            </div>

            {/* 検索バー */}
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="タグを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
        </div>

        {/* タグテーブル */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  色
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  タグ名
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  タイプ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  説明
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
              {filteredTags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    タグが見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className={`w-6 h-6 rounded-full ${getColorClass(tag.color)}`}></div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium text-white ${getColorClass(
                          tag.color
                        )}`}
                      >
                        {tag.name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`badge ${tag.type === 'supplier' ? 'badge-blue' : 'badge-green'}`}>
                        {tag.type === 'supplier' ? '取引先' : '品目'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">{tag.description || '-'}</td>
                    <td className="px-4 py-4">
                      <span className={`badge ${tag.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {tag.status === 'active' ? '有効' : '無効'}
                      </span>
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
        title="新規タグ"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タイプ <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="supplier"
                  checked={formData.type === 'supplier'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">取引先タグ</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="item"
                  checked={formData.type === 'item'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">品目タグ</span>
              </label>
            </div>
          </div>

          {/* タグ名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タグ名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Amazon"
            />
          </div>

          {/* 色選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              色 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.name })}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg transition-all ${
                    formData.color === color.name
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full ${color.class}`}></div>
                  <span className="text-sm text-gray-700">{color.label}</span>
                </button>
              ))}
            </div>
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
              placeholder="オンラインショップ"
            />
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