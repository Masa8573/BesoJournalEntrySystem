import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as workflowStorage from '@/client/lib/workflowStorage';
import type { WorkflowState } from '@/client/lib/workflowStorage';

// ============================================
// Context型定義
// ============================================
interface WorkflowContextType {
  // 現在のワークフロー状態
  currentWorkflow: WorkflowState | null;
  
  // ワークフロー操作
  startWorkflow: (clientId: string, clientName: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  updateWorkflowData: (data: Partial<WorkflowState['data']>) => void;
  
  // ナビゲーション
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
  
  // 進捗管理
  markCurrentStepComplete: () => void;
  saveAndExit: () => void;
  completeWorkflow: () => void;
  
  // ユーティリティ
  getAllWorkflows: () => WorkflowState[];
  isStepComplete: (step: number) => boolean;
  canGoToNextStep: () => boolean;
  canGoToPreviousStep: () => boolean;
}

// ============================================
// Context作成
// ============================================
const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================
interface WorkflowProviderProps {
  children: React.ReactNode;
}

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const navigate = useNavigate();
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowState | null>(null);

  // URLからworkflow_idを取得してワークフローを復元
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workflowId = params.get('workflow_id');
    const clientId = params.get('client_id');

    if (workflowId) {
      const workflow = workflowStorage.getWorkflow(workflowId);
      if (workflow) {
        setCurrentWorkflow(workflow);
      }
    } else if (clientId) {
      const workflow = workflowStorage.getWorkflowByClient(clientId);
      if (workflow) {
        setCurrentWorkflow(workflow);
      }
    }
  }, []);

  // ============================================
  // 新規ワークフロー開始
  // ============================================
  const startWorkflow = useCallback((clientId: string, clientName: string) => {
    const workflow = workflowStorage.createWorkflow(clientId, clientName);
    setCurrentWorkflow(workflow);
    
    // 証憑アップロードページへ遷移
    navigate(`/upload?workflow_id=${workflow.id}&client_id=${clientId}`);
  }, [navigate]);

  // ============================================
  // 既存ワークフロー再開
  // ============================================
  const resumeWorkflow = useCallback((workflowId: string) => {
    const workflow = workflowStorage.getWorkflow(workflowId);
    if (!workflow) return;
    
    setCurrentWorkflow(workflow);
    
    // 現在のステップへ遷移
    const path = workflowStorage.getStepPath(workflow.currentStep, workflow.clientId);
    navigate(`${path}${path.includes('?') ? '&' : '?'}workflow_id=${workflow.id}&client_id=${workflow.clientId}`);
  }, [navigate]);

  // ============================================
  // ワークフローデータ更新
  // ============================================
  const updateWorkflowData = useCallback((data: Partial<WorkflowState['data']>) => {
    if (!currentWorkflow) return;
    
    const updated = workflowStorage.updateWorkflow(currentWorkflow.id, {
      data: {
        ...currentWorkflow.data,
        ...data,
      },
    });
    
    if (updated) {
      setCurrentWorkflow(updated);
    }
  }, [currentWorkflow]);

  // ============================================
  // 次のステップへ
  // ============================================
  const goToNextStep = useCallback(() => {
    if (!currentWorkflow) return;
    
    const updated = workflowStorage.moveToNextStep(currentWorkflow.id);
    if (!updated) return;
    
    setCurrentWorkflow(updated);
    
    // 次のステップへ遷移
    const path = workflowStorage.getStepPath(updated.currentStep, updated.clientId);
    navigate(`${path}${path.includes('?') ? '&' : '?'}workflow_id=${updated.id}&client_id=${updated.clientId}`);
  }, [currentWorkflow, navigate]);

  // ============================================
  // 前のステップへ
  // ============================================
  const goToPreviousStep = useCallback(() => {
    if (!currentWorkflow) return;
    
    const updated = workflowStorage.moveToPreviousStep(currentWorkflow.id);
    if (!updated) return;
    
    setCurrentWorkflow(updated);
    
    // 前のステップへ遷移
    const path = workflowStorage.getStepPath(updated.currentStep, updated.clientId);
    navigate(`${path}${path.includes('?') ? '&' : '?'}workflow_id=${updated.id}&client_id=${updated.clientId}`);
  }, [currentWorkflow, navigate]);

  // ============================================
  // 特定ステップへジャンプ
  // ============================================
  const goToStep = useCallback((step: number) => {
    if (!currentWorkflow) return;
    if (step < 1 || step > 8) return;
    
    const updated = workflowStorage.updateWorkflow(currentWorkflow.id, {
      currentStep: step,
    });
    
    if (!updated) return;
    
    setCurrentWorkflow(updated);
    
    const path = workflowStorage.getStepPath(step, updated.clientId);
    navigate(`${path}${path.includes('?') ? '&' : '?'}workflow_id=${updated.id}&client_id=${updated.clientId}`);
  }, [currentWorkflow, navigate]);

  // ============================================
  // 現在のステップを完了としてマーク
  // ============================================
  const markCurrentStepComplete = useCallback(() => {
    if (!currentWorkflow) return;
    
    const updated = workflowStorage.markStepComplete(
      currentWorkflow.id,
      currentWorkflow.currentStep
    );
    
    if (updated) {
      setCurrentWorkflow(updated);
    }
  }, [currentWorkflow]);

  // ============================================
  // 中断して保存
  // ============================================
  const saveAndExit = useCallback(() => {
    if (!currentWorkflow) return;
    
    // 現在のステップを保存
    workflowStorage.updateWorkflow(currentWorkflow.id, {
      currentStep: currentWorkflow.currentStep,
    });
    
    // 顧客一覧へ戻る
    navigate('/clients');
  }, [currentWorkflow, navigate]);

  // ============================================
  // ワークフロー完了
  // ============================================
  const completeWorkflow = useCallback(() => {
    if (!currentWorkflow) return;
    
    workflowStorage.completeWorkflow(currentWorkflow.id);
    setCurrentWorkflow(null);
    
    // 顧客一覧へ戻る
    navigate('/clients');
  }, [currentWorkflow, navigate]);

  // ============================================
  // 全ワークフロー取得
  // ============================================
  const getAllWorkflows = useCallback(() => {
    return workflowStorage.getAllWorkflows();
  }, []);

  // ============================================
  // ステップ完了チェック
  // ============================================
  const isStepComplete = useCallback((step: number): boolean => {
    if (!currentWorkflow) return false;
    return currentWorkflow.completedSteps.includes(step);
  }, [currentWorkflow]);

  // ============================================
  // 次へボタン有効チェック
  // ============================================
  const canGoToNextStep = useCallback((): boolean => {
    if (!currentWorkflow) return false;
    return currentWorkflow.currentStep < 8;
  }, [currentWorkflow]);

  // ============================================
  // 前へボタン有効チェック
  // ============================================
  const canGoToPreviousStep = useCallback((): boolean => {
    if (!currentWorkflow) return false;
    return currentWorkflow.currentStep > 1;
  }, [currentWorkflow]);

  // ============================================
  // Context Value
  // ============================================
  const value: WorkflowContextType = {
    currentWorkflow,
    startWorkflow,
    resumeWorkflow,
    updateWorkflowData,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    markCurrentStepComplete,
    saveAndExit,
    completeWorkflow,
    getAllWorkflows,
    isStepComplete,
    canGoToNextStep,
    canGoToPreviousStep,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

// ============================================
// Custom Hook
// ============================================
export function useWorkflow(): WorkflowContextType {
  const context = useContext(WorkflowContext);
  
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  
  return context;
}