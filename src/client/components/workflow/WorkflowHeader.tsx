import { useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Save, CheckCircle } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { getStepName, TOTAL_STEPS } from '@/client/lib/workflowStorage';

// ============================================
// Props
// ============================================
export interface WorkflowHeaderProps {
  onBeforeNext?: () => Promise<boolean> | boolean;
  nextLabel?: string;
}

// ============================================
// ステップ定義（5ステップ）
// ============================================
const STEPS = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);

// ============================================
// WorkflowHeader
// ============================================
export default function WorkflowHeader({
  onBeforeNext,
  nextLabel,
}: WorkflowHeaderProps) {
  const {
    currentWorkflow,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    saveAndExit,
    completeWorkflow,
    canGoToNextStep,
    canGoToPreviousStep,
    isStepComplete,
  } = useWorkflow();

  // 次へ / 完了
  const handleNext = useCallback(async () => {
    if (!currentWorkflow) return;

    // 最終ステップの場合は完了処理
    if (currentWorkflow.currentStep >= TOTAL_STEPS) {
      if (onBeforeNext) {
        const canProceed = await onBeforeNext();
        if (!canProceed) return;
      }
      if (window.confirm('ワークフローを完了して集計チェックへ進みますか？')) {
        completeWorkflow();
      }
      return;
    }

    if (!canGoToNextStep()) return;
    if (onBeforeNext) {
      const canProceed = await onBeforeNext();
      if (!canProceed) return;
    }
    goToNextStep();
  }, [currentWorkflow, canGoToNextStep, onBeforeNext, goToNextStep, completeWorkflow]);

  const handlePrev = useCallback(() => {
    if (canGoToPreviousStep()) goToPreviousStep();
  }, [canGoToPreviousStep, goToPreviousStep]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const handleSaveAndExit = () => {
    if (window.confirm('進捗を保存して中断しますか？\n後で顧客一覧から再開できます。')) {
      saveAndExit();
    }
  };

  if (!currentWorkflow) return null;

  const currentStep = currentWorkflow.currentStep;
  const completedCount = currentWorkflow.completedSteps.length;
  const progressPercent = Math.round((completedCount / TOTAL_STEPS) * 100);
  const isLastStep = currentStep >= TOTAL_STEPS;

  // 次へボタンのラベル
  const resolvedNextLabel = isLastStep
    ? '集計チェックへ（完了）'
    : nextLabel || '次へ';

  return (
    <div className="bg-white border-b border-gray-200 flex-shrink-0">
      {/* Row 1: ナビゲーション */}
      <div className="px-6 py-2.5 flex items-center justify-between">
        <button onClick={handlePrev} disabled={!canGoToPreviousStep()}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-all ${
            canGoToPreviousStep() ? 'border-gray-300 text-gray-700 hover:bg-gray-50' : 'border-gray-200 text-gray-300 cursor-not-allowed'
          }`}>
          <ArrowLeft size={15} /><span>前へ</span>
        </button>

        <div className="text-center">
          <p className="text-xs text-gray-400">{currentWorkflow.clientName}</p>
          <p className="text-sm font-semibold text-gray-900">{getStepName(currentStep)}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleSaveAndExit}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="保存して中断">
            <Save size={13} /><span className="hidden sm:inline">中断</span>
          </button>
          <button onClick={handleNext} disabled={!isLastStep && !canGoToNextStep()}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
              isLastStep
                ? 'bg-green-600 text-white hover:bg-green-700'
                : canGoToNextStep()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}>
            {isLastStep && <CheckCircle size={15} />}
            <span>{resolvedNextLabel}</span>
            {!isLastStep && <ArrowRight size={15} />}
          </button>
        </div>
      </div>

      {/* Row 2: ステップインジケーター（5ステップ） */}
      <div className="px-6 pb-3">
        <div className="flex items-center gap-0">
          {STEPS.map((step, index) => {
            const isComplete = isStepComplete(step);
            const isCurrent = step === currentStep;
            const isPast = step < currentStep;
            const isClickable = isPast || isComplete;

            return (
              <div key={step} className="flex items-center flex-1">
                <button
                  onClick={() => isClickable && goToStep(step)}
                  disabled={!isClickable && !isCurrent}
                  className="flex flex-col items-center group"
                  title={getStepName(step)}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                    : isComplete ? 'bg-green-500 text-white'
                    : isPast ? 'bg-gray-300 text-white group-hover:bg-gray-400'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                  } ${isClickable && !isCurrent ? 'cursor-pointer' : ''}`}>
                    {isComplete ? <CheckCircle size={14} /> : step}
                  </div>
                  <span className={`mt-1 text-[10px] leading-tight text-center whitespace-nowrap transition-colors ${
                    isCurrent ? 'text-blue-600 font-semibold' : isComplete ? 'text-green-600 font-medium' : 'text-gray-400'
                  }`}>
                    {getStepName(step)}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-1">
                    <div className={`h-0.5 rounded-full transition-all ${
                      isComplete || step < currentStep ? 'bg-green-400' : isCurrent ? 'bg-blue-200' : 'bg-gray-200'
                    }`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-12 text-right">{progressPercent}% 完了</span>
        </div>
      </div>
    </div>
  );
}