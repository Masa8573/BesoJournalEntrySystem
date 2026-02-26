import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, User as UserIcon, Shield, UserCog } from 'lucide-react';
import { usersApi } from '@/client/lib/mockApi';
import type { User } from '@/types';
import Modal from '@/client/components/ui/Modal';

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'accountant' as 'admin' | 'accountant' | 'staff',
  });

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

  // 新規登録モーダルを開く
  const handleOpenNewModal = () => {
    setEditingUser(null);
    resetForm();
    setShowModal(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // パスワードは編集時に空にする
      role: user.role,
    });
    setShowModal(true);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingUser) {
      // 編集
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };
      
      // パスワードが入力されている場合のみ更新
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await usersApi.update(editingUser.id, updateData);
      if (response.data) {
        alert('ユーザー情報を更新しました');
        setShowModal(false);
        setEditingUser(null);
        resetForm();
        loadUsers();
      }
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

      const userData = {
        ...formData,
        organization_id: 'org-1',
      };

      const response = await usersApi.create(userData);
      if (response.data) {
        alert('ユーザーを登録しました');
        setShowModal(false);
        resetForm();
        loadUsers();
      }
    }
  };

  // 削除処理
  const handleDelete = async (user: User) => {
    if (user.role === 'admin') {
      alert('管理者ユーザーは削除できません');
      return;
    }

    if (!window.confirm(`ユーザー「${user.name}」を削除しますか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    const response = await usersApi.delete(user.id);
    if (response.error === null) {
      alert('ユーザーを削除しました');
      loadUsers();
    } else {
      alert('削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'accountant',
    });
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理者';
      case 'accountant':
        return '税理士';
      case 'staff':
        return '担当者';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield size={16} className="text-red-600" />;
      case 'accountant':
        return <UserCog size={16} className="text-blue-600" />;
      case 'staff':
        return <UserIcon size={16} className="text-gray-600" />;
      default:
        return <UserIcon size={16} />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'badge-red';
      case 'accountant':
        return 'badge-blue';
      case 'staff':
        return 'badge-gray';
      default:
        return 'badge-gray';
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const accountantCount = users.filter((u) => u.role === 'accountant').length;
  const staffCount = users.filter((u) => u.role === 'staff').length;

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
          <h1 className="text-2xl font-bold text-gray-900">ユーザー権限管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            システムユーザーとその権限を管理します
          </p>
        </div>
        <button onClick={handleOpenNewModal} className="flex items-center gap-2 btn-primary">
          <Plus size={18} />
          <span>新規ユーザー</span>
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

          {/* 検索バー */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="名前またはメールアドレスで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* ユーザーリスト */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メールアドレス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  権限
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    ユーザーが見つかりませんでした
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isAdmin = user.role === 'admin';

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon size={20} className="text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{user.email}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                            {getRoleName(user.role)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="編集"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className={`p-1 rounded transition-colors ${
                              isAdmin
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={isAdmin ? '管理者は削除できません' : '削除'}
                            disabled={isAdmin}
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

      {/* 権限説明 */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-sm font-medium text-blue-900 mb-3">💡 権限の説明</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">管理者</p>
              <p className="text-xs text-gray-600">
                すべての機能にアクセスでき、ユーザー管理も可能です。削除不可。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <UserCog size={18} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">税理士</p>
              <p className="text-xs text-gray-600">
                顧客管理、仕訳処理、マスタ管理などの主要機能にアクセスできます。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <UserIcon size={18} className="text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">担当者</p>
              <p className="text-xs text-gray-600">
                証憑アップロードと仕訳確認など、限定的な機能にアクセスできます。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
        }}
        title={editingUser ? 'ユーザー編集' : '新規ユーザー登録'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          {/* パスワード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              パスワード {!editingUser && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              required={!editingUser}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              placeholder={editingUser ? '変更する場合のみ入力' : '8文字以上'}
              minLength={8}
            />
            {editingUser && (
              <p className="text-xs text-gray-500 mt-1">
                パスワードを変更する場合のみ入力してください
              </p>
            )}
            {!editingUser && (
              <p className="text-xs text-gray-500 mt-1">
                8文字以上で設定してください
              </p>
            )}
          </div>

          {/* 権限 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              権限 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={formData.role === 'admin'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="mr-3"
                />
                <div className="flex items-center gap-3 flex-1">
                  <Shield size={20} className="text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">管理者</p>
                    <p className="text-xs text-gray-500">すべての機能にアクセス可能</p>
                  </div>
                </div>
              </label>

              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="accountant"
                  checked={formData.role === 'accountant'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="mr-3"
                />
                <div className="flex items-center gap-3 flex-1">
                  <UserCog size={20} className="text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">税理士</p>
                    <p className="text-xs text-gray-500">主要機能にアクセス可能</p>
                  </div>
                </div>
              </label>

              <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="role"
                  value="staff"
                  checked={formData.role === 'staff'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="mr-3"
                />
                <div className="flex items-center gap-3 flex-1">
                  <UserIcon size={20} className="text-gray-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">担当者</p>
                    <p className="text-xs text-gray-500">限定的な機能にアクセス可能</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setEditingUser(null);
              }}
              className="btn-secondary"
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary">
              {editingUser ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}