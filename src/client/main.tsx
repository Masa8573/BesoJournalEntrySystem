import React, { createContext, useContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { WorkflowProvider } from './context/WorkflowContext';
import Layout from './components/layout/Layout';
import './index.css';

// ページコンポーネントのインポート
import ClientsPage from './pages/clients';
import UploadPage from './pages/upload';
import OCRPage from './pages/ocr';
import AiCheckPage from './pages/aicheck';
import ReviewPage from './pages/review';
import ExportPage from './pages/export';
import SummaryPage from './pages/summary';
import ExcludedPage from './pages/excluded';
import LoginPage from './pages/login';

// マスタ登録コンポーネント
import RulesPage from './pages/master/rules';
import AccountsPage from './pages/master/accounts';
import TagsPage from './pages/master/tags';
import TaxCategoriesPage from './pages/master/taxCategories';
import IndustriesPage from './pages/master/industries';
import SettingsPage from './pages/settings';

// ============================================================
// AuthContext 型定義
// ============================================================
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

// ============================================================
// AuthContext 作成（export して Layout.tsx からも参照可能にする）
// ============================================================
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

// AuthContext を使うためのカスタムフック
export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

// ============================================================
// AuthProvider
// Supabase のセッションを監視し、user / loading を管理する
// ============================================================
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 初回マウント時に既存セッションを確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. ログイン・ログアウト・セッション更新を自動検知
    //    Google OAuth のコールバック（URLの #access_token など）もここで処理される
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // loading が true のままなら false にする（OAuth リダイレクト直後対応）
      setLoading(false);
    });

    // クリーンアップ
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// PrivateRoute
// 未認証ならログインページへリダイレクトする保護ルート
// ============================================================
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // セッション確認中はスピナーを表示（ちらつき防止）
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証 → /login へリダイレクト
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ============================================================
// App
// ============================================================
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ─── 公開ルート（認証不要）───────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ─── 保護ルート（認証必須）───────────────────── */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <WorkflowProvider>
                  <Layout>
                    <Routes>
                      {/* デフォルトルート */}
                      <Route path="/" element={<Navigate to="/clients" replace />} />

                      {/* 業務メニュー */}
                      <Route path="/clients" element={<ClientsPage />} />
                      <Route path="/upload" element={<UploadPage />} />
                      <Route path="/ocr" element={<OCRPage />} />
                      <Route path="/aicheck" element={<AiCheckPage />} />
                      <Route path="/review" element={<ReviewPage />} />
                      <Route path="/export" element={<ExportPage />} />
                      <Route path="/summary" element={<SummaryPage />} />
                      <Route path="/excluded" element={<ExcludedPage />} />

                      {/* マスタ管理 */}
                      <Route path="/master/rules" element={<RulesPage />} />
                      <Route path="/master/accounts" element={<AccountsPage />} />
                      <Route path="/master/tags" element={<TagsPage />} />
                      <Route path="/master/tax-categories" element={<TaxCategoriesPage />} />
                      <Route path="/master/industries" element={<IndustriesPage />} />
                      <Route path="/settings" element={<SettingsPage />} />

                      {/* 404 */}
                      <Route path="*" element={<Navigate to="/clients" replace />} />
                    </Routes>
                  </Layout>
                </WorkflowProvider>
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);