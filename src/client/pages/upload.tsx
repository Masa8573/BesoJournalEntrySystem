import { useState, useCallback } from 'react';
import { Upload as UploadIcon, FileImage, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
}

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedClient] = useState('山田太郎');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'uploading',
      progress: 0,
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // シミュレート: アップロード処理
    newFiles.forEach((newFile) => {
      simulateUpload(newFile.id);
    });
  }, []);

  const simulateUpload = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, progress, status: progress >= 100 ? 'success' : 'uploading' }
            : f
        )
      );
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 500,
  });

  const totalFiles = uploadedFiles.length;
  const successCount = uploadedFiles.filter((f) => f.status === 'success').length;

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">証憑アップロード</h1>
        <p className="text-sm text-gray-500 mt-1">
          {selectedClient}さんのレシート・領収書を一括アップロードします
        </p>
      </div>

      {/* アップロードエリア */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ファイルアップロード</h2>
        <p className="text-sm text-gray-500 mb-4">
          最大500枚まで一括にアップロードできます (JPEG, PNG, PDF対応)
        </p>
        <p className="text-sm text-gray-700 mb-4">
          <span className="font-medium">アップロード者:</span> 田中税理士
        </p>

        {/* ドロップゾーン */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }
          `}
        >
          <input {...getInputProps()} />
          <UploadIcon className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-lg font-medium text-gray-700 mb-2">
            {isDragActive ? 'ファイルをドロップ' : 'ドラッグ&ドロップでファイルをアップロード'}
          </p>
          <p className="text-sm text-gray-500 mb-4">または クリックしてファイルを選択</p>
          <p className="text-xs text-gray-400">
            対応形式: JPEG, PNG, PDF (最大500ファイル)
          </p>
        </div>
      </div>

      {/* アップロード済みファイル一覧 */}
      {uploadedFiles.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">アップロード済: {totalFiles}枚</h2>
            <button
              onClick={() => {
                console.log('OCR処理開始');
                alert('OCR処理を開始します');
              }}
              disabled={successCount < totalFiles}
              className={`
                px-4 py-2 rounded-lg font-medium transition-colors
                ${
                  successCount === totalFiles
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              OCR処理開始
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  {file.file.type.startsWith('image/') ? (
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileImage size={48} className="text-gray-400" />
                    </div>
                  )}

                  {/* ステータスオーバーレイ */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    {file.status === 'uploading' && (
                      <div className="text-center">
                        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-white text-sm font-medium">{file.progress}%</p>
                      </div>
                    )}
                    {file.status === 'success' && (
                      <CheckCircle size={48} className="text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle size={48} className="text-red-500" />
                    )}
                  </div>

                  {/* 削除ボタン */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-600 truncate">{file.file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}