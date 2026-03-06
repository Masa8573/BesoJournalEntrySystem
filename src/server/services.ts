import { GoogleGenerativeAI } from '@google/generative-ai';
// Gemini APIクライアントの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================
// OCRサービス - 画像から文字を抽出
// ============================================

export interface OCRResult {
  raw_text: string;
  extracted_date: string | null;
  extracted_supplier: string | null;
  extracted_amount: number | null;
  extracted_tax_amount: number | null;
  extracted_items: Array<{
    name: string;
    quantity?: number;
    unit_price?: number;
    amount: number;
  }> | null;
  confidence_score: number;
}

export async function processOCR(imageUrl: string): Promise<OCRResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // URL から画像を取得して Base64 エンコード
    const fetchRes = await fetch(imageUrl);
    if (!fetchRes.ok) {
      throw new Error(`画像の取得に失敗しました: ${fetchRes.status}`);
    }
    const arrayBuffer = await fetchRes.arrayBuffer();
    // Node.js 環境では Buffer が使えるが型定義なしでも動作するよう uint8array で変換
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    uint8.forEach((b) => { binary += String.fromCharCode(b); });
    const base64Image = btoa(binary);
    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';

    // MIMEタイプを URL または Content-Type から推定
    const ext = imageUrl.split('?')[0].split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'pdf' || contentType.includes('pdf')
        ? 'application/pdf'
        : ext === 'png' || contentType.includes('png')
        ? 'image/png'
        : 'image/jpeg';

    const prompt = `
この画像はレシート、領収書、請求書、通帳、またはクレジットカード明細です。
以下の情報を正確に抽出してJSON形式で返してください。

【重要】通帳・クレジットカード明細など複数の取引が含まれる場合は、
transactions 配列に各取引を個別のオブジェクトとして列挙してください。
レシート・領収書など単一取引の場合も transactions 配列に1件として格納してください。

{
  "document_type": "receipt" | "invoice" | "bank_statement" | "credit_card",
  "transactions": [
    {
      "date": "取引日 (YYYY-MM-DD形式)",
      "supplier": "取引先名・店舗名",
      "total_amount": "合計金額（数値のみ）",
      "tax_amount": "消費税額（数値のみ、不明な場合はnull）",
      "items": [
        {
          "name": "商品名・摘要",
          "quantity": 数量（不明な場合はnull）,
          "unit_price": 単価（不明な場合はnull）,
          "amount": 金額
        }
      ]
    }
  ]
}

注意事項：
- 日付は必ず YYYY-MM-DD 形式に変換してください
- 金額は数値のみ（カンマなし）で返してください
- 消費税が記載されていない場合は null にしてください（逆算不要）
- 品目が読み取れない場合は空配列を返してください
- JSONのみを返し、他の説明文は含めないでください
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType as any,
          data: base64Image,
        },
      },
    ]);

    const geminiRes = await result.response;
    const text = geminiRes.text();

    // JSONを抽出（マークダウンコードブロックを除去）
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    const extracted = JSON.parse(jsonText);

    // transactions 配列の最初の1件を代表値として使用（後続処理との互換性）
    const firstTx = extracted.transactions?.[0] || {};

    return {
      raw_text: text,
      extracted_date: firstTx.date || null,
      extracted_supplier: firstTx.supplier || null,
      extracted_amount: firstTx.total_amount ? Number(firstTx.total_amount) : null,
      extracted_tax_amount: firstTx.tax_amount ? Number(firstTx.tax_amount) : null,
      extracted_items: firstTx.items || null,
      confidence_score: 0.85, // Geminiは信頼度スコアを返さないため固定値
      // 複数取引用に全トランザクションも保持
      _all_transactions: extracted.transactions || [],
      _document_type: extracted.document_type || 'receipt',
    } as any;
  } catch (error) {
    console.error('OCR処理エラー:', error);
    throw new Error('OCR処理に失敗しました');
  }
}

// ============================================
// AI仕訳生成サービス
// ============================================

export interface JournalEntryInput {
  date: string;
  supplier: string;
  amount: number;
  tax_amount: number | null;
  items: Array<{ name: string; amount: number }> | null;
  industry?: string; // 業種（ドライバー、ライバー等）
}

export interface JournalEntryLine {
  debit_account: string;
  debit_account_code: string;
  credit_account: string;
  credit_account_code: string;
  tax_category: string;
  amount: number;
  description: string;
}

export interface GeneratedJournalEntry {
  category: '事業用' | 'プライベート';
  account_item: string;
  account_item_code: string;
  tax_category: string;
  notes: string;
  confidence: number;
  reasoning: string;
  // 複数明細対応
  lines: JournalEntryLine[];
}

export async function generateJournalEntry(
  input: JournalEntryInput
): Promise<GeneratedJournalEntry> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = `
あなたは日本の税理士のアシスタントAIです。以下の取引情報から適切な仕訳を生成してください。

【取引情報】
- 取引日: ${input.date}
- 取引先: ${input.supplier}
- 金額: ${input.amount}円
- 消費税: ${input.tax_amount !== null ? input.tax_amount + '円' : '不明'}
- 品目: ${input.items && input.items.length > 0 ? input.items.map((i) => `${i.name}(${i.amount}円)`).join(', ') : '不明'}
${input.industry ? `- 業種: ${input.industry}` : ''}

【出力形式】
以下のJSON形式で返してください。
明細が複数ある場合（品目ごとに勘定科目が異なる場合など）は、lines 配列に複数のオブジェクトを返してください。
通常の単一取引は lines に1件のみ返してください。

{
  "category": "事業用" または "プライベート",
  "account_item": "主要勘定科目名",
  "account_item_code": "主要勘定科目コード（3桁）",
  "tax_category": "課税仕入 10%" または "対象外",
  "notes": "摘要（取引先名と品目を含める）",
  "confidence": 0.0〜1.0の信頼度,
  "reasoning": "判断理由",
  "lines": [
    {
      "debit_account": "借方勘定科目名",
      "debit_account_code": "借方コード（3桁）",
      "credit_account": "貸方勘定科目名（通常は現金・普通預金など）",
      "credit_account_code": "貸方コード（3桁）",
      "tax_category": "課税仕入 10%" または "対象外",
      "amount": 金額（数値）,
      "description": "明細摘要"
    }
  ]
}

【判断基準】
1. 取引先名や品目から事業用かプライベートか判断
2. 業種に応じた一般的な勘定科目を選択
   - ドライバー: ガソリン→燃料費(501)、洗車→車両費(502)、高速代→旅費交通費(503)
   - ライバー: 配信機材→消耗品費(503)、通信料→通信費(504)
   - フリーランス: 事務用品→消耗品費(503)、ソフトウェア→通信費(504)
3. 消費税がある場合は「課税仕入 10%」、ない場合は「対象外」
4. 摘要は「取引先名 - 品目」の形式
5. 貸方は通常「現金(101)」または「普通預金(102)」を使用

JSONのみを返してください。
`;

    const result = await model.generateContent(prompt);
    const geminiRes = await result.response;
    const text = geminiRes.text();

    // JSONを抽出
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    const generated = JSON.parse(jsonText);

    // lines が無い場合はデフォルトの1行を生成
    const lines: JournalEntryLine[] =
      generated.lines && generated.lines.length > 0
        ? generated.lines
        : [
            {
              debit_account: generated.account_item || '雑費',
              debit_account_code: generated.account_item_code || '599',
              credit_account: '現金',
              credit_account_code: '101',
              tax_category: generated.tax_category || '課税仕入 10%',
              amount: input.amount,
              description: generated.notes || input.supplier,
            },
          ];

    return {
      category: generated.category || '事業用',
      account_item: generated.account_item || '雑費',
      account_item_code: generated.account_item_code || '599',
      tax_category: generated.tax_category || '課税仕入 10%',
      notes: generated.notes || `${input.supplier}`,
      confidence: generated.confidence || 0.7,
      reasoning: generated.reasoning || '自動判定',
      lines,
    };
  } catch (error) {
    console.error('仕訳生成エラー:', error);

    // フォールバック: エラー時はデフォルト値を返す
    const fallbackLine: JournalEntryLine = {
      debit_account: '雑費',
      debit_account_code: '599',
      credit_account: '現金',
      credit_account_code: '101',
      tax_category: input.tax_amount ? '課税仕入 10%' : '対象外',
      amount: input.amount,
      description: `${input.supplier}`,
    };

    return {
      category: '事業用',
      account_item: '雑費',
      account_item_code: '599',
      tax_category: input.tax_amount ? '課税仕入 10%' : '対象外',
      notes: `${input.supplier}`,
      confidence: 0.5,
      reasoning: 'AI判定失敗 - デフォルト値を使用',
      lines: [fallbackLine],
    };
  }
}

// ============================================
// freee連携サービス（スタブ）
// ============================================

export interface FreeeTransaction {
  issue_date: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  account_item_id: number;
  tax_code: number;
}

export async function exportToFreee(transactions: FreeeTransaction[]): Promise<{
  success: boolean;
  message: string;
  exported_count: number;
}> {
  // TODO: 実際のfreee API連携を実装
  console.log('freeeエクスポート（スタブ）:', transactions.length, '件');

  return {
    success: true,
    message: 'freee連携は実装予定です',
    exported_count: transactions.length,
  };
}