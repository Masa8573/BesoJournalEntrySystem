import { CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

export default function SummaryPage() {
  const { currentWorkflow } = useWorkflow();

  // ワークフロー外からのアクセスを防ぐ
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">
            集計・チェックを行うには、顧客一覧からワークフローを開始してください。
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
            <h1 className="text-2xl font-bold text-gray-900">集計・チェック</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow.clientName}さん - 仕訳データの集計結果を確認します
            </p>
          </div>

          {/* サマリー */}
          <div className="grid grid-cols-4 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">総仕訳数</h3>
              <div className="text-3xl font-bold text-gray-900">12</div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">収入</h3>
              <div className="text-2xl font-bold text-blue-600">¥350,000</div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">支出</h3>
              <div className="text-2xl font-bold text-red-600">¥48,000</div>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-600 mb-2">差額</h3>
              <div className="text-2xl font-bold text-green-600">¥302,000</div>
            </div>
          </div>

          {/* 勘定科目別集計 */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">勘定科目別集計</h2>
            <div className="space-y-3">
              {[
                { name: '燃料費', amount: 24000, percent: 50 },
                { name: '消耗品費', amount: 12000, percent: 25 },
                { name: '通信費', amount: 8000, percent: 17 },
                { name: 'その他', amount: 4000, percent: 8 },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-gray-700">{item.name}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full flex items-center justify-end pr-2"
                      style={{ width: `${item.percent}%` }}
                    >
                      <span className="text-xs text-white font-medium">{item.percent}%</span>
                    </div>
                  </div>
                  <div className="w-24 text-sm font-bold text-gray-900 text-right">
                    ¥{item.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 完了メッセージ */}
          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle size={32} className="text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">集計完了</h3>
                <p className="text-sm text-green-700">
                  データに問題がなければ、次のステップに進んでください。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WorkflowNavigation nextLabel="対象外証憑へ" />
    </div>
  );
}