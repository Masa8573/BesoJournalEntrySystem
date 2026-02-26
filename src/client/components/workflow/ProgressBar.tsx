import { CheckCircle } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { getStepName } from '@/client/lib/workflowStorage';

export default function ProgressBar() {
  const { currentWorkflow, isStepComplete, goToStep } = useWorkflow();

  if (!currentWorkflow) {
    return null; // ワークフロー外では表示しない
  }

  const steps = [1, 2, 3, 4, 5, 6, 7, 8];
  const currentStep = currentWorkflow.currentStep;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        {/* 顧客名表示 */}
        <div className="mb-3">
          <p className="text-sm text-gray-600">
            進行中: <span className="font-semibold text-gray-900">{currentWorkflow.clientName}</span>
          </p>
        </div>

        {/* 進捗バー */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isComplete = isStepComplete(step);
            const isCurrent = step === currentStep;
            const isPast = step < currentStep;
            const isClickable = isPast || isComplete;

            return (
              <div key={step} className="flex items-center flex-1">
                {/* ステップ */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => isClickable && goToStep(step)}
                    disabled={!isClickable}
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                      ${isCurrent
                        ? 'border-blue-600 bg-blue-600 text-white shadow-lg'
                        : isComplete
                        ? 'border-green-500 bg-green-500 text-white'
                        : isPast
                        ? 'border-gray-400 bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200'
                        : 'border-gray-300 bg-white text-gray-400'
                      }
                      ${isClickable && !isCurrent ? 'cursor-pointer' : ''}
                      ${!isClickable ? 'cursor-not-allowed' : ''}
                    `}
                  >
                    {isComplete ? (
                      <CheckCircle size={20} />
                    ) : (
                      <span className="text-sm font-semibold">{step}</span>
                    )}
                  </button>

                  {/* ステップ名 */}
                  <div className="mt-2 text-center">
                    <p
                      className={`text-xs font-medium ${
                        isCurrent
                          ? 'text-blue-600'
                          : isComplete
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {getStepName(step)}
                    </p>
                  </div>
                </div>

                {/* 接続線（最後以外） */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-all ${
                      isComplete || step < currentStep
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  ></div>
                )}
              </div>
            );
          })}
        </div>

        {/* 進捗率 */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
          <span>
            進捗: {currentWorkflow.completedSteps.length} / 8 ステップ完了
          </span>
          <span>
            {Math.round((currentWorkflow.completedSteps.length / 8) * 100)}% 完了
          </span>
        </div>

        {/* プログレスバー */}
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{
              width: `${(currentWorkflow.completedSteps.length / 8) * 100}%`,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}