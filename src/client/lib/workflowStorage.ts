// ============================================
// Workflow進捗管理 - localStorage
// ============================================

export interface WorkflowState {
  id: string;
  clientId: string;
  clientName: string;
  currentStep: number; // 1-8
  completedSteps: number[];
  data: {
    documents?: string[]; // アップロードしたドキュメントID
    ocrResults?: string[]; // OCR完了したID
    journalEntries?: string[]; // 生成された仕訳ID
    reviewCompleted?: boolean;  // ← 追加
    exportCompleted?: boolean;
  };
  lastUpdated: string;
  createdAt: string;
}

interface WorkflowStorage {
  workflows: WorkflowState[];
}

const STORAGE_KEY = 'workflow_progress';

// ============================================
// 全ワークフロー取得
// ============================================
export function getAllWorkflows(): WorkflowState[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const storage: WorkflowStorage = JSON.parse(data);
    return storage.workflows || [];
  } catch (error) {
    console.error('Failed to load workflows:', error);
    return [];
  }
}

// ============================================
// 特定ワークフロー取得
// ============================================
export function getWorkflow(workflowId: string): WorkflowState | null {
  const workflows = getAllWorkflows();
  return workflows.find(w => w.id === workflowId) || null;
}

// ============================================
// 顧客IDからワークフロー取得
// ============================================
export function getWorkflowByClient(clientId: string): WorkflowState | null {
  const workflows = getAllWorkflows();
  return workflows.find(w => w.clientId === clientId) || null;
}

// ============================================
// 新規ワークフロー作成
// ============================================
export function createWorkflow(clientId: string, clientName: string): WorkflowState {
  const workflows = getAllWorkflows();
  
  // 既存のワークフローがあれば削除
  const filtered = workflows.filter(w => w.clientId !== clientId);
  
  const newWorkflow: WorkflowState = {
    id: `wf-${Date.now()}`,
    clientId,
    clientName,
    currentStep: 1,
    completedSteps: [],
    data: {},
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  
  filtered.push(newWorkflow);
  saveWorkflows(filtered);
  
  return newWorkflow;
}

// ============================================
// ワークフロー更新
// ============================================
export function updateWorkflow(workflowId: string, updates: Partial<WorkflowState>): WorkflowState | null {
  const workflows = getAllWorkflows();
  const index = workflows.findIndex(w => w.id === workflowId);
  
  if (index === -1) return null;
  
  workflows[index] = {
    ...workflows[index],
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  
  saveWorkflows(workflows);
  return workflows[index];
}

// ============================================
// ステップ完了マーク
// ============================================
export function markStepComplete(workflowId: string, step: number): WorkflowState | null {
  const workflows = getAllWorkflows();
  const index = workflows.findIndex(w => w.id === workflowId);
  
  if (index === -1) return null;
  
  const workflow = workflows[index];
  
  // 完了済みステップに追加（重複回避）
  if (!workflow.completedSteps.includes(step)) {
    workflow.completedSteps.push(step);
    workflow.completedSteps.sort((a, b) => a - b);
  }
  
  workflow.lastUpdated = new Date().toISOString();
  
  saveWorkflows(workflows);
  return workflow;
}

// ============================================
// 次のステップへ進む
// ============================================
export function moveToNextStep(workflowId: string): WorkflowState | null {
  const workflows = getAllWorkflows();
  const index = workflows.findIndex(w => w.id === workflowId);
  
  if (index === -1) return null;
  
  const workflow = workflows[index];
  
  // 現在のステップを完了済みに追加
  if (!workflow.completedSteps.includes(workflow.currentStep)) {
    workflow.completedSteps.push(workflow.currentStep);
  }
  
  // 次のステップへ（最大8）
  if (workflow.currentStep < 8) {
    workflow.currentStep += 1;
  }
  
  workflow.lastUpdated = new Date().toISOString();
  
  saveWorkflows(workflows);
  return workflow;
}

// ============================================
// 前のステップへ戻る
// ============================================
export function moveToPreviousStep(workflowId: string): WorkflowState | null {
  const workflows = getAllWorkflows();
  const index = workflows.findIndex(w => w.id === workflowId);
  
  if (index === -1) return null;
  
  const workflow = workflows[index];
  
  // 前のステップへ（最小1）
  if (workflow.currentStep > 1) {
    workflow.currentStep -= 1;
  }
  
  workflow.lastUpdated = new Date().toISOString();
  
  saveWorkflows(workflows);
  return workflow;
}

// ============================================
// ワークフロー削除
// ============================================
export function deleteWorkflow(workflowId: string): boolean {
  const workflows = getAllWorkflows();
  const filtered = workflows.filter(w => w.id !== workflowId);
  
  if (filtered.length === workflows.length) {
    return false; // 削除対象が見つからなかった
  }
  
  saveWorkflows(filtered);
  return true;
}

// ============================================
// ワークフロー完了（削除）
// ============================================
export function completeWorkflow(workflowId: string): boolean {
  return deleteWorkflow(workflowId);
}

// ============================================
// 内部: ワークフロー保存
// ============================================
function saveWorkflows(workflows: WorkflowState[]): void {
  try {
    const storage: WorkflowStorage = { workflows };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error('Failed to save workflows:', error);
  }
}

// ============================================
// ステップ名取得
// ============================================
export function getStepName(step: number): string {
  const stepNames = [
    '顧客選択',
    '証憑アップロード',
    'OCR処理',
    'AIチェック',
    '仕訳確認',
    '仕訳出力',
    '集計・チェック',
    '対象外証憑',
  ];
  
  return stepNames[step - 1] || '不明';
}

// ============================================
// ステップパス取得
// ============================================
export function getStepPath(step: number, clientId?: string): string {
  const paths = [
    '/clients',
    '/upload',
    '/ocr',
    '/aicheck',
    '/review',
    '/export',
    '/summary',
    '/excluded',
  ];
  
  const basePath = paths[step - 1] || '/clients';
  
  if (clientId && step > 1) {
    return `${basePath}?client_id=${clientId}`;
  }
  
  return basePath;
}