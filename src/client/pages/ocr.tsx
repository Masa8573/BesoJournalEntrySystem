import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

interface OCRResult {
  id: string;
  documentId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedText?: string;
  confidence?: number;
  processedAt?: string;
}

export default function OCRPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [processing, setProcessing] = useState(false);

  // アップロード済みドキュメントからOCR結果を初期化
  useEffect(() => {
    if (!currentWorkflow) return;
    
    const documents = currentWorkflow.data.documents || [];
    
    if (documents.length === 0) {
      return;
    }

    const results: OCRResult[] = documents.map((docId, index) => ({
      id: `ocr-${docId}`,
      documentId: docId,
      fileName: `receipt_${String(index + 1).padStart(3, '0')}.jpg`,
      status: 'pending',
    }));

    setOcrResults(results);
  }, [currentWorkflow]);

  // OCR処理開始
  const startOCRProcessing = () => {
    setProcessing(true);

    ocrResults.forEach((result, index) => {
      setTimeout(() => {
        setOcrResults((prev) =>
          prev.map((r) =>
            r.id === result.id ? { ...r, status: 'processing' } : r
          )
        );

        // OCR完了シミュレーション（2秒後）
        setTimeout(() => {
          setOcrResults((prev) =>
            prev.map((r) =>
              r.id === result.id
                ? {
                    ...r,
                    status: 'completed',
                    extractedText: `サンプル抽出テキスト: ${r.fileName}`,
                    confidence: Math.floor(Math.random() * 20) + 80,
                    processedAt: new Date().toISOString(),
                  }
                : r
            )
          );

          // 最後の処理が完了したら
          if (index === ocrResults.length - 1) {
            setProcessing(false);
          }
        }, 2000);
      }, index * 500);
    });
  };

  // 次へ進む前の検証
  const handleBeforeNext = async (): Promise<boolean> => {
    const allCompleted = ocrResults.every((r) => r.status === 'completed');
    
    if (!allCompleted) {
      alert('すべてのOCR処理が完了していません');
      return false;
    }

    // ワークフローデータに保存
    const ocrIds = ocrResults.map((r) => r.id);
    updateWorkflowData({ ocrResults: ocrIds });

    return true;
  };

  const completedCount = ocrResults.filter((r) => r.status === 'completed').length;
  const processingCount = ocrResults.filter((r) => r.status === 'processing').length;
  const pendingCount = ocrResults.filter((r) => r.status === 'pending').length;
  const errorCount = ocrResults.filter((r) => r.status === 'error').length;

  const allCompleted = ocrResults.length > 0 && ocrResults.every((r) => r.status === 'completed');

  // ワークフロー外からのアクセスを防ぐ
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">
            OCR処理を行うには、顧客一覧からワークフローを開始してください。
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
      {/* 進捗バー */}
      <ProgressBar />

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ページヘッダー */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OCR処理</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow.clientName}さんの証憑を自動読み取りします
            </p>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h3 className="text-sm font-medium text-gray-600">総ファイル数</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{ocrResults.length}</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={20} className="text-green-500" />
                <h3 className="text-sm font-medium text-gray-600">完了</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{completedCount}</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Loader size={20} className="text-orange-500" />
                <h3 className="text-sm font-medium text-gray-600">処理中</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{processingCount}</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={20} className="text-red-500" />
                <h3 className="text-sm font-medium text-gray-600">エラー</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{errorCount}</div>
            </div>
          </div>

          {/* OCR開始ボタン */}
          {pendingCount > 0 && !processing && (
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">OCR処理を開始</h3>
                  <p className="text-sm text-gray-600">
                    {ocrResults.length}件のファイルをOCR処理します
                  </p>
                </div>
                <button
                  onClick={startOCRProcessing}
                  className="btn-primary"
                >
                  処理開始
                </button>
              </div>
            </div>
          )}

          {/* 処理状況 */}
          {ocrResults.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                処理状況
              </h2>

              <div className="space-y-3">
                {ocrResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* ファイル名 */}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {result.fileName}
                      </p>
                      {result.processedAt && (
                        <p className="text-xs text-gray-500">
                          処理完了: {new Date(result.processedAt).toLocaleString('ja-JP')}
                        </p>
                      )}
                    </div>

                    {/* 信頼度 */}
                    {result.confidence && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              result.confidence >= 90
                                ? 'bg-green-500'
                                : result.confidence >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${result.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-gray-700">
                          {result.confidence}%
                        </span>
                      </div>
                    )}

                    {/* ステータス */}
                    <div className="flex items-center gap-2">
                      {result.status === 'pending' && (
                        <span className="badge badge-gray">待機中</span>
                      )}
                      {result.status === 'processing' && (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="badge badge-blue">処理中</span>
                        </div>
                      )}
                      {result.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <CheckCircle size={20} className="text-green-500" />
                          <span className="badge badge-green">完了</span>
                        </div>
                      )}
                      {result.status === 'error' && (
                        <div className="flex items-center gap-2">
                          <AlertCircle size={20} className="text-red-500" />
                          <span className="badge badge-red">エラー</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 完了メッセージ */}
          {allCompleted && (
            <div className="card bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle size={32} className="text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">
                    OCR処理が完了しました
                  </h3>
                  <p className="text-sm text-green-700">
                    {ocrResults.length}件のファイルを処理しました。次のステップに進んでください。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ファイルなし */}
          {ocrResults.length === 0 && (
            <div className="card text-center py-12">
              <AlertCircle size={64} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                処理するファイルがありません
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                前のステップで証憑をアップロードしてください
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ナビゲーション */}
      <WorkflowNavigation 
        onBeforeNext={handleBeforeNext}
        nextLabel="AIチェックへ"
      />
    </div>
  );
}