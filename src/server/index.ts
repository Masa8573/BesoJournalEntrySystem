import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './api';

// 環境変数を読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア設定
app.use(cors({
  origin: process.env.VITE_APP_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ログミドルウェア
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// APIルートをマウント
app.use('/api', apiRouter);

// ルートエンドポイント
app.get('/', (req, res) => {
  res.json({
    message: '経理自動化システム API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      upload: 'POST /api/documents/upload',
      ocr: 'POST /api/ocr/process',
      generate_journal: 'POST /api/journal-entries/generate',
      freee_export: 'POST /api/freee/export',
      batch_process: 'POST /api/process/batch',
    },
    status: 'running',
  });
});

// エラーハンドリングミドルウェア
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('エラー:', err);
  res.status(err.status || 500).json({
    error: err.message || 'サーバーエラーが発生しました',
    status: err.status || 500,
  });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({
    error: 'エンドポイントが見つかりません',
    path: req.path,
    method: req.method,
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 経理自動化システム API Server');
  console.log('='.repeat(50));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`📂 Upload directory: ${process.cwd()}/uploads`);
  console.log('='.repeat(50));
  console.log('利用可能なエンドポイント:');
  console.log('  GET  /api/health              - ヘルスチェック');
  console.log('  POST /api/documents/upload    - ファイルアップロード');
  console.log('  POST /api/ocr/process         - OCR処理');
  console.log('  POST /api/journal-entries/generate - 仕訳生成');
  console.log('  POST /api/freee/export        - freeeエクスポート');
  console.log('  POST /api/process/batch       - 一括処理');
  console.log('='.repeat(50));
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('SIGTERM受信 - サーバーをシャットダウンします');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT受信 - サーバーをシャットダウンします');
  process.exit(0);
});