import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import './index.css';

// ページコンポーネントのインポート
import ClientsPage from './pages/clients';
import UploadPage from './pages/upload';
import OCRPage from './pages/ocr';
import ReviewPage from './pages/review';
import ExportPage from './pages/export';
import SummaryPage from './pages/summary';
import ExcludedPage from './pages/excluded';
import RulesPage from './pages/master/rules';
import AccountsPage from './pages/master/accounts';
import TagsPage from './pages/master/tags';
import TaxCategoriesPage from './pages/master/taxCategories';
import IndustriesPage from './pages/master/industries';
import SettingsPage from './pages/settings';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* デフォルトルート - 顧客一覧にリダイレクト */}
          <Route path="/" element={<Navigate to="/clients" replace />} />
          
          {/* 業務メニュー */}
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/ocr" element={<OCRPage />} />
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
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);