import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Briefcase, Users, AlertCircle } from 'lucide-react';
import type { Industry, Client } from '@/types';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', description: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [indRes, clientRes] = await Promise.all([
      supabase.from('industries').select('*').order('sort_order', { ascending: true }),
      supabase.from('clients').select('id, industry_id'),
    ]);
    if (indRes.data) setIndustries(indRes.data as Industry[]);
    if (clientRes.data) setClients(clientRes.data as Client[]);
    setLoading(false);
  };

  const handleOpenNewModal = () => {
    setEditingIndustry(null);
    setFormData({ code: '', name: '', description: '' });
    setShowModal(true);
  };

  const handleOpenEditModal = (industry: Industry) => {
    setEditingIndustry(industry);
    setFormData({ code: industry.code, name: industry.name, description: industry.description || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { code: formData.code, name: formData.name, description: formData.description || null, is_active: true };

    if (editingIndustry) {
      const { error } = await supabase.from('industries').update(data).eq('id', editingIndustry.id);
      if (error) { alert('更新に失敗しました: ' + error.message); return; }
      alert('業種を更新しました');
    } else {
      const { error } = await supabase.from('industries').insert([data]);
      if (error) { alert('登録に失敗しました: ' + error.message); return; }
      alert('業種を登録しました');
    }

    setShowModal(false);
    setEditingIndustry(null);
    setFormData({ code: '', name: '', description: '' });
    loadData();
  };

  const handleDelete = async (industry: Industry) => {
    const count = clients.filter(c => c.industry_id === industry.id).length;
    if (count > 0) {
      alert(`この業種は${count}件の顧客に紐付いています。\n先に顧客の業種を変更してから削除してください。`);
      return;
    }
    if (!window.confirm(`業種「${industry.name}」を削除しますか？`)) return;
    const { error } = await supabase.from('industries').delete().eq('id', industry.id);
    if (error) { alert('削除に失敗しました: ' + error.message); }
    else { alert('業種を削除しました'); loadData(); }
  };

  const getClientCount = (id: string) => clients.filter(c => c.industry_id === id).length;

  const filtered = industries.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

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
          <h1 className="text-2xl font-bold text-gray-900">業種管理</h1>
          <p className="text-sm text-gray-500 mt-1">顧客の業種マスタを管理します</p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />新規業種
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><Briefcase size={20} className="text-blue-600" /><h3 className="text-sm font-medium text-gray-600">登録業種数</h3></div>
          <div className="text-3xl font-bold text-gray-900">{industries.length}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><Users size={20} className="text-green-600" /><h3 className="text-sm font-medium text-gray-600">総顧客数</h3></div>
          <div className="text-3xl font-bold text-gray-900">{clients.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">業種一覧</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="業種名またはコードで検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">業種コード</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">業種名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">説明</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">顧客数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">業種が見つかりませんでした</td></tr>
              ) : (
                filtered.map(industry => {
                  const count = getClientCount(industry.id);
                  return (
                    <tr key={industry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{industry.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{industry.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{industry.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{count}件</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEditModal(industry)} className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded" title="編集"><Edit size={18} /></button>
                          <button onClick={() => handleDelete(industry)} disabled={count > 0} className={`p-1 rounded ${count > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-red-600 hover:bg-red-50'}`} title={count > 0 ? '顧客が紐付いているため削除不可' : '削除'}><Trash2 size={18} /></button>
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

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
          <p className="text-sm text-yellow-800">顧客が紐付いている業種は削除できません。削除する場合は、先に該当する顧客の業種を変更してください。</p>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingIndustry(null); }} title={editingIndustry ? '業種編集' : '新規業種'} size="md">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">業種コード <span className="text-red-500">*</span></label>
            <input type="text" required value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} className="input font-mono" placeholder="例: driver" />
            <p className="text-xs text-gray-500 mt-1">半角英数字とアンダースコアのみ</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">業種名 <span className="text-red-500">*</span></label>
            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="例: ドライバー" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="input" rows={3} placeholder="業種の説明（任意）" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setShowModal(false); setEditingIndustry(null); }} className="btn-secondary">キャンセル</button>
            <button type="submit" className="btn-primary">{editingIndustry ? '更新する' : '登録する'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}