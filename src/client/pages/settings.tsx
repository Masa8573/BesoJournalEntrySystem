import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, User as UserIcon, Shield, UserCog } from 'lucide-react';
import { usersApi } from '@/client/lib/api';
import type { User } from '@/types';
import Modal from '@/client/components/ui/Modal';

// ============================================
// ユーティリティ
// ============================================

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '未ログイン';
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================
// 権限ヘルパー
// ============================================

function getRoleName(role: string): string {
  switch (role) {
    case 'admin':      return '管理者';
    case 'accountant': return '税理士';
    case 'staff':      return '担当者';
    default:           return role;
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'admin':      return <Shield size={16} className="text-red-600" />;
    case 'accountant': return <UserCog size={16} className="text-blue-600" />;
    default:           return <UserIcon size={16} className="text-gray-600" />;
  }
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':      return 'bg-red-100 text-red-800';
    case 'accountant': return 'bg-blue-100 text-blue-800';
    default:           return 'bg-gray-100 text-gray-700';
  }
}

function getStatusBadge(status: string) {
  return status === 'active'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">有効</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">無効</span>;
}

// ============================================
// メインコンポーネント
// ============================================

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'accountant' as 'admin' | 'accountant' | 'staff',
  });

  // ============================================
  // データ読み込み
  // ============================================

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const response = await usersApi.getAll();
    if (response.data) {
      setUsers(response.data);
    }
    setLoading(false);
  };

  // ============================================
  // モーダル制御
  // ============================================

  const handleOpenNewModal = () => {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'accountant' });
  };

  // ============================================
  // 新規登録・編集
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingUser) {
        // 編集
        const updateData: Partial<User> = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };

        const response = await usersApi.update(editingUser.id, updateData);
        if (response.error) {
          alert(`更新に失敗しました: ${response.error}`);
          return;
        }
        alert('ユーザー情報を更新しました');
        handleCloseModal();
        loadUsers();
      } else {
        // 新規登録
        if (!formData.password) {
          alert('パスワードを入力してください');
          return;
        }
        if (formData.password.length < 8) {
          alert('パスワードは8文字以上で設定してください');
          return;
        }

        const response = await usersApi.create({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: 'active',
        });

        if (response.error) {
          alert(`登録に失敗しました: ${response.error}`);
          return;
        }
        alert('ユーザーを登録しました');
        handleCloseModal();
        loadUsers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // 削除
  // ============================================

  const handleDelete = async (user: User) => {
    if (user.role === 'admin') {
      alert('管理者ユーザーは削除できません');
      return;
    }
    if (!window.confirm(`ユーザー「${user.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const response = await usersApi.delete(user.id);
    if (response.error) {
      alert(`削除に失敗しました: ${response.error}`);
    } else {
      alert('ユーザーを削除しました');
      loadUsers();
    }
  };

  // ============================================
  // フィルタリング & 集計
  // ============================================

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminCount      = users.filter((u) => u.role === 'admin').length;
  const accountantCount = users.filter((u) => u.role === 'accountant').length;
  const staffCount      = users.filter((u) => u.role === 'staff').length;

  // ============================================
  // ローディング
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // レンダリング
  // ============================================

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー権限管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            システムユーザーとその権限を管理します
          </p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          新規ユーザー
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={20} className="text-red-600" />
            <h3 className="text-sm font-medium text-gray-600">管理者</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{adminCount}</div>
          <div className="text-xs text-gray-500 mt-1">名</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <UserCog size={20} className="text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600">税理士</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{accountantCount}</div>
          <div className="text-xs text-gray-500 mt-1">名</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <UserIcon size={20} className="text-gray-600" />
            <h3 className="text-sm font-medium text-gray-600">担当者</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{staffCount}</div>
          <div className="text-xs text-gray-500 mt-1">名</div>
        </div>
      </div>

      {/* ユーザー一覧カード */}
      <div className="card">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">ユーザー一覧</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="名前またはメールアドレスで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['名前', 'メールアドレス', '権限', 'ステータス', '最終ログイン', '操作'].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                      h === '操作' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    ユーザーが見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isAdmin = user.role === 'admin';
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      {/* 名前 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <UserIcon size={18} className="text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>

                      {/* メールアドレス */}
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {user.email}
                      </td>

                      {/* 権限 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                            {getRoleName(user.role)}
                          </span>
                        </div>
                      </td>

                      {/* ステータス */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                      </td>

                      {/* 最終ログイン */}
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                        {formatDateTime(user.last_login_at)}
                      </td>

                      {/* 操作 */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isAdmin}
                            className={`p-1.5 rounded transition-colors ${
                              isAdmin
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={isAdmin ? '管理者は削除できません' : '削除'}
                          >
                            <Trash2 size={16} />
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

      {/* 権限説明 */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-sm font-medium text-blue-900 mb-3">💡 権限の説明</h3>
        <div className="space-y-2">
          {[
            { icon: <Shield size={18} className="text-red-600 mt-0.5" />, title: '管理者', desc: 'すべての機能にアクセスでき、ユーザー管理も可能です。削除不可。' },
            { icon: <UserCog size={18} className="text-blue-600 mt-0.5" />, title: '税理士', desc: '顧客管理、仕訳処理、マスタ管理などの主要機能にアクセスできます。' },
            { icon: <UserIcon size={18} className="text-gray-600 mt-0.5" />, title: '担当者', desc: '証憑アップロードと仕訳確認など、限定的な機能にアクセスできます。' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              {item.icon}
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingUser ? 'ユーザー編集' : '新規ユーザー登録'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              名前 <span className="text-red-500">*</span>
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

          {/* メールアドレス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              placeholder="yamada@example.com"
            />
          </div>

          {/* パスワード（新規のみ必須）*/}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              パスワード {!editingUser && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              required={!editingUser}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              placeholder={editingUser ? '変更する場合のみ入力' : '8文字以上'}
              minLength={editingUser ? 0 : 8}
            />
            <p className="text-xs text-gray-500 mt-1">
              {editingUser
                ? 'パスワードを変更する場合のみ入力してください'
                : '8文字以上で設定してください'}
            </p>
          </div>

          {/* 権限 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              権限 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {([
                { value: 'admin',      icon: <Shield size={18} className="text-red-600" />,   label: '管理者',  desc: 'すべての機能にアクセス可能' },
                { value: 'accountant', icon: <UserCog size={18} className="text-blue-600" />,  label: '税理士',  desc: '主要機能にアクセス可能' },
                { value: 'staff',      icon: <UserIcon size={18} className="text-gray-600" />, label: '担当者',  desc: '限定的な機能にアクセス可能' },
              ] as const).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    checked={formData.role === opt.value}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
                    className="mr-3"
                  />
                  <div className="flex items-center gap-3 flex-1">
                    {opt.icon}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCloseModal}
              className="btn-secondary"
              disabled={submitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={submitting}
            >
              {submitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {editingUser ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}