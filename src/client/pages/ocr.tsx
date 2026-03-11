import { GoogleGenAI } from '@google/genai';

// Gemini APIクライアントの初期化（新SDK: @google/genai）
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// 使用モデル（環境変数で切替可能）
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';

// ============================================
// OCRサービス - 画像から文字を抽出
// ============================================

/** OCR で抽出する各取引の型 */
export interface OCRTransaction {
  date: string | null;
  supplier: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  tax_details: {
    rate_10_amount: number | null;
    rate_10_tax: number | null;
    rate_8_amount: number | null;
    rate_8_tax: number | null;
    exempt_amount: number | null;
  } | null;
  tax_included: boolean;
  payment_method: string | null;
  invoice_number: string | null;
  reference_number: string | null;
  items: Array<{
    name: string;
    quantity: number | null;
    unit_price: number | null;
    amount: number;
    tax_rate: number | null;
  }>;
}

export interface OCRResult {
  raw_text: string;
  document_type: 'receipt' | 'invoice' | 'bank_statement' | 'credit_card' | 'other';
  transactions: OCRTransaction[];
  // 後続処理との互換性のため、先頭取引の代表値も保持
  extracted_date: string | null;
  extracted_supplier: string | null;
  extracted_amount: number | null;
  extracted_tax_amount: number | null;
  extracted_items: Array<{
    name: string;
    quantity?: number;
    unit_price?: number;
    amount: number;
    tax_rate?: number;
  }> | null;
  extracted_payment_method: string | null;
  extracted_invoice_number: string | null;
  confidence_score: number;
}

export async function processOCR(imageUrl: string): Promise<OCRResult> {
  try {
    // URL から画像を取得して Base64 エンコード
    const fetchRes = await fetch(imageUrl);
    if (!fetchRes.ok) {
      throw new Error(`画像の取得に失敗しました: ${fetchRes.status}`);
    }
    const arrayBuffer = await fetchRes.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';

    // MIMEタイプを URL または Content-Type から推定
    const ext = imageUrl.split('?')[0].split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'pdf' || contentType.includes('pdf')
        ? 'application/pdf'
        : ext === 'png' || contentType.includes('png')
        ? 'image/png'
        : ext === 'webp' || contentType.includes('webp')
        ? 'image/webp'
        : 'image/jpeg';

    const prompt = `あなたは日本の経理書類を読み取る専門AIです。
この画像はレシート、領収書、請求書、通帳、またはクレジットカード明細です。
以下の情報を正確に抽出してJSON形式で返してください。

【重要ルール】
- 通帳・クレジットカード明細など複数の取引が含まれる場合は、transactions 配列に各取引を個別のオブジェクトとして列挙してください。
- レシート・領収書など単一取引の場合も transactions 配列に1件として格納してください。
- 日付は必ず YYYY-MM-DD 形式に変換してください（和暦は西暦に変換）。
- 金額は数値のみ（カンマなし）で返してください。
- 消費税が記載されていない場合は null にしてください（逆算不要）。
- 品目が読み取れない場合は items を空配列にしてください。
- JSONのみを返し、他の説明文やマークダウンのコードブロックは含めないでください。

{
  "document_type": "receipt" | "invoice" | "bank_statement" | "credit_card" | "other",
  "confidence": 0.0〜1.0（読み取り全体の確信度。鮮明なら0.9以上、不鮮明なら0.5以下）,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "supplier": "取引先名・店舗名（正式名称で）",
      "total_amount": 合計金額（数値のみ）,
      "tax_amount": 消費税額合計（数値のみ、不明ならnull）,
      "tax_details": {
        "rate_10_amount": 10%対象の税抜金額（不明ならnull）,
        "rate_10_tax": 10%の消費税額（不明ならnull）,
        "rate_8_amount": 8%対象の税抜金額（不明ならnull）,
        "rate_8_tax": 8%の消費税額（不明ならnull）,
        "exempt_amount": 非課税金額（不明ならnull）
      },
      "tax_included": true（内税）またはfalse（外税）,
      "payment_method": "cash" | "credit_card" | "bank_transfer" | "e_money" | "other" | null,
      "invoice_number": "インボイス登録番号（Tから始まる番号、なければnull）",
      "reference_number": "伝票番号・取引番号（なければnull）",
      "items": [
        {
          "name": "商品名・摘要",
          "quantity": 数量（不明ならnull）,
          "unit_price": 単価（不明ならnull）,
          "amount": 金額（数値のみ）,
          "tax_rate": 0.10 | 0.08 | 0（税率。※マークがあれば0.08、不明ならnull）
        }
      ]
    }
  ]
}

【判定のヒント】
- レシートに「※」や「＊」マークがある品目は軽減税率8%対象（食品・飲料）
- 「T」で始まる13桁の番号はインボイス登録番号
- 「内税」「税込」表記があれば tax_included: true
- 「外税」「税抜」表記があれば tax_included: false
- 支払方法は「現金」「カード」「振込」「電子マネー」等の記載から判定`;

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
    });

    const text = result.text ?? '';

    // JSONを抽出（マークダウンコードブロックを除去）
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    const extracted = JSON.parse(jsonText);

    // transactions 配列の正規化
    const transactions: OCRTransaction[] = (extracted.transactions || []).map((tx: any) => ({
      date: tx.date || null,
      supplier: tx.supplier || null,
      total_amount: tx.total_amount != null ? Number(tx.total_amount) : null,
      tax_amount: tx.tax_amount != null ? Number(tx.tax_amount) : null,
      tax_details: tx.tax_details || null,
      tax_included: tx.tax_included ?? true,
      payment_method: tx.payment_method || null,
      invoice_number: tx.invoice_number || null,
      reference_number: tx.reference_number || null,
      items: (tx.items || []).map((item: any) => ({
        name: item.name || '',
        quantity: item.quantity ?? null,
        unit_price: item.unit_price ?? null,
        amount: Number(item.amount) || 0,
        tax_rate: item.tax_rate ?? null,
      })),
    }));

    // 先頭取引を代表値として使用
    const firstTx = transactions[0] || ({} as OCRTransaction);

    return {
      raw_text: text,
      document_type: extracted.document_type || 'other',
      transactions,
      extracted_date: firstTx.date || null,
      extracted_supplier: firstTx.supplier || null,
      extracted_amount: firstTx.total_amount ?? null,
      extracted_tax_amount: firstTx.tax_amount ?? null,
      extracted_items: firstTx.items?.length
        ? firstTx.items.map((i) => ({
            name: i.name,
            quantity: i.quantity ?? undefined,
            unit_price: i.unit_price ?? undefined,
            amount: i.amount,
            tax_rate: i.tax_rate ?? undefined,
          }))
        : null,
      extracted_payment_method: firstTx.payment_method || null,
      extracted_invoice_number: firstTx.invoice_number || null,
      confidence_score: extracted.confidence ?? 0.85,
    };
  } catch (error) {
    console.error('OCR処理エラー:', error);
    throw new Error(`OCR処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// AI仕訳生成サービス
// ============================================

/** 勘定科目マスタの簡易型（呼び出し元から渡す） */
export interface AccountItemRef {
  id: string;
  code: string;
  name: string;
  category: string;
}

/** 税区分マスタの簡易型（呼び出し元から渡す） */
export interface TaxCategoryRef {
  id: string;
  code: string;
  name: string;
  rate: number;
}

export interface JournalEntryInput {
  date: string;
  supplier: string;
  amount: number;
  tax_amount: number | null;
  tax_details: OCRTransaction['tax_details'];
  items: Array<{ name: string; amount: number; tax_rate?: number | null }> | null;
  payment_method: string | null;
  invoice_number: string | null;
  industry?: string;
  account_items: AccountItemRef[];
  tax_categories: TaxCategoryRef[];
}

/** AI が生成する仕訳明細行（DB構造に近い形） */
export interface GeneratedJournalLine {
  line_number: number;
  debit_credit: 'debit' | 'credit';
  account_item_name: string;
  tax_category_name: string | null;
  amount: number;
  tax_rate: number | null;
  tax_amount: number | null;
  description: string;
}

export interface GeneratedJournalEntry {
  category: '事業用' | 'プライベート';
  notes: string;
  confidence: number;
  reasoning: string;
  lines: GeneratedJournalLine[];
}

export async function generateJournalEntry(
  input: JournalEntryInput
): Promise<GeneratedJournalEntry> {
  try {
    const accountList = input.account_items
      .map((a) => `${a.name}(${a.code}/${a.category})`)
      .join(', ');

    const taxCategoryList = input.tax_categories
      .map((t) => `${t.name}(税率${(t.rate * 100).toFixed(0)}%)`)
      .join(', ');

    const paymentHint = (() => {
      switch (input.payment_method) {
        case 'credit_card': return '貸方は「未払金」または「クレジットカード」を使用';
        case 'bank_transfer': return '貸方は「普通預金」を使用';
        case 'e_money': return '貸方は「普通預金」または「未払金」を使用';
        case 'cash':
        default: return '貸方は「現金」を使用';
      }
    })();

    const prompt = `あなたは日本の税理士のアシスタントAIです。以下の取引情報から適切な仕訳を生成してください。

【取引情報】
- 取引日: ${input.date}
- 取引先: ${input.supplier}
- 合計金額: ${input.amount}円
- 消費税: ${input.tax_amount !== null ? input.tax_amount + '円' : '不明'}
${input.tax_details ? `- 税率内訳: 10%対象=${input.tax_details.rate_10_amount ?? '不明'}円(税${input.tax_details.rate_10_tax ?? '不明'}円), 8%対象=${input.tax_details.rate_8_amount ?? '不明'}円(税${input.tax_details.rate_8_tax ?? '不明'}円), 非課税=${input.tax_details.exempt_amount ?? '不明'}円` : ''}
- 品目: ${input.items && input.items.length > 0 ? input.items.map((i) => `${i.name}(${i.amount}円${i.tax_rate != null ? '/税率' + (i.tax_rate * 100) + '%' : ''})`).join(', ') : '不明'}
- 支払方法: ${input.payment_method || '不明'}
${input.invoice_number ? `- インボイス登録番号: ${input.invoice_number}` : '- インボイス番号: なし'}
${input.industry ? `- 業種: ${input.industry}` : ''}

【使用可能な勘定科目（この中から選んでください）】
${accountList}

【使用可能な税区分（この中から選んでください）】
${taxCategoryList}

【出力形式】
以下のJSON形式で返してください。JSONのみを返し、コードブロックや説明文は不要です。

{
  "category": "事業用" または "プライベート",
  "notes": "摘要（取引先名と品目を含める。例：ENEOS セルフ神戸北 ガソリン）",
  "confidence": 0.0〜1.0の信頼度,
  "reasoning": "判断理由（日本語で簡潔に）",
  "lines": [
    {
      "line_number": 1,
      "debit_credit": "debit" または "credit",
      "account_item_name": "勘定科目名（上記リストから選択）",
      "tax_category_name": "税区分名（上記リストから選択。対象外ならnull）",
      "amount": 金額（数値のみ）,
      "tax_rate": 税率（0.10 または 0.08 または 0 または null）,
      "tax_amount": 消費税額（数値のみ、不明ならnull）,
      "description": "明細摘要"
    }
  ]
}

【仕訳ルール】
1. 借方（debit）と貸方（credit）の合計金額は必ず一致させること。
2. ${paymentHint}。
3. 品目ごとに勘定科目が異なる場合は、借方を複数行に分けること。
4. 軽減税率8%の品目（食品・飲料等）は8%用の税区分を選ぶこと。
5. インボイス番号がない場合、仕入税額控除の対象外となる可能性があるため、税区分の選択に注意すること。
6. 摘要は「取引先名 品目」の形式で、事務所の税理士が見て一目でわかるように書くこと。
7. 事業用かプライベートかは、取引先名・品目・業種から総合的に判断すること。
8. プライベートと判断した場合は、借方を「事業主貸」にすること。

JSONのみを返してください。`;

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    const text = result.text ?? '';

    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

    const generated = JSON.parse(jsonText);

    const lines: GeneratedJournalLine[] = (generated.lines || []).map((line: any, idx: number) => ({
      line_number: line.line_number ?? idx + 1,
      debit_credit: line.debit_credit || 'debit',
      account_item_name: line.account_item_name || '雑費',
      tax_category_name: line.tax_category_name || null,
      amount: Number(line.amount) || 0,
      tax_rate: line.tax_rate ?? null,
      tax_amount: line.tax_amount != null ? Number(line.tax_amount) : null,
      description: line.description || '',
    }));

    if (lines.length === 0) {
      lines.push(
        {
          line_number: 1,
          debit_credit: 'debit',
          account_item_name: '雑費',
          tax_category_name: input.tax_amount ? '課対仕入10%' : null,
          amount: input.amount,
          tax_rate: input.tax_amount ? 0.10 : null,
          tax_amount: input.tax_amount,
          description: `${input.supplier}`,
        },
        {
          line_number: 2,
          debit_credit: 'credit',
          account_item_name: input.payment_method === 'credit_card' ? '未払金' : '現金',
          tax_category_name: null,
          amount: input.amount,
          tax_rate: null,
          tax_amount: null,
          description: `${input.supplier}`,
        }
      );
    }

    return {
      category: generated.category || '事業用',
      notes: generated.notes || `${input.supplier}`,
      confidence: generated.confidence ?? 0.7,
      reasoning: generated.reasoning || '自動判定',
      lines,
    };
  } catch (error) {
    console.error('仕訳生成エラー:', error);

    return {
      category: '事業用',
      notes: `${input.supplier}`,
      confidence: 0.3,
      reasoning: `AI判定失敗 - デフォルト値を使用（${error instanceof Error ? error.message : String(error)}）`,
      lines: [
        {
          line_number: 1,
          debit_credit: 'debit',
          account_item_name: '雑費',
          tax_category_name: input.tax_amount ? '課対仕入10%' : null,
          amount: input.amount,
          tax_rate: input.tax_amount ? 0.10 : null,
          tax_amount: input.tax_amount,
          description: `${input.supplier}`,
        },
        {
          line_number: 2,
          debit_credit: 'credit',
          account_item_name: input.payment_method === 'credit_card' ? '未払金' : '現金',
          tax_category_name: null,
          amount: input.amount,
          tax_rate: null,
          tax_amount: null,
          description: `${input.supplier}`,
        },
      ],
    };
  }
}

// ============================================
// ユーティリティ: AI出力の名前 → DB UUID マッピング
// ============================================

export function mapLinesToDBFormat(
  lines: GeneratedJournalLine[],
  accountItems: AccountItemRef[],
  taxCategories: TaxCategoryRef[],
  fallbackAccountId: string // 「雑費」のUUIDを呼び出し元から渡す
): Array<{
  line_number: number;
  debit_credit: 'debit' | 'credit';
  account_item_id: string;
  tax_category_id: string | null;
  amount: number;
  tax_rate: number | null;
  tax_amount: number | null;
  description: string | null;
}> {
  return lines.map((line) => {
    // 勘定科目名で検索（完全一致 → 部分一致フォールバック）
    const account =
      accountItems.find((a) => a.name === line.account_item_name) ||
      accountItems.find((a) =>
        line.account_item_name.includes(a.name) || a.name.includes(line.account_item_name)
      );

    // 税区分名で検索
    const taxCategory = line.tax_category_name
      ? taxCategories.find((t) => t.name === line.tax_category_name) ||
        taxCategories.find((t) =>
          line.tax_category_name!.includes(t.name) || t.name.includes(line.tax_category_name!)
        )
      : null;

    if (!account) {
      console.warn(`勘定科目が見つかりません: "${line.account_item_name}" → 雑費にフォールバック`);
    }

    return {
      line_number: line.line_number,
      debit_credit: line.debit_credit,
      account_item_id: account?.id || fallbackAccountId,
      tax_category_id: taxCategory?.id || null,
      amount: line.amount,
      tax_rate: line.tax_rate,
      tax_amount: line.tax_amount,
      description: line.description || null,
    };
  });
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