import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function SummaryPage() {
  const uploadDate = '2026-02-18';

  const summary = {
    totalDocuments: 1,
    totalEntries: 1,
    excludedDocuments: 0,
    daysLeft: 0,
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">証憑・仕訳集計</h1>
        <p className="text-sm text-gray-500 mt-1">
          山田太郎 - アップロード日別の証憑数と仕訳数の集計
        </p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={20} className="text-blue-600" />
            <h3 className="text-sm font-medium text-gray-600">証憑 (対象外除く)</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.totalDocuments}</div>
          <div className="text-xs text-gray-500 mt-1">枚</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} className="text-green-600" />
            <h3 className="text-sm font-medium text-gray-600">仕訳数</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.totalEntries}</div>
          <div className="text-xs text-gray-500 mt-1">件</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={20} className="text-red-600" />
            <h3 className="text-sm font-medium text-gray-600">対象外証憑</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.excludedDocuments}</div>
          <div className="text-xs text-gray-500 mt-1">枚</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={20} className="text-orange-600" />
            <h3 className="text-sm font-medium text-gray-600">差分のある日</h3>
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.daysLeft}</div>
          <div className="text-xs text-gray-500 mt-1">日</div>
        </div>
      </div>

      {/* 日別集計テーブル */}
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