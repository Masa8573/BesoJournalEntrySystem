import { ArrowLeft, ArrowRight, Save, CheckCircle } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';

export interface WorkflowNavigationProps {
  onBeforeNext?: () => Promise<boolean> | boolean; // 次へ進む前の検証
  nextLabel?: string; // 次へボタンのラベル
  showComplete?: boolean; // 完了ボタンを表示（最終ステップ）
}

export default function WorkflowNavigation({
  onBeforeNext,
  nextLabel = '次へ',
  showComplete = false,
}: WorkflowNavigationProps) {
  const {
    currentWorkflow,
    goToNextStep,
    goToPreviousStep,
    saveAndExit,
    completeWorkflow,
    canGoToNextStep,
    canGoToPreviousStep,
    markCurrentStepComplete,
  } = useWorkflow();

  if (!currentWorkflow) {
    return null; // ワークフロー外では表示しない
  }

  const handleNext = async () => {
    // 次へ進む前の検証
    if (onBeforeNext) {
      const canProceed = await onBeforeNext();
      if (!canProceed) {
        return;
      }
    }

    // 現在のステップを完了としてマーク
    markCurrentStepComplete();

    // 次のステップへ
    goToNextStep();
  };

  const handleComplete = () => {
    if (window.confirm('ワークフローを完了しますか？\n（進捗データは削除されます）')) {
      markCurrentStepComplete();
      completeWorkflow();
    }
  };

  const handleSaveAndExit = () => {
    if (window.confirm('進捗を保存して中断しますか？\n（後で続きから再開できます）')) {
      saveAndExit();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* 左側: 前へボタン */}
        <button
          onClick={goToPreviousStep}
          disabled={!canGoToPreviousStep()}
          className={`
            flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-all
            ${
              canGoToPreviousStep()
                ? 'border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                : 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
            }
          `}
        >
          <ArrowLeft size={18} />
          <span>前へ</span>
        </button>

        {/* 中央: 中断ボタン */}
        <button
          onClick={handleSaveAndExit}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          <Save size={18} />
          <span>保存して中断</span>
        </button>

        {/* 右側: 次へ または 完了ボタン */}
        {showComplete ? (
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm"
          >
            <CheckCircle size={18} />
            <span>完了</span>
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canGoToNextStep()}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all shadow-sm
              ${
                canGoToNextStep()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            <span>{nextLabel}</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>

      {/* ヘルプテキスト */}
      <div className="max-w-7xl mx-auto mt-3 text-center">
        <p className="text-xs text-gray-500">
          💡 ヒント: 「保存して中断」で進捗を保存できます。後で顧客一覧から再開できます。
        </p>
      </div>
    </div>
  );
}