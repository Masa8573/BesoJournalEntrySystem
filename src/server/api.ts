import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processOCR, generateJournalEntry, exportToFreee } from './services';

const router = express.Router();

// アップロードディレクトリの設定
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer設定（ファイルアップロード）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('画像ファイル（JPEG, PNG, PDF）のみアップロード可能です'));
    }
  },
});

// ============================================
// 証憑アップロードAPI
// ============================================

router.post('/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const { client_id, uploaded_by } = req.body;

    if (!client_id || !uploaded_by) {
      return res.status(400).json({ error: 'client_idとuploaded_byは必須です' });
    }

    // ドキュメント情報を返す
    const document = {
      id: `doc-${Date.now()}`,
      client_id,
      uploaded_by,
      file_path: req.file.path,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      upload_date: new Date().toISOString().split('T')[0],
      ocr_status: 'pending',
      created_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: 'ファイルがアップロードされました',
      document,
    });
  } catch (error: any) {
    console.error('アップロードエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// OCR処理API
// ============================================

router.post('/ocr/process', async (req: Request, res: Response) => {
  try {
    const { document_id, file_path } = req.body;

    if (!document_id || !file_path) {
      return res.status(400).json({ error: 'document_idとfile_pathは必須です' });
    }

    // ファイルが存在するか確認
    if (!fs.existsSync(file_path)) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }

    // OCR処理を実行
    console.log('OCR処理開始:', file_path);
    const ocrResult = await processOCR(file_path);

    res.json({
      success: true,
      message: 'OCR処理が完了しました',
      ocr_result: {
        id: `ocr-${Date.now()}`,
        document_id,
        ...ocrResult,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('OCR処理エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI仕訳生成API
// ============================================

router.post('/journal-entries/generate', async (req: Request, res: Response) => {
  try {
    const { document_id, client_id, ocr_result, industry } = req.body;

    if (!document_id || !client_id || !ocr_result) {
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    // AI仕訳生成
    console.log('仕訳生成開始:', ocr_result);
    const journalEntry = await generateJournalEntry({
      date: ocr_result.extracted_date || new Date().toISOString().split('T')[0],
      supplier: ocr_result.extracted_supplier || '不明',
      amount: ocr_result.extracted_amount || 0,
      tax_amount: ocr_result.extracted_tax_amount,
      items: ocr_result.extracted_items,
      industry,
    });

    // 仕訳データを生成
    const entry = {
      id: `entry-${Date.now()}`,
      document_id,
      client_id,
      entry_date: ocr_result.extracted_date || new Date().toISOString().split('T')[0],
      category: journalEntry.category,
      supplier: ocr_result.extracted_supplier,
      account_item: journalEntry.account_item,
      account_item_code: journalEntry.account_item_code,
      tax_category: journalEntry.tax_category,
      amount: ocr_result.extracted_amount,
      tax_amount: ocr_result.extracted_tax_amount,
      notes: journalEntry.notes,
      status: 'pending',
      confidence: journalEntry.confidence,
      ai_reasoning: journalEntry.reasoning,
      created_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: '仕訳が生成されました',
      journal_entry: entry,
    });
  } catch (error: any) {
    console.error('仕訳生成エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// freeeエクスポートAPI
// ============================================

router.post('/freee/export', async (req: Request, res: Response) => {
  try {
    const { journal_entries } = req.body;

    if (!journal_entries || !Array.isArray(journal_entries)) {
      return res.status(400).json({ error: 'journal_entriesは配列である必要があります' });
    }

    // freee形式に変換
    const transactions = journal_entries.map((entry: any) => ({
      issue_date: entry.entry_date,
      type: (entry.category === '事業用' ? 'expense' : 'expense') as 'income' | 'expense',
      amount: entry.amount,
      description: entry.notes,
      account_item_id: parseInt(entry.account_item_code),
      tax_code: entry.tax_category.includes('10%') ? 207 : 0, // freeeの税区分コード
    }));

    const result = await exportToFreee(transactions);

    res.json({
      success: result.success,
      message: result.message,
      exported_count: result.exported_count,
    });
  } catch (error: any) {
    console.error('freeeエクスポートエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 一括処理API（アップロード → OCR → 仕訳生成）
// ============================================

router.post('/process/batch', upload.array('files', 500), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const { client_id, uploaded_by, industry } = req.body;

    if (!client_id || !uploaded_by) {
      return res.status(400).json({ error: 'client_idとuploaded_byは必須です' });
    }

    const results = [];

    // 各ファイルを処理
    for (const file of files) {
      try {
        console.log(`処理中: ${file.originalname}`);

        // 1. OCR処理
        const ocrResult = await processOCR(file.path);

        // 2. 仕訳生成
        const journalEntry = await generateJournalEntry({
          date: ocrResult.extracted_date || new Date().toISOString().split('T')[0],
          supplier: ocrResult.extracted_supplier || '不明',
          amount: ocrResult.extracted_amount || 0,
          tax_amount: ocrResult.extracted_tax_amount,
          items: ocrResult.extracted_items,
          industry,
        });

        results.push({
          file_name: file.originalname,
          success: true,
          ocr: ocrResult,
          journal_entry: {
            entry_date: ocrResult.extracted_date,
            category: journalEntry.category,
            supplier: ocrResult.extracted_supplier,
            account_item: journalEntry.account_item,
            tax_category: journalEntry.tax_category,
            amount: ocrResult.extracted_amount,
            notes: journalEntry.notes,
            confidence: journalEntry.confidence,
          },
        });

        console.log(`完了: ${file.originalname}`);
      } catch (error: any) {
        console.error(`エラー (${file.originalname}):`, error);
        results.push({
          file_name: file.originalname,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      message: `${successCount}件処理完了、${failureCount}件失敗`,
      total: files.length,
      success_count: successCount,
      failure_count: failureCount,
      results,
    });
  } catch (error: any) {
    console.error('バッチ処理エラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ヘルスチェックAPI
// ============================================

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'APIサーバーは正常に動作しています',
    timestamp: new Date().toISOString(),
    gemini_configured: !!process.env.GEMINI_API_KEY,
  });
});

export default router;