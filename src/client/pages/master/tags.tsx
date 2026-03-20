import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Tag as TagIcon } from 'lucide-react';
import type { Tag } from '@/types';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

const COLOR_OPTIONS = [
  { value: '#EF4444', label: '赤', bg: 'bg-red-500' },
  { value: '#F97316', label: 'オレンジ', bg: 'bg-orange-500' },
  { value: '#F59E0B', label: '黄', bg: 'bg-yellow-500' },
  { value: '#10B981', label: '緑', bg: 'bg-green-500' },
  { value: '#3B82F6', label: '青', bg: 'bg-blue-500' },
  { value: '#8B5CF6', label: '紫', bg: 'bg-purple-500' },
  { value: '#EC4899', label: 'ピンク', bg: 'bg-pink-500' },
  { value: '#6B7280', label: 'グレー', bg: 'bg-gray-500' },
];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'document' | 'journal_entry' | 'general'>('all');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({ name: '', tag_type: 'general' as 'document' | 'journal_entry' | 'general', color: '#EF4444' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    // organization_idを取得
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: userRow } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', userData.user.id)
        .single();
      if (userRow) setOrgId(userRow.organization_id);
    }

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('is_active', true)
      .in('tag_type', ['document', 'journal_entry', 'general'])
      .order('name');
    if (error) console.error('タグ取得エラー:', error.message);
    if (data) setTags(data as Tag[]);
    setLoading(false);
  };

  const handleOpenNewModal = () => {
    setEditingTag(null);
    setFormData({ name: '', tag_type: 'general', color: '#EF4444' });
    setShowModal(true);
  };

  const handleOpenEditModal = (tag: Tag) => {
    setEditingTag(tag);
    const validTypes = ['document', 'journal_entry', 'general'] as const;
    const tagType = validTypes.includes(tag.tag_type as any) ? (tag.tag_type as 'document' | 'journal_entry' | 'general') : 'general';
    setFormData({
      name: tag.name,
      tag_type: tagType,
      color: tag.color || '#EF4444',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagData = {
      name: formData.name,
      tag_type: formData.tag_type,
      color: formData.color,
      organization_id: orgId,
      is_active: true,
    };

    if (editingTag) {
      const { error } = await supabase.from('tags').update(tagData).eq('id', editingTag.id);
      if (error) { alert('更新に失敗しました: ' + error.message); return; }
      alert('タグを更新しました');
    } else {
      const { error } = await supabase.from('tags').insert([tagData]);
      if (error) { alert('登録に失敗しました: ' + error.message); return; }
      alert('タグを登録しました');
    }

    setShowModal(false);
    setEditingTag(null);
    loadData();
  };

  const handleDelete = async (tag: Tag) => {
    const typeNames: Record<string, string> = { document: '証憑タグ', journal_entry: '仕訳タグ', general: '汎用タグ' };
    const typeName = typeNames[tag.tag_type] || 'タグ';
    if (!window.confirm(`${typeName}「${tag.name}」を削除しますか？`)) return;
    // 論理削除（is_active=false）
    const { error } = await supabase.from('tags').update({ is_active: false }).eq('id', tag.id);
    if (error) { alert('削除に失敗しました: ' + error.message); }
    else { alert('タグを削除しました'); loadData(); }
  };

  const filtered = tags.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'all') return matchesSearch;
    return matchesSearch && t.tag_type === activeFilter;
  });

  const docCount = tags.filter(t => t.tag_type === 'document').length;
  const journalCount = tags.filter(t => t.tag_type === 'journal_entry').length;
  const generalCount = tags.filter(t => t.tag_type === 'general').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">タグ管理</h1>
          <p className="text-sm text-gray-500 mt-1">証憑タグ・仕訳タグ・汎用タグを管理します（取引先・品目は専用マスタで管理）</p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />新規タグ
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><TagIcon size={20} className="text-orange-600" /><h3 className="text-sm font-medium text-gray-600">証憑タグ</h3></div>
          <div className="text-3xl font-bold text-gray-900">{docCount}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><TagIcon size={20} className="text-blue-600" /><h3 className="text-sm font-medium text-gray-600">仕訳タグ</h3></div>
          <div className="text-3xl font-bold text-gray-900">{journalCount}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><TagIcon size={20} className="text-green-600" /><h3 className="text-sm font-medium text-gray-600">汎用タグ</h3></div>
          <div className="text-3xl font-bold text-gray-900">{generalCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ一覧</h2>
          <div className="flex items-center gap-3 mb-4">
            {([
              { key: 'all' as const, label: `すべて (${tags.length})` },
              { key: 'document' as const, label: `証憑 (${docCount})` },
              { key: 'journal_entry' as const, label: `仕訳 (${journalCount})` },
              { key: 'general' as const, label: `汎用 (${generalCount})` },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-4 py-2 rounded-lg font-medium text-sm ${activeFilter === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="タグ名で検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">タグ名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイプ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">色</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">タグが見つかりませんでした</td></tr>
              ) : (
                filtered.map(tag => (
                  <tr key={tag.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color || '#EF4444' }} />
                        <span className="text-sm font-medium text-gray-900">{tag.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        tag.tag_type === 'document' ? 'bg-orange-100 text-orange-700' :
                        tag.tag_type === 'journal_entry' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {tag.tag_type === 'document' ? '証憑' : tag.tag_type === 'journal_entry' ? '仕訳' : '汎用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-block px-3 py-1 rounded text-white text-xs font-medium" style={{ backgroundColor: tag.color || '#EF4444' }}>サンプル</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenEditModal(tag)} className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(tag)} className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingTag(null); }} title={editingTag ? 'タグ編集' : '新規タグ'} size="md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タグ名 <span className="text-red-500">*</span></label>
            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="例: コスモ石油" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">タイプ <span className="text-red-500">*</span></label>
            <div className="flex gap-4">
              {([
                { value: 'document' as const, label: '証憑タグ' },
                { value: 'journal_entry' as const, label: '仕訳タグ' },
                { value: 'general' as const, label: '汎用タグ' },
              ]).map(type => (
                <label key={type.value} className="flex items-center cursor-pointer">
                  <input type="radio" name="tag_type" value={type.value} checked={formData.tag_type === type.value} onChange={() => setFormData({ ...formData, tag_type: type.value })} className="mr-2" />
                  <span className="text-sm text-gray-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">色 <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-4 gap-3">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${formData.color === color.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className={`w-8 h-8 rounded-full ${color.bg}`} />
                  <span className="text-xs text-gray-700">{color.label}</span>
                  {formData.color === color.value && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">プレビュー</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: formData.color }} />
              <span className="px-3 py-1 rounded text-white text-sm font-medium" style={{ backgroundColor: formData.color }}>{formData.name || 'タグ名'}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setShowModal(false); setEditingTag(null); }} className="btn-secondary">キャンセル</button>
            <button type="submit" className="btn-primary">{editingTag ? '更新する' : '登録する'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}