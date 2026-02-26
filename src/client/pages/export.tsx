import { useState } from 'react';
import { Download, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

export default function ExportPage() {
  const { currentWorkflow } = useWorkflow();
  const [exporting, setExporting] = useState(false);
  const [exportCompleted, setExportCompleted] = useState(false);

  const handleExport = () => {
    setExporting(true);
    
    setTimeout(() => {
      setExporting(false);
      setExportCompleted(true);
    }, 2000);
  };

  // ワークフロー外からのアクセスを防ぐ
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">
            仕訳出力を行うには、顧客一覧からワークフローを開始してください。
          </p>
          <a href="/clients" className="btn-primary">
            顧客一覧へ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <ProgressBar />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">仕訳出力</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow.clientName}さん - freeeへ仕訳データをエクスポートします
            </p>
          </div>

          {/* サマリー */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">出力予定</h3>
              <div className="text-3xl font-bold text-gray-900">12</div>
              <div className="text-xs text-gray-500 mt-1">件</div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">合計金額</h3>
              <div className="text-3xl font-bold text-gray-900">¥48,000</div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">対象期間</h3>
              <div className="text-lg font-bold text-gray-900">2026/02</div>
            </div>
          </div>

          {/* エクスポートカード */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">freee連携</h2>
            
            {!exportCompleted ? (
              <div className="text-center py-12">
                <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  仕訳データをエクスポート
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  freee会計へ仕訳データを送信します
                </p>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      エクスポート中...
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      freeeへエクスポート
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  エクスポート完了
                </h3>
                <p className="text-sm text-green-700">
                  freee会計へ12件の仕訳データを送信しました
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkflowNavigation nextLabel="集計・チェックへ" />
    </div>
  );
}