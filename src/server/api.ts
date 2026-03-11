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

// 起動時に接続情報をログ出力（キーは先頭のみ表示）
console.log('🔧 Supabase サーバー接続情報:');
console.log(`   URL: ${supabaseUrl || '❌ 未設定'}`);
console.log(`   SERVICE_ROLE_KEY: ${supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : '❌ 未設定'}`);
console.log(`   SUPABASE_URL env: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   VITE_SUPABASE_URL env: ${process.env.VITE_SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY env: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'}`);

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

if (!supabaseAdmin) {
  console.error('⚠️ Supabase Admin クライアントが初期化できません。環境変数を確認してください。');
}

// ============================================
// マスタデータ取得ヘルパー
// ============================================

async function fetchAccountItems(organizationId: string): Promise<AccountItemRef[]> {
  if (!supabaseAdmin) {
    console.error('[fetchAccountItems] supabaseAdmin が null です');
    return [];
  }

  console.log(`[fetchAccountItems] organization_id=${organizationId} で取得開始`);

  const { data, error } = await supabaseAdmin
    .from('account_items')
    .select('id, code, name, category:account_categories(name)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) {
    console.error('[fetchAccountItems] エラー:', JSON.stringify(error));
    return [];
  }

  console.log(`[fetchAccountItems] ${(data || []).length} 件取得`);

  return (data || []).map((item: any) => ({
    id: item.id,
    code: item.code || '',
    name: item.name,
    category: item.category?.name || 'expense',
  }));
}

async function fetchTaxCategories(): Promise<TaxCategoryRef[]> {
  if (!supabaseAdmin) {
    console.error('[fetchTaxCategories] supabaseAdmin が null です');
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('tax_categories')
    .select('id, code, name, rate')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) {
    console.error('[fetchTaxCategories] エラー:', JSON.stringify(error));
    return [];
  }

  console.log(`[fetchTaxCategories] ${(data || []).length} 件取得`);

  return (data || []).map((item: any) => ({
    id: item.id,
    code: item.code || '',
    name: item.name,
    rate: Number(item.rate) || 0,
  }));
}

async function findFallbackAccountId(organizationId: string): Promise<string> {
  if (!supabaseAdmin) return '';

  const { data, error } = await supabaseAdmin
    .from('account_items')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', '雑費')
    .limit(1)
    .single();

  if (error) {
    console.warn('[findFallbackAccountId] 雑費が見つかりません:', JSON.stringify(error));
  }

  return data?.id || '';
}

async function getOrganizationId(clientId: string): Promise<string | null> {
  if (!supabaseAdmin) {
    console.error('[getOrganizationId] supabaseAdmin が null です');
    return null;
  }

  console.log(`[getOrganizationId] client_id=${clientId} で検索開始`);

  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('organization_id')
    .eq('id', clientId)
    .single();

  if (error) {
    console.error('[getOrganizationId] Supabase エラー:', JSON.stringify(error));
    return null;
  }

  if (!data) {
    console.error(`[getOrganizationId] client_id=${clientId} のデータが見つかりません（data=null）`);
    return null;
  }

  console.log(`[getOrganizationId] → organization_id=${data.organization_id}`);
  return data.organization_id || null;
}

// ============================================
// アップロードディレクトリの設定
// ============================================
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
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
    console.log('OCR処理完了:', {
      document_id,
      supplier: ocrResult.extracted_supplier,
      amount: ocrResult.extracted_amount,
      confidence: ocrResult.confidence_score,
    });

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
    console.error('OCR処理エラー:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI仕訳生成API
// ============================================

router.post('/journal-entries/generate', async (req: Request, res: Response) => {
  try {
    const { document_id, client_id, ocr_result, industry } = req.body;

    console.log('=== 仕訳生成リクエスト受信 ===');
    console.log('  document_id:', document_id);
    console.log('  client_id:', client_id);
    console.log('  industry:', industry);
    console.log('  ocr_result存在:', !!ocr_result);
    console.log('  ocr_result.extracted_supplier:', ocr_result?.extracted_supplier);
    console.log('  ocr_result.extracted_amount:', ocr_result?.extracted_amount);

    if (!document_id || !client_id || !ocr_result) {
      console.error('=== 必須パラメータ不足 ===');
      console.error('  document_id:', !!document_id);
      console.error('  client_id:', !!client_id);
      console.error('  ocr_result:', !!ocr_result);
      return res.status(400).json({ error: '必須パラメータが不足しています' });
    }

    // -----------------------------------------------
    // 1. Supabase接続チェック
    // -----------------------------------------------
    if (!supabaseAdmin) {
      console.error('=== supabaseAdmin が未初期化 ===');
      console.error('  SUPABASE_URL:', supabaseUrl || '未設定');
      console.error('  SERVICE_ROLE_KEY:', supabaseServiceKey ? '設定済み' : '未設定');
      return res.status(500).json({
        error: 'サーバーのSupabase接続が設定されていません。環境変数 SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を確認してください。',
      });
    }

    // -----------------------------------------------
    // 2. organization_id を解決
    // -----------------------------------------------
    const organizationId = await getOrganizationId(client_id);
    if (!organizationId) {
      console.error('=== organization_id 解決失敗 ===');
      console.error('  client_id:', client_id);

      // 追加診断: clients テーブルの全件数を確認
      const { count, error: countErr } = await supabaseAdmin
        .from('clients')
        .select('*', { count: 'exact', head: true });
      console.error('  clients テーブル総件数:', count, '  エラー:', countErr ? JSON.stringify(countErr) : 'なし');

      return res.status(400).json({
        error: '指定された client_id に紐づく組織が見つかりません',
        debug: {
          client_id,
          supabase_url_set: !!supabaseUrl,
          service_key_set: !!supabaseServiceKey,
          clients_count: count,
          clients_count_error: countErr?.message || null,
        },
      });
    }

    console.log('  organization_id:', organizationId);

    // -----------------------------------------------
    // 3. マスタデータを取得
    // -----------------------------------------------
    const [accountItems, taxCategories, fallbackAccountId] = await Promise.all([
      fetchAccountItems(organizationId),
      fetchTaxCategories(),
      findFallbackAccountId(organizationId),
    ]);

    console.log('  勘定科目:', accountItems.length, '件');
    console.log('  税区分:', taxCategories.length, '件');
    console.log('  雑費ID:', fallbackAccountId || 'なし');

    if (accountItems.length === 0) {
      console.warn('⚠️ 勘定科目マスタが0件です。デフォルト仕訳のみ返します。');
    }

    // -----------------------------------------------
    // 4. AI仕訳生成
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

    console.log('仕訳生成完了:', {
      category: journalEntry.category,
      confidence: journalEntry.confidence,
      lines_count: journalEntry.lines.length,
    });

    // -----------------------------------------------
    // 5. AI出力の勘定科目名・税区分名 → DB UUID にマッピング
    // -----------------------------------------------
    const mappedLines = mapLinesToDBFormat(
      journalEntry.lines,
      accountItems,
      taxCategories,
      fallbackAccountId
    );

    console.log('マッピング完了:', mappedLines.length, '行');

    // -----------------------------------------------
    // 6. レスポンス
    // -----------------------------------------------
    const entry = {
      document_id,
      client_id,
      entry_date: ocr_result.extracted_date || new Date().toISOString().split('T')[0],
      category: journalEntry.category,
      notes: journalEntry.notes,
      confidence: journalEntry.confidence,
      reasoning: journalEntry.reasoning,
      lines: mappedLines,
      _raw_lines: journalEntry.lines,
    };

    console.log('=== 仕訳生成レスポンス送信 ===');

    res.json({
      success: true,
      message: '仕訳が生成されました',
      journal_entry: entry,
    });
  } catch (error: any) {
    console.error('=== 仕訳生成エラー ===');
    console.error('  message:', error.message);
    console.error('  stack:', error.stack);
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
// 一括処理API
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

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase接続が未設定です' });
    }

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
        console.log(`バッチ処理中: ${file.originalname}`);

        const ocrResult = await processOCR(file.path);

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

        console.log(`バッチ完了: ${file.originalname}`);
      } catch (error: any) {
        console.error(`バッチエラー (${file.originalname}):`, error.message);
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
    console.error('バッチ処理エラー:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ヘルスチェックAPI（診断情報付き）
// ============================================

router.get('/health', async (req: Request, res: Response) => {
  let supabaseStatus = 'not_configured';
  let clientsCount: number | null = null;
  let supabaseError: string | null = null;

  if (supabaseAdmin) {
    try {
      const { count, error } = await supabaseAdmin
        .from('clients')
        .select('*', { count: 'exact', head: true });

      if (error) {
        supabaseStatus = 'error';
        supabaseError = error.message;
      } else {
        supabaseStatus = 'connected';
        clientsCount = count;
      }
    } catch (e: any) {
      supabaseStatus = 'exception';
      supabaseError = e.message;
    }
  }

  res.json({
    status: 'ok',
    message: 'APIサーバーは正常に動作しています',
    timestamp: new Date().toISOString(),
    gemini_configured: !!process.env.GEMINI_API_KEY,
    gemini_model: process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview',
    supabase: {
      url_set: !!supabaseUrl,
      service_key_set: !!supabaseServiceKey,
      admin_initialized: !!supabaseAdmin,
      connection_status: supabaseStatus,
      clients_count: clientsCount,
      error: supabaseError,
    },
    env_vars: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅' : '❌',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? '✅' : '❌',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✅' : '❌',
      GEMINI_MODEL: process.env.GEMINI_MODEL || '(default: gemini-3.1-pro-preview)',
    },
  });
});

export default router;