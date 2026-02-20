import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

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

export async function processOCR(imagePath: string): Promise<OCRResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // 画像をBase64エンコード
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    const prompt = `
この画像はレシートまたは領収書です。以下の情報を正確に抽出してJSON形式で返してください：

{
  "date": "取引日 (YYYY-MM-DD形式)",
  "supplier": "取引先名・店舗名",
  "total_amount": "合計金額（数値のみ）",
  "tax_amount": "消費税額（数値のみ、記載がない場合はnull）",
  "items": [
    {
      "name": "商品名",
      "quantity": 数量,
      "unit_price": 単価,
      "amount": 金額
    }
  ]
}

注意事項：
- 日付は必ず YYYY-MM-DD 形式に変換してください
- 金額は数値のみ（カンマなし）で返してください
- 消費税が記載されていない場合は、合計金額から逆算してください（税率10%）
- 品目が読み取れない場合は空配列を返してください
- JSONのみを返し、他の説明文は含めないでください
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // JSONを抽出（マークダウンコードブロックを除去）
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    const extracted = JSON.parse(jsonText);

    return {
      raw_text: text,
      extracted_date: extracted.date || null,
      extracted_supplier: extracted.supplier || null,
      extracted_amount: extracted.total_amount ? Number(extracted.total_amount) : null,
      extracted_tax_amount: extracted.tax_amount ? Number(extracted.tax_amount) : null,
      extracted_items: extracted.items || null,
      confidence_score: 0.85, // Geminiは信頼度スコアを返さないため固定値
    };
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

export interface GeneratedJournalEntry {
  category: '事業用' | 'プライベート';
  account_item: string;
  account_item_code: string;
  tax_category: string;
  notes: string;
  confidence: number;
  reasoning: string;
}

export async function generateJournalEntry(
  input: JournalEntryInput
): Promise<GeneratedJournalEntry> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
あなたは日本の税理士のアシスタントAIです。以下の取引情報から適切な仕訳を生成してください。

【取引情報】
- 取引日: ${input.date}
- 取引先: ${input.supplier}
- 金額: ${input.amount}円
- 消費税: ${input.tax_amount || '不明'}円
- 品目: ${input.items ? input.items.map((i) => i.name).join(', ') : '不明'}
${input.industry ? `- 業種: ${input.industry}` : ''}

【出力形式】
以下のJSON形式で返してください：
{
  "category": "事業用" または "プライベート",
  "account_item": "勘定科目名（例: 燃料費、通信費、接待交際費等）",
  "account_item_code": "勘定科目コード（3桁の数字）",
  "tax_category": "課税仕入 10%" または "対象外",
  "notes": "摘要（取引先名と品目を含める）",
  "confidence": 0.0〜1.0の信頼度,
  "reasoning": "判断理由"
}

【判断基準】
1. 取引先名や品目から事業用かプライベートか判断
2. 業種に応じた一般的な勘定科目を選択
   - ドライバー: ガソリン→燃料費(501)、洗車→車両費(502)
   - ライバー: 配信機材→消耗品費(503)、通信料→通信費(504)
   - フリーランス: 事務用品→消耗品費(503)、ソフトウェア→通信費(504)
3. 消費税がある場合は「課税仕入 10%」、ない場合は「対象外」
4. 摘要は「取引先名 - 品目」の形式

JSONのみを返してください。
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSONを抽出
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    const generated = JSON.parse(jsonText);

    return {
      category: generated.category || '事業用',
      account_item: generated.account_item || '雑費',
      account_item_code: generated.account_item_code || '599',
      tax_category: generated.tax_category || '課税仕入 10%',
      notes: generated.notes || `${input.supplier}`,
      confidence: generated.confidence || 0.7,
      reasoning: generated.reasoning || '自動判定',
    };
  } catch (error) {
    console.error('仕訳生成エラー:', error);
    
    // フォールバック: エラー時はデフォルト値を返す
    return {
      category: '事業用',
      account_item: '雑費',
      account_item_code: '599',
      tax_category: input.tax_amount ? '課税仕入 10%' : '対象外',
      notes: `${input.supplier}`,
      confidence: 0.5,
      reasoning: 'AI判定失敗 - デフォルト値を使用',
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