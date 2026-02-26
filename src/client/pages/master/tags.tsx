import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Tag as TagIcon } from 'lucide-react';
import { tagsApi } from '@/client/lib/mockApi';
import type { Tag } from '@/types';
import Modal from '@/client/components/ui/Modal';

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'supplier' | 'item'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    tag_type: 'supplier' as 'supplier' | 'item',
    color: '#EF4444', // デフォルト: 赤
  });

  // 色の選択肢
  const colorOptions = [
    { value: '#EF4444', label: '赤', bg: 'bg-red-500' },
    { value: '#F97316', label: 'オレンジ', bg: 'bg-orange-500' },
    { value: '#F59E0B', label: '黄', bg: 'bg-yellow-500' },
    { value: '#10B981', label: '緑', bg: 'bg-green-500' },
    { value: '#3B82F6', label: '青', bg: 'bg-blue-500' },
    { value: '#8B5CF6', label: '紫', bg: 'bg-purple-500' },
    { value: '#EC4899', label: 'ピンク', bg: 'bg-pink-500' },
    { value: '#6B7280', label: 'グレー', bg: 'bg-gray-500' },
  ];

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

  // 新規登録モーダルを開く
  const handleOpenNewModal = () => {
    setEditingTag(null);
    resetForm();
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      tag_type: tag.tag_type,
      color: tag.color || '#EF4444',
    });
    setShowModal(true);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tagData = {
      ...formData,
    };

    if (editingTag) {
      // 編集
      const response = await tagsApi.update(editingTag.id, tagData);
      if (response.data) {
        alert('タグを更新しました');
        setShowModal(false);
        setEditingTag(null);
        resetForm();
        loadTags();
      }
    } else {
      // 新規登録
      const response = await tagsApi.create(tagData);
      if (response.data) {
        alert('タグを登録しました');
        setShowModal(false);
        resetForm();
        loadTags();
      }
    }
  };

  // 削除処理
  const handleDelete = async (tag: Tag) => {
    const tagTypeName = tag.tag_type === 'supplier' ? '取引先タグ' : '品目タグ';
    if (!window.confirm(`${tagTypeName}「${tag.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const response = await tagsApi.delete(tag.id);
    if (response.error === null) {
      alert('タグを削除しました');
      loadTags();
    } else {
      alert('削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      tag_type: 'supplier',
      color: '#EF4444',
    });
  };

  const filteredTags = tags.filter((tag) => {
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'supplier') return matchesSearch && tag.tag_type === 'supplier';
    if (activeFilter === 'item') return matchesSearch && tag.tag_type === 'item';
    return matchesSearch;
  });

  const supplierCount = tags.filter((t) => t.tag_type === 'supplier').length;
  const itemCount = tags.filter((t) => t.tag_type === 'item').length;

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
          <p className="text-sm text-gray-500 mt-1">
            取引先タグと品目タグを管理します
          </p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          <span>新規タグ</span>
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TagIcon size={20} className="text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600">取引先タグ</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{supplierCount}</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TagIcon size={20} className="text-green-600" />
            <h3 className="text-sm font-medium text-gray-600">品目タグ</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{itemCount}</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>
      </div>

      {/* タグ一覧カード */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ一覧</h2>

          {/* フィルター */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              すべて ({tags.length})
            </button>
            <button
              onClick={() => setActiveFilter('supplier')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeFilter === 'supplier'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              取引先 ({supplierCount})
            </button>
            <button
              onClick={() => setActiveFilter('item')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeFilter === 'item'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              品目 ({itemCount})
            </button>
          </div>

          {/* 検索バー */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="タグ名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* タグリスト */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  タグ名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  タイプ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  色
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    タグが見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredTags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || '#EF4444' }}
                        ></div>
                        <span className="text-sm font-medium text-gray-900">{tag.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          tag.tag_type === 'supplier' ? 'badge-blue' : 'badge-green'
                        }`}
                      >
                        {tag.tag_type === 'supplier' ? '取引先' : '品目'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className="inline-block px-3 py-1 rounded text-white text-xs font-medium"
                        style={{ backgroundColor: tag.color || '#EF4444' }}
                      >
                        サンプル
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(tag)}
                          className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="編集"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(tag)}
                          className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="削除"
                        >
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

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTag(null);
        }}
        title={editingTag ? 'タグ編集' : '新規タグ'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
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
              placeholder="例: コスモ石油"
            />
          </div>

          {/* タイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              タイプ <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tag_type"
                  value="supplier"
                  checked={formData.tag_type === 'supplier'}
                  onChange={(e) => setFormData({ ...formData, tag_type: e.target.value as 'supplier' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">取引先タグ</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="tag_type"
                  value="item"
                  checked={formData.tag_type === 'item'}
                  onChange={(e) => setFormData({ ...formData, tag_type: e.target.value as 'item' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">品目タグ</span>
              </label>
            </div>
          </div>

          {/* 色選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              色 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`
                    relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                    ${
                      formData.color === color.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className={`w-8 h-8 rounded-full ${color.bg}`}></div>
                  <span className="text-xs text-gray-700">{color.label}</span>
                  {formData.color === color.value && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* プレビュー */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: formData.color }}
              ></div>
              <span
                className="px-3 py-1 rounded text-white text-sm font-medium"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name || 'タグ名'}
              </span>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingTag(null);
              }}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              {editingTag ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}