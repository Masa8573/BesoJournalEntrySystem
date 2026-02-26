import { FileX, AlertCircle } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

export default function ExcludedPage() {
  const { currentWorkflow } = useWorkflow();

  const excludedDocuments = [
    { id: '1', name: 'private_receipt.jpg', reason: 'プライベート支出' },
    { id: '2', name: 'duplicate.pdf', reason: '重複データ' },
  ];

  // ワークフロー外からのアクセスを防ぐ
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">
            対象外証憑を確認するには、顧客一覧からワークフローを開始してください。
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
            <h1 className="text-2xl font-bold text-gray-900">対象外証憑</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow.clientName}さん - 仕訳対象外となった証憑を確認します
            </p>
          </div>

          {/* サマリー */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">対象外証憑</h3>
              <div className="text-3xl font-bold text-gray-900">{excludedDocuments.length}</div>
              <div className="text-xs text-gray-500 mt-1">件</div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">主な理由</h3>
              <div className="text-lg font-bold text-gray-900">プライベート支出</div>
            </div>
          </div>

          {/* 対象外リスト */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">対象外証憑一覧</h2>

            {excludedDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileX size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">対象外証憑はありません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {excludedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.reason}</p>
                    </div>
                    <span className="badge badge-gray">対象外</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 完了メッセージ */}
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <FileX size={32} className="text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">ワークフロー完了準備完了</h3>
                <p className="text-sm text-blue-700">
                  すべてのステップが完了しました。「完了」ボタンを押してワークフローを終了してください。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WorkflowNavigation showComplete={true} />
    </div>
  );
}