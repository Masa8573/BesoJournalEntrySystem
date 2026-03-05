import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, BadgeCheck } from 'lucide-react';
import Modal from '@/client/components/ui/Modal';
import { supabase } from '@/client/lib/supabase';

interface Supplier {
  id: string;
  organization_id: string | null;
  client_id: string | null;
  name: string;
  name_kana: string | null;
  code: string | null;
  invoice_number: string | null;
  is_invoice_registered: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface SupplierAlias {
  id: string;
  supplier_id: string;
  alias_name: string;
  source: 'manual' | 'ocr_learned' | 'ai_suggested';
  created_at: string;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'aliases'>('info');
  const [aliases, setAliases] = useState<SupplierAlias[]>([]);
  const [newAliasName, setNewAliasName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    name_kana: '',
    code: '',
    invoice_number: '',
    is_invoice_registered: false,
  });

  useEffect(() => { loadSuppliers(); }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) console.error('取引先取得エラー:', error.message);
    if (data) setSuppliers(data as Supplier[]);
    setLoading(false);
  };

  const loadAliases = async (supplierId: string) => {
    const { data } = await supabase
      .from('supplier_aliases')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at');
    if (data) setAliases(data as SupplierAlias[]);
  };

  const handleOpenNewModal = () => {
    setEditingSupplier(null);
    setActiveModalTab('info');
    setAliases([]);
    setNewAliasName('');
    setFormData({ name: '', name_kana: '', code: '', invoice_number: '', is_invoice_registered: false });
    setShowModal(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setActiveModalTab('info');
    setAliases([]);
    setNewAliasName('');
    setFormData({
      name: supplier.name,
      name_kana: supplier.name_kana || '',
      code: supplier.code || '',
      invoice_number: supplier.invoice_number || '',
      is_invoice_registered: supplier.is_invoice_registered,
    });
    loadAliases(supplier.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      name_kana: formData.name_kana || null,
      code: formData.code || null,
      invoice_number: formData.invoice_number || null,
      is_invoice_registered: formData.is_invoice_registered,
      is_active: true,
    };

    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update(data).eq('id', editingSupplier.id);
      if (error) { alert('更新に失敗しました: ' + error.message); return; }
      alert('取引先を更新しました');
    } else {
      const { error } = await supabase.from('suppliers').insert([data]);
      if (error) { alert('登録に失敗しました: ' + error.message); return; }
      alert('取引先を登録しました');
    }

    setShowModal(false);
    setEditingSupplier(null);
    loadSuppliers();
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!window.confirm(`「${supplier.name}」を削除しますか？\n\nこの操作は取り消せません。`)) return;
    const { error } = await supabase.from('suppliers').update({ is_active: false }).eq('id', supplier.id);
    if (error) { alert('削除に失敗しました: ' + error.message); }
    else { alert('取引先を削除しました'); loadSuppliers(); }
  };

  const handleAddAlias = async () => {
    if (!newAliasName.trim() || !editingSupplier) return;
    const { error } = await supabase.from('supplier_aliases').insert([{
      supplier_id: editingSupplier.id,
      alias_name: newAliasName.trim(),
      source: 'manual',
    }]);
    if (error) { alert('別名の追加に失敗しました: ' + error.message); return; }
    setNewAliasName('');
    loadAliases(editingSupplier.id);
  };

  const handleDeleteAlias = async (alias: SupplierAlias) => {
    if (!window.confirm(`別名「${alias.alias_name}」を削除しますか？`)) return;
    const { error } = await supabase.from('supplier_aliases').delete().eq('id', alias.id);
    if (error) { alert('削除に失敗しました: ' + error.message); }
    else loadAliases(editingSupplier!.id);
  };

  const handleApproveAlias = async (alias: SupplierAlias) => {
    const { error } = await supabase.from('supplier_aliases').update({ source: 'manual' }).eq('id', alias.id);
    if (!error) loadAliases(editingSupplier!.id);
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.name_kana?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    (s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
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
          <h1 className="text-2xl font-bold text-gray-900">取引先管理</h1>
          <p className="text-sm text-gray-500 mt-1">OCR・AI仕訳生成で使用する取引先マスタを管理します</p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />新規取引先
        </button>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">取引先一覧</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="取引先名・読み仮名・インボイス番号で検索..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="input pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引先名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">読み仮名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">インボイス番号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">課税事業者</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {suppliers.length === 0 ? '取引先が登録されていません。「新規取引先」から追加してください。' : '検索条件に一致する取引先が見つかりませんでした'}
                </td></tr>
              ) : (
                filtered.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{supplier.name_kana || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{supplier.invoice_number || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {supplier.is_invoice_registered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <BadgeCheck size={12} />課税
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">未確認</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenEditModal(supplier)} className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={18} /></button>
                        <button onClick={() => handleDelete(supplier)} className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 text-sm text-gray-500">
          {filtered.length} 件表示 / 全 {suppliers.length} 件
        </div>
      </div>

      {/* 登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingSupplier(null); }}
        title={editingSupplier ? `取引先編集：${editingSupplier.name}` : '新規取引先'}
        size="lg"
      >
        {/* タブ（編集時のみ別名タブを表示） */}
        {editingSupplier && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6">
            {(['info', 'aliases'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveModalTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeModalTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {tab === 'info' ? '基本情報' : `別名 (${aliases.length})`}
              </button>
            ))}
          </div>
        )}

        {/* 基本情報タブ */}
        {activeModalTab === 'info' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">取引先名 <span className="text-red-500">*</span></label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="例: エネオス株式会社" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">読み仮名</label>
              <input type="text" value={formData.name_kana} onChange={e => setFormData({ ...formData, name_kana: e.target.value })} className="input" placeholder="例: エネオスカブシキガイシャ" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">略称</label>
              <input type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} className="input" placeholder="例: ENEOS" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">インボイス登録事業者</span>
              <Switch checked={formData.is_invoice_registered} onChange={v => setFormData({ ...formData, is_invoice_registered: v })} />
            </div>
            {formData.is_invoice_registered && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">インボイス番号</label>
                <input type="text" value={formData.invoice_number} onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} className="input" placeholder="T1234567890123" />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => { setShowModal(false); setEditingSupplier(null); }} className="btn-secondary">キャンセル</button>
              <button type="submit" className="btn-primary">{editingSupplier ? '更新する' : '登録する'}</button>
            </div>
          </form>
        )}

        {/* 別名タブ */}
        {activeModalTab === 'aliases' && editingSupplier && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">OCRやAIが認識した名称の揺れを管理します。別名を登録すると、次回から自動でこの取引先として識別されます。</p>

            <div className="space-y-2">
              {aliases.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">別名が登録されていません</p>
              ) : (
                aliases.map(alias => (
                  <div key={alias.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{alias.alias_name}</span>
                      {alias.source === 'ai_suggested' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">AI提案</span>
                      )}
                      {alias.source === 'ocr_learned' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">OCR学習</span>
                      )}
                      {alias.source === 'manual' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">承認済み</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {alias.source === 'ai_suggested' && (
                        <button onClick={() => handleApproveAlias(alias)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">承認</button>
                      )}
                      <button onClick={() => handleDeleteAlias(alias)} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newAliasName}
                onChange={e => setNewAliasName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                className="input flex-1"
                placeholder="別名を入力（例: ENEOSスタンド）"
              />
              <button type="button" onClick={handleAddAlias} disabled={!newAliasName.trim()} className="btn-primary disabled:opacity-50">
                <Plus size={18} />
              </button>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">閉じる</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}