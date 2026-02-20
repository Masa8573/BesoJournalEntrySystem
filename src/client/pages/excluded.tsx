import { FileX, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ExcludedPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button 
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-100 rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">対象外証憑</h1>
        </div>
        <p className="text-sm text-gray-500">山田太郎さんの仕訳登録対象外の証憑</p>
      </div>

      {/* 対象外証憑一覧 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <FileX size={24} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">対象外証憑一覧</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          仕訳登録の対象外とした証憑です。必要に応じて対象に戻すことができます。
        </p>

        {/* 空の状態 */}
        <div className="text-center py-12">
          <FileX size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-600 mb-2">対象外の証憑はありません</p>
          <p className="text-sm text-gray-500">
            仕訳登録対象外にした証憑がここに表示されます
          </p>
        </div>
      </div>

      {/* 対象外理由について */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">対象外証憑について</h2>
        <p className="text-sm text-gray-500 mb-4">
          以下のような書類に該当する証憑を対象外として処理できます:
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">受領書</h3>
            <p className="text-xs text-gray-500">商品やサービスの受領を確認する書類</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">見積書</h3>
            <p className="text-xs text-gray-500">金額や条件の見積もりを示す書類</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">納品書</h3>
            <p className="text-xs text-gray-500">商品の納品内容を記載した書類</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">動画書</h3>
            <p className="text-xs text-gray-500">取引の流れを記録した書類</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-1">その他</h3>
            <p className="text-xs text-gray-500">上記に該当しないその他の書類</p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-medium">注意:</span>{' '}
            対象外にした証憑は、この画面から必要に応じて再び処理対象に戻すことができます。
          </p>
        </div>
      </div>
    </div>
  );
}