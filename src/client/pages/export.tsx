import { useState, useEffect } from 'react';
import { Download, ExternalLink, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { journalEntriesApi } from '@/client/lib/mockApi';
import type { JournalEntry } from '@/types';

export default function ExportPage() {
  const navigate = useNavigate();
  const [selectedPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [uploadDate] = useState('2026-02-18');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJournalEntries();
  }, []);

  const loadJournalEntries = async () => {
    setLoading(true);
    const response = await journalEntriesApi.getAll();
    if (response.data) {
      setJournalEntries(response.data);
    }
    setLoading(false);
  };

  const totalAmount = journalEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const businessCount = journalEntries.filter((e) => e.category === '事業用').length;
  const privateCount = journalEntries.filter((e) => e.category === 'プライベート').length;

  const handleCSVDownload = () => {
    alert('CSVダウンロード機能は実装予定です');
  };

  const handleFreeeExport = () => {
    alert('freee連携機能は実装予定です');
  };

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
      <div>
        <div className="flex items-center gap-2 mb-2">
          <button 
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-100 rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">仕訳出力</h1>
        </div>
        <p className="text-sm text-gray-500">山田太郎さんの仕訳データを出力します</p>
      </div>

      {/* 出力設定カード */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">出力</h2>

        {/* 出力対象の選択 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">出力対象の選択 (アップロード日付)</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            出力する仕訳対象の対象期間を選択または期間でアップロード日付で選択してください
          </p>

          {/* 期間選択 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">全期間</label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">開始月</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input"
                  />
                </div>
                <span className="text-gray-500 mt-6">〜</span>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">終了月</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">アップロード日:</label>
              <input
                type="date"
                value={uploadDate}
                readOnly
                className="input bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {journalEntries.length}
            </div>
            <div className="text-xs text-gray-600">総仕訳数</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">{businessCount}</div>
            <div className="text-xs text-gray-600">事業用</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-600 mb-1">{privateCount}</div>
            <div className="text-xs text-gray-600">プライベート</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              ¥{totalAmount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600">事業用合計</div>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">CSVダウンロード</h3>
            <p className="text-xs text-gray-500 mb-4">
              freee会計の取込フォーマットに準拠したCSVファイルをダウンロードします
            </p>
            <p className="text-xs text-gray-600 mb-2">出力対象: 事業用仕訳 {businessCount}件</p>
            <p className="text-xs text-gray-600 mb-4">ファイル形式: CSV (UTF-8 BOM付き)</p>
            <button 
              onClick={handleCSVDownload}
              className="w-full flex items-center justify-center gap-2 btn-primary"
            >
              <Download size={18} />
              <span>CSVダウンロード</span>
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">freee会計連携</h3>
            <p className="text-xs text-gray-500 mb-4">
              freee会計APIを使用して直接仕訳を登録します
            </p>
            <p className="text-xs text-gray-600 mb-2">出力対象: 事業用仕訳 {businessCount}件</p>
            <p className="text-xs text-gray-600 mb-4">出力先: プロトタイプ版</p>
            <button 
              onClick={handleFreeeExport}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <ExternalLink size={18} />
              <span>freee会計に連携</span>
            </button>
          </div>
        </div>
      </div>

      {/* 仕訳一覧 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">仕訳一覧</h2>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm text-white bg-blue-600 border border-blue-600 rounded hover:bg-blue-700">
              全て ({journalEntries.length})
            </button>
            <button className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
              事業用 ({businessCount})
            </button>
            <button className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
              プライベート ({privateCount})
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          作成済み仕訳を表示中 (クリックで詳細確認へ)
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  取引日
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  区分
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  取引先
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  金額
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  摘要
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {journalEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input type="checkbox" className="rounded" />
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{entry.entry_date}</td>
                  <td className="px-4 py-4">
                    <span className={`badge ${entry.category === '事業用' ? 'badge-green' : 'badge-gray'}`}>
                      {entry.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{entry.supplier || '-'}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    ¥{entry.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">{entry.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}