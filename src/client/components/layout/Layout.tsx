import { useState } from 'react';
import { Link, useLocation, useNavigate, useMatch } from 'react-router-dom';
import {
  Users, Upload, Scan, CheckSquare, Eye, Download, BarChart3, FileX, Settings,
  List, Tag, Receipt, Briefcase, Building2, ChevronDown, ChevronRight, LogOut, User, Store, History,
} from 'lucide-react';
import { useAuth } from '../../main';
import { auth } from '../../lib/supabase';
import { useWorkflow } from '../../context/WorkflowContext';

// ============================================================
// サイドバー
// ============================================================
function Sidebar() {
  const location = useLocation();
  const { currentWorkflow } = useWorkflow();

  const workflowMatch = useMatch("/clients/:id/*");
  const clientIdFromPath = workflowMatch?.params?.id;
  const activeClientId = clientIdFromPath ?? currentWorkflow?.clientId ?? '';

  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    '業務': true,
    'マスタ管理': true,
  });

  const toggleSection = (label: string) => {
    setExpandedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => location.pathname === path;

  const workflowPath = (slug: string) =>
    activeClientId ? `/clients/${activeClientId}/${slug}` : '#';

  // -------------------------------------------------------
  // サイドバー構造:
  //   顧客一覧
  //   ├ 集計・チェック
  //   │  └ 対象外履歴
  //   ├ 証憑アップロード  ← ワークフロー①
  //   ├ OCR処理           ← ワークフロー②
  //   ├ AIチェック         ← ワークフロー③
  //   ├ 仕訳確認          ← ワークフロー④
  //   │  └ 対象外証憑
  //   └ 仕訳出力          ← ワークフロー⑤
  // -------------------------------------------------------

  const summaryPath = workflowPath('summary');
  const excludedHistoryPath = workflowPath('excluded');
  const reviewPath = workflowPath('review');
  const reviewExcludedPath = workflowPath('review-excluded');

  const reviewActive = isActive(reviewPath);
  const reviewExcludedActive = isActive(reviewExcludedPath);
  // 仕訳確認にいるとき、対象外証憑リンクも青くする
  const reviewGroupActive = reviewActive || reviewExcludedActive;

  const masterItems = [
    { label: 'ルール管理',         icon: <Settings size={18} />, path: '/master/rules' },
    { label: '勘定科目管理',       icon: <List size={18} />,     path: '/master/accounts' },
    { label: 'タグ管理',           icon: <Tag size={18} />,      path: '/master/tags' },
    { label: '税区分管理',         icon: <Receipt size={18} />,  path: '/master/tax-categories' },
    { label: '業種管理',           icon: <Briefcase size={18} />, path: '/master/industries' },
    { label: '取引先管理',         icon: <Store size={18} />,    path: '/master/suppliers' },
    { label: 'ユーザー権限管理',   icon: <User size={18} />,     path: '/settings' },
  ];

  // サイドバーリンクのレンダリングヘルパー
  const SideLink = ({ path, label, icon, indent = 0, small = false, activeOverride }: {
    path: string; label: string; icon: React.ReactNode; indent?: number; small?: boolean; activeOverride?: boolean;
  }) => {
    const active = activeOverride !== undefined ? activeOverride : isActive(path);
    const disabled = path === '#';
    return (
      <Link
        to={path}
        onClick={(e) => { if (disabled) e.preventDefault(); }}
        className={`flex items-center gap-2 px-3 ${small ? 'py-1' : 'py-1.5'} text-sm rounded-md transition-colors ${
          disabled ? 'text-gray-400 cursor-not-allowed'
          : active ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
        }`}
        style={{ marginLeft: `${indent * 16 + 8}px` }}
      >
        <span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
        <span className={small ? 'text-xs' : ''}>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 h-screen overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Building2 className="text-blue-600" size={24} />
          <h1 className="text-lg font-semibold text-gray-900">仕訳自動化システム</h1>
        </div>
      </div>

      <nav className="p-2">
        {/* ───── 業務セクション ───── */}
        <div className="mb-1">
          <button onClick={() => toggleSection('業務')}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <span className="flex items-center gap-2"><Building2 size={18} />業務</span>
            {expandedSections['業務'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {expandedSections['業務'] && (
            <div className="mt-1 space-y-0.5">
              {/* 顧客一覧 */}
              <Link to="/clients" className={`flex items-center gap-2 px-3 py-2 ml-2 text-sm rounded-md transition-colors ${
                isActive('/clients') ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`}>
                <span className={isActive('/clients') ? 'text-blue-600' : 'text-gray-500'}><Users size={18} /></span>
                <span>顧客一覧</span>
              </Link>

              <div className="mt-1 ml-4 border-l-2 border-gray-200 space-y-0.5">
                {/* 集計・チェック */}
                <SideLink path={summaryPath} label="集計・チェック" icon={<BarChart3 size={18} />} />
                {/* └ 対象外履歴 */}
                <SideLink path={excludedHistoryPath} label="対象外履歴" icon={<History size={16} />} indent={1} small />

                {/* ワークフロー系 */}
                <SideLink path={workflowPath('upload')} label="証憑アップロード" icon={<Upload size={18} />} />
                <SideLink path={workflowPath('ocr')} label="OCR処理" icon={<Scan size={18} />} />
                <SideLink path={workflowPath('aicheck')} label="AIチェック" icon={<CheckSquare size={18} />} />

                {/* 仕訳確認 */}
                <SideLink path={reviewPath} label="仕訳確認" icon={<Eye size={18} />} activeOverride={reviewGroupActive} />
                {/* └ 対象外証憑（仕訳確認と同時にアクティブ色） */}
                <SideLink path={reviewExcludedPath} label="対象外証憑" icon={<FileX size={16} />} indent={1} small activeOverride={reviewGroupActive} />

                {/* 仕訳出力 */}
                <SideLink path={workflowPath('export')} label="仕訳出力" icon={<Download size={18} />} />
              </div>
            </div>
          )}
        </div>

        {/* ───── マスタ管理セクション ───── */}
        <div className="mb-1">
          <button onClick={() => toggleSection('マスタ管理')}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <span className="flex items-center gap-2"><Settings size={18} />マスタ管理</span>
            {expandedSections['マスタ管理'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {expandedSections['マスタ管理'] && (
            <div className="mt-1 space-y-1">
              {masterItems.map((item) => (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 ml-2 text-sm rounded-md transition-colors ${
                    isActive(item.path) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  <span className={isActive(item.path) ? 'text-blue-600' : 'text-gray-500'}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}

// ============================================================
// ヘッダー
// ============================================================
function Header() {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user } = useAuth();

  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? '';
  const displayEmail = user?.email ?? '';
  const displayRole = user?.user_metadata?.role ?? 'ユーザー';

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await auth.signOut();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="relative">
        <button onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 leading-tight">{displayName}</p>
            <p className="text-xs text-gray-500 leading-tight">{displayRole}</p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{displayEmail}</p>
              </div>
              <Link to="/settings" onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <Settings size={16} /><span>設定</span>
              </Link>
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <LogOut size={16} /><span>ログアウト</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

// ============================================================
// Layout
// ============================================================
interface LayoutProps { children: React.ReactNode; }

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 overflow-auto">
      <div className="flex h-screen min-w-[1280px]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          <Header />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}