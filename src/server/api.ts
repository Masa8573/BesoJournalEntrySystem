import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  processOCR,
  generateJournalEntry,
  exportToFreee,
  mapLinesToDBFormat,
} from './services.js';
import type { AccountItemRef, TaxCategoryRef } from './services.js';

const router = express.Router();

// ============================================
// Supabase サーバーサイドクライアント（service_role で RLS バイパス）
// ============================================
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// マスタデータ取得ヘルパー
// ============================================

/** organization_id に属する勘定科目を取得 */
async function fetchAccountItems(organizationId: string): Promise<AccountItemRef[]> {
  const { data, error } = await supabaseAdmin
    .from('account_items')
    .select('id, code, name, category:account_categories(name)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) {
    console.error('勘定科目取得エラー:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    code: item.code || '',
    name: item.name,
    category: item.category?.name || 'expense',
  }));
}

/** 税区分を取得（システム共通マスタ） */
async function fetchTaxCategories(): Promise<TaxCategoryRef[]> {
  const { data, error } = await supabaseAdmin
    .from('tax_categories')
    .select('id, code, name, rate')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) {
    console.error('税区分取得エラー:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    code: item.code || '',
    name: item.name,
    rate: Number(item.rate) || 0,
  }));
}

/** 「雑費」のフォールバック用 UUID を取得 */
async function findFallbackAccountId(organizationId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('account_items')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', '雑費')
    .limit(1)
    .single();

  return data?.id || '';
}

/** client_id → organization_id を解決 */
async function getOrganizationId(clientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('organization_id')
    .eq('id', clientId)
    .single();

  return data?.organization_id || null;
}

// ============================================
// アップロードディレクトリの設定
// ============================================
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
    const allowedTypes = /jpeg|jpg|png|webp|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('画像ファイル（JPEG, PNG, WebP, PDF）のみアップロード可能です'));
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
    const { document_id, file_url, file_path } = req.body;

    const targetUrl = file_url || file_path;

    if (!document_id || !targetUrl) {
      return res.status(400).json({ error: 'document_idとfile_url（またはfile_path）は必須です' });
    }

    console.log('OCR処理開始:', document_id);
    const ocrResult = await processOCR(targetUrl);

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

    // -----------------------------------------------
    // 1. organization_id を解決
    // -----------------------------------------------
    const organizationId = await getOrganizationId(client_id);
    if (!organizationId) {
      return res.status(400).json({ error: '指定された client_id に紐づく組織が見つかりません' });
    }

    // -----------------------------------------------
    // 2. マスタデータを取得
    // -----------------------------------------------
    const [accountItems, taxCategories, fallbackAccountId] = await Promise.all([
      fetchAccountItems(organizationId),
      fetchTaxCategories(),
      findFallbackAccountId(organizationId),
    ]);

    if (accountItems.length === 0) {
      console.warn('勘定科目マスタが0件です。デフォルト仕訳のみ返します。');
    }

    // -----------------------------------------------
    // 3. AI仕訳生成
    // -----------------------------------------------
    console.log('仕訳生成開始:', {
      supplier: ocr_result.extracted_supplier,
      amount: ocr_result.extracted_amount,
    });

    const journalEntry = await generateJournalEntry({
      date: ocr_result.extracted_date || new Date().toISOString().split('T')[0],
      supplier: ocr_result.extracted_supplier || '不明',
      amount: ocr_result.extracted_amount || 0,
      tax_amount: ocr_result.extracted_tax_amount,
      tax_details: ocr_result.transactions?.[0]?.tax_details || null,
      items: ocr_result.extracted_items,
      payment_method: ocr_result.extracted_payment_method || null,
      invoice_number: ocr_result.extracted_invoice_number || null,
      industry,
      account_items: accountItems,
      tax_categories: taxCategories,
    });

    // -----------------------------------------------
    // 4. AI出力の勘定科目名・税区分名 → DB UUID にマッピング
    // -----------------------------------------------
    const mappedLines = mapLinesToDBFormat(
      journalEntry.lines,
      accountItems,
      taxCategories,
      fallbackAccountId
    );

    // -----------------------------------------------
    // 5. レスポンス
    // -----------------------------------------------
    const entry = {
      document_id,
      client_id,
      entry_date: ocr_result.extracted_date || new Date().toISOString().split('T')[0],
      category: journalEntry.category,
      notes: journalEntry.notes,
      confidence: journalEntry.confidence,
      reasoning: journalEntry.reasoning,
      // DB保存用にマッピング済みの明細行
      lines: mappedLines,
      // デバッグ用にAI生の出力も返す
      _raw_lines: journalEntry.lines,
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

    // freee形式に変換（後続実装で詳細化）
    const transactions = journal_entries.map((entry: any) => ({
      issue_date: entry.entry_date,
      type: 'expense' as 'income' | 'expense',
      amount: entry.amount || 0,
      description: entry.notes || '',
      account_item_id: 0,
      tax_code: 0,
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

    // マスタデータを1回だけ取得
    const organizationId = await getOrganizationId(client_id);
    if (!organizationId) {
      return res.status(400).json({ error: '指定された client_id に紐づく組織が見つかりません' });
    }

    const [accountItems, taxCategories, fallbackAccountId] = await Promise.all([
      fetchAccountItems(organizationId),
      fetchTaxCategories(),
      findFallbackAccountId(organizationId),
    ]);

    const results = [];

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
          tax_details: ocrResult.transactions?.[0]?.tax_details || null,
          items: ocrResult.extracted_items,
          payment_method: ocrResult.extracted_payment_method || null,
          invoice_number: ocrResult.extracted_invoice_number || null,
          industry,
          account_items: accountItems,
          tax_categories: taxCategories,
        });

        // 3. UUID マッピング
        const mappedLines = mapLinesToDBFormat(
          journalEntry.lines,
          accountItems,
          taxCategories,
          fallbackAccountId
        );

        results.push({
          file_name: file.originalname,
          success: true,
          ocr: ocrResult,
          journal_entry: {
            entry_date: ocrResult.extracted_date,
            category: journalEntry.category,
            notes: journalEntry.notes,
            confidence: journalEntry.confidence,
            reasoning: journalEntry.reasoning,
            lines: mappedLines,
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
    gemini_model: process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview',
    supabase_configured: !!supabaseUrl && !!supabaseServiceKey,
  });
});

export default router;