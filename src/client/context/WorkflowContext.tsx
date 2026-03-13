import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { workflowsApi, getStepPath, TOTAL_STEPS } from '@/client/lib/workflowStorage';
import type { WorkflowState } from '@/client/lib/workflowStorage';

// ============================================
// Context型定義
// ============================================
interface WorkflowContextType {
  currentWorkflow: WorkflowState | null;
  startWorkflow: (clientId: string, clientName: string) => Promise<void>;
  resumeWorkflow: (workflowId: string) => Promise<void>;
  updateWorkflowData: (data: Partial<WorkflowState['data']>) => Promise<void>;
  goToNextStep: () => Promise<void>;
  goToPreviousStep: () => Promise<void>;
  goToStep: (step: number) => Promise<void>;
  markCurrentStepComplete: () => Promise<void>;
  saveAndExit: () => void;
  completeWorkflow: () => Promise<void>;
  isStepComplete: (step: number) => boolean;
  canGoToNextStep: () => boolean;
  canGoToPreviousStep: () => boolean;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

interface WorkflowProviderProps { children: React.ReactNode; }

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const clientIdFromPath = params.id;
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowState | null>(null);

  // 初期化
  useEffect(() => {
    if (!clientIdFromPath) return;
    if (currentWorkflow?.clientId === clientIdFromPath) return;
    workflowsApi.getByClient(clientIdFromPath).then((workflow) => {
      if (workflow) setCurrentWorkflow(workflow);
    });
  }, [clientIdFromPath]);

  // 新規開始
  const startWorkflow = useCallback(async (clientId: string, clientName: string) => {
    const workflow = await workflowsApi.create(clientId, clientName);
    if (!workflow) return;
    setCurrentWorkflow(workflow);
    navigate(`/clients/${clientId}/upload`);
  }, [navigate]);

  // 再開
  const resumeWorkflow = useCallback(async (workflowId: string) => {
    const workflow = await workflowsApi.getById(workflowId);
    if (!workflow) return;
    setCurrentWorkflow(workflow);
    navigate(getStepPath(workflow.currentStep, workflow.clientId));
  }, [navigate]);

  // データ更新
  const updateWorkflowData = useCallback(async (data: Partial<WorkflowState['data']>) => {
    if (!currentWorkflow) return;
    const mergedData = { ...currentWorkflow.data, ...data };
    const updated = await workflowsApi.update(currentWorkflow.id, { data: mergedData });
    if (updated) setCurrentWorkflow({ ...updated, clientName: currentWorkflow.clientName });
  }, [currentWorkflow]);

  // 次のステップ（5ステップ上限）
  const goToNextStep = useCallback(async () => {
    if (!currentWorkflow) return;
    if (currentWorkflow.currentStep >= TOTAL_STEPS) return;

    const nextStep = currentWorkflow.currentStep + 1;
    const completedSteps = currentWorkflow.completedSteps.includes(currentWorkflow.currentStep)
      ? currentWorkflow.completedSteps
      : [...currentWorkflow.completedSteps, currentWorkflow.currentStep].sort((a, b) => a - b);

    const updated = await workflowsApi.update(currentWorkflow.id, { currentStep: nextStep, completedSteps });
    if (updated) {
      setCurrentWorkflow({ ...updated, clientName: currentWorkflow.clientName });
      navigate(getStepPath(nextStep, updated.clientId));
    }
  }, [currentWorkflow, navigate]);

  // 前のステップ
  const goToPreviousStep = useCallback(async () => {
    if (!currentWorkflow) return;
    if (currentWorkflow.currentStep <= 1) return;
    const prevStep = currentWorkflow.currentStep - 1;
    const updated = await workflowsApi.update(currentWorkflow.id, { currentStep: prevStep });
    if (updated) {
      setCurrentWorkflow({ ...updated, clientName: currentWorkflow.clientName });
      navigate(getStepPath(prevStep, updated.clientId));
    }
  }, [currentWorkflow, navigate]);

  // 特定ステップへ（5ステップ上限）
  const goToStep = useCallback(async (step: number) => {
    if (!currentWorkflow) return;
    if (step < 1 || step > TOTAL_STEPS) return;
    const updated = await workflowsApi.update(currentWorkflow.id, { currentStep: step });
    if (updated) {
      setCurrentWorkflow({ ...updated, clientName: currentWorkflow.clientName });
      navigate(getStepPath(step, updated.clientId));
    }
  }, [currentWorkflow, navigate]);

  // 現在ステップ完了マーク
  const markCurrentStepComplete = useCallback(async () => {
    if (!currentWorkflow) return;
    const step = currentWorkflow.currentStep;
    if (currentWorkflow.completedSteps.includes(step)) return;
    const completedSteps = [...currentWorkflow.completedSteps, step].sort((a, b) => a - b);
    const updated = await workflowsApi.update(currentWorkflow.id, { completedSteps });
    if (updated) setCurrentWorkflow({ ...updated, clientName: currentWorkflow.clientName });
  }, [currentWorkflow]);

  // 中断
  const saveAndExit = useCallback(() => { navigate('/clients'); }, [navigate]);

  // ワークフロー完了 → 集計チェックへ
  const completeWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;
    await workflowsApi.complete(currentWorkflow.id);
    const clientId = currentWorkflow.clientId;
    setCurrentWorkflow(null);
    navigate(`/clients/${clientId}/summary`);
  }, [currentWorkflow, navigate]);

  // チェック
  const isStepComplete = useCallback((step: number): boolean => {
    if (!currentWorkflow) return false;
    return currentWorkflow.completedSteps.includes(step);
  }, [currentWorkflow]);

  const canGoToNextStep = useCallback((): boolean => {
    if (!currentWorkflow) return false;
    return currentWorkflow.currentStep < TOTAL_STEPS;
  }, [currentWorkflow]);

  const canGoToPreviousStep = useCallback((): boolean => {
    if (!currentWorkflow) return false;
    return currentWorkflow.currentStep > 1;
  }, [currentWorkflow]);

  const value: WorkflowContextType = {
    currentWorkflow, startWorkflow, resumeWorkflow, updateWorkflowData,
    goToNextStep, goToPreviousStep, goToStep, markCurrentStepComplete,
    saveAndExit, completeWorkflow, isStepComplete, canGoToNextStep, canGoToPreviousStep,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow(): WorkflowContextType {
  const context = useContext(WorkflowContext);
  if (context === undefined) throw new Error('useWorkflow must be used within a WorkflowProvider');
  return context;
}