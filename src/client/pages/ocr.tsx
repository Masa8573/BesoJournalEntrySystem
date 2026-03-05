import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import { documentsApi } from '@/client/lib/api';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

interface OCRResult {
  id: string;
  documentId: string;
  fileName: string;
  storagePath: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  confidence?: number;
  processedAt?: string;
  errorMessage?: string;
  journalEntryId?: string; // 生成された仕訳のDB ID
}

// Express API のベースURL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function OCRPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [industry, setIndustry] = useState<string>('');

  // ============================================
  // アップロード済みドキュメントを DB から取得して初期化
  // ============================================
  useEffect(() => {
    if (!currentWorkflow) return;

    const documentIds = currentWorkflow.data.documents || [];
    if (documentIds.length === 0) return;

    const initResults = async () => {
      // documents テーブルから詳細を取得
      const results: OCRResult[] = [];
      for (const docId of documentIds) {
        const { data: doc } = await documentsApi.getById(docId);
        if (doc) {
          results.push({
            id: `ocr-${docId}`,
            documentId: docId,
            fileName: doc.original_file_name || doc.file_name,
            storagePath: doc.storage_path || doc.file_path,
            status: doc.ocr_status === 'completed' ? 'completed' : 'pending',
            confidence: doc.ocr_confidence ? doc.ocr_confidence * 100 : undefined,
          });
        }
      }

      // クライアントの業種を取得
      const clientId = currentWorkflow.clientId;
      const { data: client } = await supabase
        .from('clients')
        .select('industry:industries(name)')
        .eq('id', clientId)
        .single();

      if (client?.industry) {
        setIndustry((client.industry as any).name || '');
      }

      setOcrResults(results);
    };

    initResults();
  }, [currentWorkflow]);

  // ============================================
  // OCR + 仕訳生成 処理（1件ずつ順次処理）
  // ============================================
  const startOCRProcessing = async () => {
    setProcessing(true);

    for (let i = 0; i < ocrResults.length; i++) {
      const result = ocrResults[i];
      if (result.status === 'completed') continue; // スキップ（再処理不要）

      // 処理中に更新
      setOcrResults((prev) =>
        prev.map((r) => (r.id === result.id ? { ...r, status: 'processing' } : r))
      );

      try {
        // -----------------------------------------------
        // STEP 1: Storage から署名付き URL を取得してサーバーへ渡す
        // -----------------------------------------------
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(result.storagePath, 300); // 5分有効

        if (urlError || !signedUrlData?.signedUrl) {
          throw new Error('ファイルURLの取得に失敗しました');
        }

        // -----------------------------------------------
        // STEP 2: OCR API 呼び出し
        // サーバーが signed URL から画像を取得して OCR 処理
        // -----------------------------------------------
        const ocrResponse = await fetch(`${API_BASE}/api/ocr/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: result.documentId,
            file_url: signedUrlData.signedUrl,
            file_path: result.storagePath, // フォールバック用
          }),
        });

        if (!ocrResponse.ok) {
          const errData = await ocrResponse.json().catch(() => ({}));
          throw new Error(errData.error || `OCR API エラー: ${ocrResponse.status}`);
        }

        const ocrData = await ocrResponse.json();
        const ocrResult = ocrData.ocr_result;

        // -----------------------------------------------
        // STEP 3: OCR 結果を documents テーブルに保存
        // -----------------------------------------------
        await documentsApi.update(result.documentId, {
          ocr_status: 'completed',
          ocr_confidence: ocrResult.confidence_score,
          supplier_name: ocrResult.extracted_supplier,
          amount: ocrResult.extracted_amount,
          tax_amount: ocrResult.extracted_tax_amount,
          document_date: ocrResult.extracted_date || new Date().toISOString().split('T')[0],
          status: 'ocr_completed',
        } as any);

        // -----------------------------------------------
        // STEP 4: 仕訳生成 API 呼び出し
        // -----------------------------------------------
        const journalResponse = await fetch(`${API_BASE}/api/journal-entries/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: result.documentId,
            client_id: currentWorkflow!.clientId,
            ocr_result: ocrResult,
            industry,
          }),
        });

        if (!journalResponse.ok) {
          const errData = await journalResponse.json().catch(() => ({}));
          throw new Error(errData.error || `仕訳生成 API エラー: ${journalResponse.status}`);
        }

        const journalData = await journalResponse.json();
        const journalEntry = journalData.journal_entry;

        // -----------------------------------------------
        // STEP 5: 仕訳を journal_entries テーブルに保存
        // -----------------------------------------------
        const { data: savedEntry, error: dbSaveError } = await supabase
          .from('journal_entries')
          .insert({
            client_id: currentWorkflow!.clientId,
            document_id: result.documentId,
            entry_date: journalEntry.entry_date || ocrResult.extracted_date,
            entry_type: 'normal',
            description: journalEntry.notes,
            status: 'pending',
            notes: journalEntry.notes,
            ai_confidence: journalEntry.confidence,
          })
          .select()
          .single();

        if (dbSaveError) {
          console.error('仕訳保存エラー:', dbSaveError);
          // 仕訳保存失敗でもOCR完了として処理続行
        }

        // documents ステータスを ai_processing → reviewed に更新
        await documentsApi.update(result.documentId, {
          status: 'ai_processing',
        } as any);

        // -----------------------------------------------
        // STEP 6: 進捗を更新（完了）
        // -----------------------------------------------
        setOcrResults((prev) =>
          prev.map((r) =>
            r.id === result.id
              ? {
                  ...r,
                  status: 'completed',
                  confidence: Math.round((ocrResult.confidence_score || 0.85) * 100),
                  processedAt: new Date().toISOString(),
                  journalEntryId: savedEntry?.id,
                }
              : r
          )
        );
      } catch (error: any) {
        console.error(`OCR エラー (${result.fileName}):`, error);

        // documents テーブルのステータスをエラーに更新
        await documentsApi.update(result.documentId, {
          ocr_status: 'error',
          status: 'uploaded', // ステータスを戻す
        } as any);

        setOcrResults((prev) =>
          prev.map((r) =>
            r.id === result.id
              ? {
                  ...r,
                  status: 'error',
                  errorMessage: error.message,
                }
              : r
          )
        );
      }
    }

    setProcessing(false);
  };

  // ============================================
  // 次へ進む前の検証
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    const hasError = ocrResults.some((r) => r.status === 'error');
    const hasNotCompleted = ocrResults.some(
      (r) => r.status === 'pending' || r.status === 'processing'
    );

    if (hasNotCompleted) {
      alert('すべてのOCR処理が完了していません。処理を開始してください。');
      return false;
    }

    if (hasError) {
      const proceed = window.confirm(
        'エラーの証憑があります。エラー件数: ' +
          ocrResults.filter((r) => r.status === 'error').length +
          '件\nこのまま次へ進みますか？（エラー件数は除外されます）'
      );
      if (!proceed) return false;
    }

    // 完了した OCR 結果の ID をワークフローに保存
    const completedIds = ocrResults
      .filter((r) => r.status === 'completed')
      .map((r) => r.id);

    updateWorkflowData({ ocrResults: completedIds });

    return true;
  };

  // ============================================
  // カウント
  // ============================================
  const completedCount = ocrResults.filter((r) => r.status === 'completed').length;
  const processingCount = ocrResults.filter((r) => r.status === 'processing').length;
  const pendingCount = ocrResults.filter((r) => r.status === 'pending').length;
  const errorCount = ocrResults.filter((r) => r.status === 'error').length;
  const totalCount = ocrResults.length;

  // 進捗率（実際の完了件数 / 総件数）
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const allCompleted =
    totalCount > 0 && ocrResults.every((r) => r.status === 'completed' || r.status === 'error');

  // ============================================
  // ワークフロー外アクセスガード
  // ============================================
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            ワークフローが開始されていません
          </h2>
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
              <div className="text-3xl font-bold text-gray-900">{totalCount}</div>
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

          {/* 処理進捗ゲージ（処理中のみ表示） */}
          {processing && (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">処理進捗</h3>
                <span className="text-sm font-medium text-gray-700">
                  {completedCount} / {totalCount} 件完了
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">{progressPercent}%</p>
            </div>
          )}

          {/* OCR開始ボタン */}
          {pendingCount > 0 && !processing && (
            <div className="card bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">OCR処理を開始</h3>
                  <p className="text-sm text-gray-600">
                    {pendingCount}件のファイルをOCR処理・仕訳生成します
                  </p>
                  {industry && (
                    <p className="text-xs text-gray-500 mt-1">業種: {industry}</p>
                  )}
                </div>
                <button onClick={startOCRProcessing} className="btn-primary">
                  処理開始
                </button>
              </div>
            </div>
          )}

          {/* 処理状況 */}
          {ocrResults.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">処理状況</h2>

              <div className="space-y-3">
                {ocrResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* ファイル名 */}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{result.fileName}</p>
                      {result.processedAt && (
                        <p className="text-xs text-gray-500">
                          処理完了: {new Date(result.processedAt).toLocaleString('ja-JP')}
                        </p>
                      )}
                      {result.errorMessage && (
                        <p className="text-xs text-red-500">{result.errorMessage}</p>
                      )}
                      {result.journalEntryId && (
                        <p className="text-xs text-green-600">
                          仕訳生成完了
                        </p>
                      )}
                    </div>

                    {/* 信頼度 */}
                    {result.confidence !== undefined && (
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

                    {/* ステータスバッジ */}
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
          {allCompleted && completedCount > 0 && (
            <div className="card bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle size={32} className="text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">OCR処理・仕訳生成が完了しました</h3>
                  <p className="text-sm text-green-700">
                    {completedCount}件を処理しました。次のステップに進んでください。
                    {errorCount > 0 && ` (${errorCount}件はエラーのため除外)`}
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
      <WorkflowNavigation onBeforeNext={handleBeforeNext} nextLabel="AIチェックへ" />
    </div>
  );
}