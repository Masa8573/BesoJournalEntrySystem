import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Users,
  Upload,
  Scan,
  CheckSquare,
  ClipboardCheck,
  Download,
  BarChart3,
  FileX,
  Settings,
  List,
  Tag,
  Receipt,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Bell,
  LogOut,
  User,
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    label: '業務',
    children: [
      { label: '顧客一覧', icon: <Users size={18} />, path: '/clients' },
      { label: '証憑アップロード', icon: <Upload size={18} />, path: '/upload' },
      { label: 'OCR処理', icon: <Scan size={18} />, path: '/ocr' },
      { label: 'AIチェック', icon: <CheckSquare size={18} />, path: '/review' },
      { label: '仕訳出力', icon: <Download size={18} />, path: '/export' },
      { label: '集計・チェック', icon: <BarChart3 size={18} />, path: '/summary' },
      { label: '対象外証憑', icon: <FileX size={18} />, path: '/excluded' },
    ],
  },
  {
    label: 'マスタ管理',
    children: [
      { label: 'ルール管理', icon: <Settings size={18} />, path: '/master/rules' },
      { label: '勘定科目管理', icon: <List size={18} />, path: '/master/accounts' },
      { label: 'タグ管理', icon: <Tag size={18} />, path: '/master/tags' },
      { label: '税区分管理', icon: <Receipt size={18} />, path: '/master/tax-categories' },
      { label: '業種管理', icon: <Briefcase size={18} />, path: '/master/industries' },
      { label: 'ユーザー権限管理', icon: <User size={18} />, path: '/settings' },
    ],
  },
];

// サイドバーコンポーネント
function Sidebar() {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    '業務': true,
    'マスタ管理': false,
  });

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 h-screen overflow-y-auto">
      {/* ロゴ・ヘッダー部分 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Building2 className="text-blue-600" size={24} />
          <h1 className="text-lg font-semibold text-gray-900">経理自動化</h1>
        </div>
      </div>

      {/* メニュー */}
      <nav className="p-2">
        {menuItems.map((section) => (
          <div key={section.label} className="mb-1">
            {/* セクションヘッダー */}
            <button
              onClick={() => toggleSection(section.label)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <span>{section.label}</span>
              {expandedSections[section.label] ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {/* サブメニュー */}
            {expandedSections[section.label] && section.children && (
              <div className="mt-1 space-y-1">
                {section.children.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path || '#'}
                    className={`
                      flex items-center gap-2 px-3 py-2 ml-2 text-sm rounded-md transition-colors
                      ${
                        isActive(item.path || '')
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <span className={isActive(item.path || '') ? 'text-blue-600' : 'text-gray-500'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

// ヘッダーコンポーネント
function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false);

  // TODO: 実際のユーザー情報をAuthContextから取得
  const user = {
    name: '田中税理士',
    email: 'tanaka@example.com',
    role: '管理者',
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      {/* 左側: ページタイトル等 */}
      <div className="flex items-center">
        <h2 className="text-xl font-semibold text-gray-800">
          {/* ページタイトルは各ページで設定 */}
        </h2>
      </div>

      {/* 右側: 通知・ユーザーメニュー */}
      <div className="flex items-center gap-4">
        {/* 通知アイコン */}
        <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
          <Bell size={20} />
          {/* 未読バッジ */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* ユーザーメニュー */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          </button>

          {/* ドロップダウンメニュー */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <Settings size={16} />
                <span>設定</span>
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <LogOut size={16} />
                <span>ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// メインレイアウトコンポーネント
interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <Sidebar />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <Header />

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}