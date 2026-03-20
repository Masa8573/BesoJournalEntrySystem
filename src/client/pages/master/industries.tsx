import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, ChevronDown, ChevronRight, ArrowLeft, AlertCircle } from 'lucide-react';
import type { Industry, Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

// ============================================
// 型拡張
// ============================================
interface IndustryNode extends Industry {
  children: IndustryNode[];
  level: number;
  clientCount: number;
}

// ============================================
// メインコンポーネント
// ============================================
export default function IndustriesPage() {
  const navigate = useNavigate();
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    parent_id: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [indRes, clientRes] = await Promise.all([
      supabase.from('industries').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('clients').select('id, industry_id'),
    ]);
    if (indRes.data) {
      setIndustries(indRes.data as Industry[]);
      // Level 1を初期展開
      const level1Ids = new Set((indRes.data as Industry[]).filter(i => !i.parent_id).map(i => i.id));
      setExpanded(level1Ids);
    }
    if (clientRes.data) setClients(clientRes.data as Client[]);
    setLoading(false);
  };

  // ============================================
  // ツリー構築
  // ============================================
  const tree = useMemo(() => {
    const getClientCount = (id: string): number => {
      const direct = clients.filter(c => c.industry_id === id).length;
      const childIds = industries.filter(i => i.parent_id === id).map(i => i.id);
      const childCount = childIds.reduce((sum, cid) => sum + getClientCount(cid), 0);
      return direct + childCount;
    };

    const buildTree = (parentId: string | null, level: number): IndustryNode[] => {
      return industries
        .filter(i => i.parent_id === parentId)
        .map(i => ({
          ...i,
          level,
          clientCount: getClientCount(i.id),
          children: buildTree(i.id, level + 1),
        }));
    };

    return buildTree(null, 0);
  }, [industries, clients]);

  // フィルター
  const matchesSearch = (node: IndustryNode): boolean => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q) ||
        (node.description?.toLowerCase().includes(q) ?? false)) return true;
    return node.children.some(c => matchesSearch(c));
  };

  // 展開/折りたたみ
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(industries.map(i => i.id)));
  const collapseAll = () => setExpanded(new Set());

  // ============================================
  // CRUD
  // ============================================
  const handleOpenNewModal = (parentId = '') => {
    setEditingIndustry(null);
    setFormData({ code: '', name: '', description: '', parent_id: parentId });
    setShowModal(true);
  };

  const handleOpenEditModal = (industry: Industry) => {
    setEditingIndustry(industry);
    setFormData({
      code: industry.code,
      name: industry.name,
      description: industry.description || '',
      parent_id: industry.parent_id || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // sort_order を親の子の数から自動計算
    const siblings = industries.filter(i => (i.parent_id || '') === formData.parent_id);
    const maxSort = siblings.reduce((max, s) => Math.max(max, s.sort_order), 0);

    const data = {
      code: formData.code,
      name: formData.name,
      description: formData.description || null,
      parent_id: formData.parent_id || null,
      sort_order: editingIndustry ? editingIndustry.sort_order : maxSort + 1,
      is_active: true,
    };

    if (editingIndustry) {
      const { error } = await supabase.from('industries').update(data).eq('id', editingIndustry.id);
      if (error) { alert('更新に失敗しました: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('industries').insert([data]);
      if (error) { alert('登録に失敗しました: ' + error.message); return; }
    }
    setShowModal(false); setEditingIndustry(null); loadData();
  };

  const handleDelete = async (industry: Industry) => {
    const childCount = industries.filter(i => i.parent_id === industry.id).length;
    const clientCount = clients.filter(c => c.industry_id === industry.id).length;

    if (childCount > 0) {
      alert(`この業種には${childCount}件の子項目があります。\n先に子項目を削除または移動してください。`);
      return;
    }
    if (clientCount > 0) {
      alert(`この業種は${clientCount}件の顧客に紐付いています。\n先に顧客の業種を変更してください。`);
      return;
    }
    if (!window.confirm(`「${industry.name}」を削除しますか？`)) return;

    const { error } = await supabase.from('industries').update({ is_active: false }).eq('id', industry.id);
    if (error) alert('削除に失敗しました: ' + error.message);
    else loadData();
  };

  // レベルラベル
  const getLevelLabel = (parentId: string) => {
    if (!parentId) return '業界（Level 1）';
    const parent = industries.find(i => i.id === parentId);
    if (!parent?.parent_id) return '業種（Level 2）';
    return 'ジャンル（Level 3）';
  };

  // 親の選択肢（Level 1 と Level 2 のみ）
  const parentOptions = useMemo(() => {
    const level1 = industries.filter(i => !i.parent_id);
    const options: Array<{ id: string; name: string; level: string }> = [];
    level1.forEach(l1 => {
      options.push({ id: l1.id, name: l1.name, level: '業界' });
      industries.filter(i => i.parent_id === l1.id).forEach(l2 => {
        options.push({ id: l2.id, name: `  └ ${l2.name}`, level: '業種' });
      });
    });
    return options;
  }, [industries]);

  // サマリー
  const level1Count = industries.filter(i => !i.parent_id).length;
  const level2Count = industries.filter(i => i.parent_id && industries.find(p => p.id === i.parent_id && !p.parent_id)).length;
  const level3Count = industries.filter(i => {
    if (!i.parent_id) return false;
    const parent = industries.find(p => p.id === i.parent_id);
    return parent?.parent_id != null;
  }).length;

  // ============================================
  // ツリー行レンダリング
  // ============================================
  const renderRow = (node: IndustryNode): React.ReactNode => {
    if (!matchesSearch(node)) return null;
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children.length > 0;
    const indent = node.level * 24;

    const levelColors = [
      'font-bold text-gray-900',  // Level 0 (業界)
      'font-medium text-gray-800', // Level 1 (業種)
      'text-gray-600',             // Level 2 (ジャンル)
    ];

    const levelBg = [
      'bg-gray-50', // Level 0
      '',           // Level 1
      '',           // Level 2
    ];

    return (
      <React.Fragment key={node.id}>
        <tr className={`hover:bg-blue-50/30 transition-colors ${levelBg[node.level] || ''}`}>
          <td className="px-4 py-2.5" style={{ paddingLeft: 16 + indent }}>
            <div className="flex items-center gap-1.5">
              {hasChildren ? (
                <button onClick={() => toggleExpand(node.id)} className="p-0.5 hover:bg-gray-200 rounded">
                  {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className={`text-sm ${levelColors[node.level] || 'text-gray-600'}`}>{node.name}</span>
            </div>
          </td>
          <td className="px-4 py-2.5 text-xs font-mono text-gray-400">{node.code}</td>
          <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{node.description || '-'}</td>
          <td className="px-4 py-2.5 text-sm text-center">
            {node.clientCount > 0 ? (
              <span className="text-blue-600 font-medium">{node.clientCount}</span>
            ) : (
              <span className="text-gray-300">-</span>
            )}
          </td>
          <td className="px-4 py-2.5 text-right">
            <div className="flex items-center justify-end gap-0.5">
              {node.level < 2 && (
                <button onClick={() => handleOpenNewModal(node.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="子項目を追加">
                  <Plus size={14} />
                </button>
              )}
              <button onClick={() => handleOpenEditModal(node)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="編集">
                <Edit size={14} />
              </button>
              <button onClick={() => handleDelete(node)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="削除">
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && node.children.map(child => renderRow(child))}
      </React.Fragment>
    );
  };

  // ============================================
  // レンダリング
  // ============================================
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} className="text-gray-700" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">業種管理</h1>
          <p className="text-sm text-gray-500 mt-1">業界 → 業種 → ジャンルの3階層で管理します</p>
        </div>
        <button onClick={() => handleOpenNewModal()} className="flex items-center gap-2 btn-primary">
          <Plus size={18} /> 新規追加
        </button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900 mb-1">{industries.length}</div>
          <div className="text-sm text-gray-600">全項目</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="text-2xl font-bold text-blue-600 mb-1">{level1Count}</div>
          <div className="text-sm text-gray-600">業界</div>
        </div>
        <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-4">
          <div className="text-2xl font-bold text-cyan-600 mb-1">{level2Count}</div>
          <div className="text-sm text-gray-600">業種</div>
        </div>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-600 mb-1">{level3Count}</div>
          <div className="text-sm text-gray-600">ジャンル</div>
        </div>
      </div>

      {/* ツールバー */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="業種名・コードで検索..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">すべて展開</button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">すべて閉じる</button>
        </div>
      </div>

      {/* ツリーテーブル */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">名称</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase" style={{ width: 120 }}>コード</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">説明</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase" style={{ width: 80 }}>顧客数</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase" style={{ width: 120 }}>操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tree.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">業種が登録されていません</td></tr>
            ) : tree.map(node => renderRow(node))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
          全 {industries.length} 件（業界 {level1Count} / 業種 {level2Count} / ジャンル {level3Count}）
        </div>
      </div>

      {/* 注意 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-yellow-800">顧客や子項目が紐付いている項目は削除できません。各行の <span className="text-green-600 font-medium">＋</span> ボタンで子項目を追加できます（最大3階層）。</p>
      </div>

      {/* モーダル */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingIndustry(null); }}
        title={editingIndustry ? `編集: ${editingIndustry.name}` : `新規追加（${getLevelLabel(formData.parent_id)}）`} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">親項目</label>
            <select value={formData.parent_id} onChange={e => setFormData(p => ({ ...p, parent_id: e.target.value }))} className="input">
              <option value="">なし（業界として登録）</option>
              {parentOptions.map(o => (
                <option key={o.id} value={o.id}>{o.level === '業界' ? `📁 ${o.name}` : o.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {!formData.parent_id ? '最上位の業界として登録されます' : getLevelLabel(formData.parent_id) + 'として登録されます'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名称 <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="input" placeholder="例: IT・クリエイティブ" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">コード <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.code} onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                className="input font-mono" placeholder="例: IND01" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              className="input" rows={2} placeholder="任意のメモ" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setShowModal(false); setEditingIndustry(null); }}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">キャンセル</button>
            <button type="submit" className="btn-primary">{editingIndustry ? '更新' : '登録'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}