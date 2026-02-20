import { useState } from 'react';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OCRPage() {
  const navigate = useNavigate();
  const [ocrStatus] = useState({
    total: 1,
    completed: 1,
    failed: 0,
    progress: 100,
  });

  const [uploadDate] = useState('2026-02-18');

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
          <h1 className="text-2xl font-bold text-gray-900">OCR処理状況</h1>
        </div>
        <p className="text-sm text-gray-500">山田太郎さんの証憑OCR処理状況</p>
      </div>

      {/* OCR処理完了カード */}
      <div className="card">
        <div className="flex items-center gap-2 text-green-600 mb-4">
          <CheckCircle size={24} />
          <h2 className="text-lg font-semibold">OCR処理完了</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">すべての証憑のOCR処理が完了しました</p>

        {/* 進捗状況 */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>進捗状況</span>
            <span>
              {ocrStatus.completed} / {ocrStatus.total} 件
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-500"
              style={{ width: `${ocrStatus.progress}%` }}
            ></div>
          </div>
          <p className="text-right text-sm font-medium text-gray-700 mt-1">{ocrStatus.progress}%</p>
        </div>

        {/* 処理結果サマリー */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">{ocrStatus.total}</div>
            <div className="text-sm text-gray-600">総件数</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">{ocrStatus.completed}</div>
            <div className="text-sm text-gray-600">完了</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600 mb-1">{ocrStatus.failed}</div>
            <div className="text-sm text-gray-600">失敗</div>
          </div>
        </div>

        {/* 次のステップメッセージ */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            <span className="font-medium">次のステップ:</span>{' '}
            1件の証憑から仕訳データを生成しました。次のステップでAIチェックを実行してください。
          </p>
        </div>

        {/* AIチェック実行ボタン */}
        <button 
          onClick={() => navigate('/review')}
          className="w-full btn-primary"
        >
          AIチェック実行画面へ
        </button>
      </div>

      {/* アップロード履歴 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">日時別集計</h2>
        <p className="text-sm text-gray-500 mb-4">
          アップロード日時と証憑数と仕訳数を表示します
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  アップロード日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  時間
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  証憑数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  仕訳数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  対象外
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  進捗
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ステータス
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-4 text-sm text-gray-900">{uploadDate}</td>
                <td className="px-4 py-4 text-sm text-gray-900">01:28</td>
                <td className="px-4 py-4 text-sm text-gray-900">1枚</td>
                <td className="px-4 py-4 text-sm text-gray-900">1件</td>
                <td className="px-4 py-4 text-sm text-gray-900">0枚</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full" style={{ width: '100%' }}></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">100%</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1 badge badge-green">
                    <CheckCircle size={14} />
                    完了
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded">
                    CSV
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}