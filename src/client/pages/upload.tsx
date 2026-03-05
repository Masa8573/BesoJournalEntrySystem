import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { useAuth } from '@/client/main';
import { supabase } from '@/client/lib/supabase';
import { documentsApi } from '@/client/lib/api';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  documentId?: string; // DBに保存後のID
  storagePath?: string; // Supabase Storage のパス
  errorMessage?: string;
}

export default function UploadPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const { user } = useAuth();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // ============================================
  // Supabase Storage へアップロード + documents テーブルに記録
  // ============================================
  const uploadToSupabase = async (uploadFile: UploadedFile) => {
    if (!currentWorkflow || !user) return;

    const clientId = currentWorkflow.clientId;
    const workflowId = currentWorkflow.id;

    // organization_id を users テーブルから取得
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const organizationId = userData?.organization_id;

    // Storage パス構造: documents/{organization_id}/{client_id}/{workflow_id}/{timestamp}_{filename}
    const timestamp = Date.now();
    const safeName = uploadFile.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = organizationId
      ? `documents/${organizationId}/${clientId}/${workflowId}/${timestamp}_${safeName}`
      : `documents/${clientId}/${workflowId}/${timestamp}_${safeName}`;

    // 1. Supabase Storage にアップロード
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, uploadFile.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // アップロード進捗を100%に更新
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, progress: 100 } : f
      )
    );

    // 2. documents テーブルに記録
    const documentDate = new Date().toISOString().split('T')[0];
    const docData = {
      client_id: clientId,
      organization_id: organizationId || undefined,
      workflow_id: workflowId,
      file_name: uploadFile.file.name,
      original_file_name: uploadFile.file.name,
      file_path: storagePath, // Storage path を保存
      storage_path: storagePath,
      file_size: uploadFile.file.size,
      file_type: uploadFile.file.type,
      document_date: documentDate,
      ocr_status: 'pending' as const,
      status: 'uploaded' as const,
      uploaded_by: user.id,
    };

    const { data: docRecord, error: dbError } = await documentsApi.create(docData);

    if (dbError || !docRecord) {
      // DBへの保存失敗 → Storage からも削除してロールバック
      await supabase.storage.from('documents').remove([storagePath]);
      throw new Error(`DB save failed: ${dbError}`);
    }

    return { documentId: docRecord.id, storagePath };
  };

  // ============================================
  // ファイルドロップ時の処理
  // ============================================
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'uploading' as const,
        progress: 0,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // 各ファイルを順次アップロード
      newFiles.forEach(async (uploadFile) => {
        try {
          // 進捗を段階的に表示（実際のアップロード中）
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress: 30 } : f
            )
          );

          const result = await uploadToSupabase(uploadFile);

          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: 'success',
                    progress: 100,
                    documentId: result?.documentId,
                    storagePath: result?.storagePath,
                  }
                : f
            )
          );
        } catch (error: any) {
          console.error('Upload error:', error);
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id
                ? {
                    ...f,
                    status: 'error',
                    progress: 0,
                    errorMessage: error.message,
                  }
                : f
            )
          );
        }
      });
    },
    [currentWorkflow, user]
  );

  // ============================================
  // ファイル削除
  // ============================================
  const removeFile = async (fileId: string) => {
    const file = uploadedFiles.find((f) => f.id === fileId);
    if (!file) return;

    // Storage から削除
    if (file.storagePath) {
      await supabase.storage.from('documents').remove([file.storagePath]);
    }

    // documents テーブルから削除
    if (file.documentId) {
      await documentsApi.delete(file.documentId);
    }

    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }

    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // ============================================
  // Dropzone 設定
  // ============================================
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  });

  // ============================================
  // 次へ進む前の検証
  // ============================================
  const handleBeforeNext = async (): Promise<boolean> => {
    if (uploadedFiles.length === 0) {
      alert('証憑を1つ以上アップロードしてください');
      return false;
    }

    const hasUploading = uploadedFiles.some((f) => f.status === 'uploading');
    if (hasUploading) {
      alert('アップロード中のファイルがあります。完了までお待ちください。');
      return false;
    }

    const hasError = uploadedFiles.some((f) => f.status === 'error');
    if (hasError) {
      const proceed = window.confirm(
        'エラーのあるファイルがあります。このまま進みますか？'
      );
      if (!proceed) return false;
    }

    // アップロード成功したドキュメントの DB ID をワークフローに保存
    const documentIds = uploadedFiles
      .filter((f) => f.status === 'success' && f.documentId)
      .map((f) => f.documentId as string);

    updateWorkflowData({ documents: documentIds });

    return true;
  };

  // ============================================
  // カウント
  // ============================================
  const successCount = uploadedFiles.filter((f) => f.status === 'success').length;
  const uploadingCount = uploadedFiles.filter((f) => f.status === 'uploading').length;
  const errorCount = uploadedFiles.filter((f) => f.status === 'error').length;

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
            証憑をアップロードするには、顧客一覧からワークフローを開始してください。
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
            <h1 className="text-2xl font-bold text-gray-900">証憑アップロード</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow.clientName}さんの証憑をアップロードしてください
            </p>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={20} className="text-green-500" />
                <h3 className="text-sm font-medium text-gray-600">アップロード完了</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{successCount}</div>
              <div className="text-xs text-gray-500 mt-1">ファイル</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={20} className="text-blue-500" />
                <h3 className="text-sm font-medium text-gray-600">アップロード中</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{uploadingCount}</div>
              <div className="text-xs text-gray-500 mt-1">ファイル</div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={20} className="text-red-500" />
                <h3 className="text-sm font-medium text-gray-600">エラー</h3>
              </div>
              <div className="text-3xl font-bold text-gray-900">{errorCount}</div>
              <div className="text-xs text-gray-500 mt-1">ファイル</div>
            </div>
          </div>

          {/* アップロードエリア */}
          <div className="card">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
                ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }
              `}
            >
              <input {...getInputProps()} />
              <Upload
                size={48}
                className={`mx-auto mb-4 ${
                  isDragActive ? 'text-blue-500' : 'text-gray-400'
                }`}
              />
              {isDragActive ? (
                <p className="text-lg font-medium text-blue-600">
                  ファイルをドロップしてください
                </p>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    ファイルをドラッグ&ドロップ
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    または、クリックしてファイルを選択
                  </p>
                  <button className="btn-primary">ファイルを選択</button>
                  <p className="text-xs text-gray-400 mt-4">
                    対応形式: PNG, JPG, PDF（最大10MB）
                  </p>
                </>
              )}
            </div>
          </div>

          {/* アップロード済みファイル一覧 */}
          {uploadedFiles.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                アップロード済みファイル ({uploadedFiles.length})
              </h2>

              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    {/* プレビュー */}
                    <div className="flex-shrink-0">
                      {file.file.type.startsWith('image/') ? (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-500">PDF</span>
                        </div>
                      )}
                    </div>

                    {/* ファイル情報 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.file.size / 1024).toFixed(1)} KB
                      </p>

                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${file.progress}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            アップロード中... {file.progress}%
                          </p>
                        </div>
                      )}

                      {file.status === 'error' && file.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">{file.errorMessage}</p>
                      )}

                      {file.status === 'success' && file.documentId && (
                        <p className="text-xs text-green-600 mt-1">
                          ID: {file.documentId.slice(0, 8)}...
                        </p>
                      )}
                    </div>

                    {/* ステータス */}
                    <div className="flex items-center gap-2">
                      {file.status === 'success' && (
                        <CheckCircle size={24} className="text-green-500" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle size={24} className="text-red-500" />
                      )}
                      {file.status === 'uploading' && (
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      )}

                      {/* 削除ボタン（アップロード中でない場合のみ） */}
                      {file.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 注意事項 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              📌 アップロードのヒント
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>複数ファイルを一度にアップロードできます</li>
              <li>ファイルは Supabase Storage に安全に保存されます</li>
              <li>アップロード後は次の OCR 処理ステップへ進みます</li>
              <li>「保存して中断」で途中保存できます</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <WorkflowNavigation onBeforeNext={handleBeforeNext} nextLabel="OCR処理へ" />
    </div>
  );
}