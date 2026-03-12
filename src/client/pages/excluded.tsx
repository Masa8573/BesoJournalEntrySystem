import { useState, useEffect } from 'react';
import { FileX, AlertCircle, Loader, RotateCcw, FileText, FileSpreadsheet, Package, ClipboardList, HelpCircle } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';

// ============================================
// 型定義
// ============================================
type ExcludedCategory = '全て' | '契約書' | '見積書' | '発注書' | '納品書' | 'その他';

interface ExcludedDoc {
  id: string;
  docId: string;
  fileName: string;
  excludedReason: string | null;
  excludedAt: string | null;
  amount: number | null;
  supplierName: string | null;
  category: ExcludedCategory;
  entryId: string | null;
}

// 除外理由からカテゴリを推定
function guessCategory(reason: string | null, fileName: string): ExcludedCategory {
  const text = `${reason || ''} ${fileName}`.toLowerCase();
  if (text.includes('契約') || text.includes('contract')) return '契約書';
  if (text.includes('見積') || text.includes('estimate') || text.includes('quotation')) return '見積書';
  if (text.includes('発注') || text.includes('order') || text.includes('注文')) return '発注書';
  if (text.includes('納品') || text.includes('delivery')) return '納品書';
  return 'その他';
}

const CATEGORY_ICONS: Record<ExcludedCategory, React.ReactNode> = {
  '全て': <FileX size={16} />,
  '契約書': <FileText size={16} />,
  '見積書': <FileSpreadsheet size={16} />,
  '発注書': <ClipboardList size={16} />,
  '納品書': <Package size={16} />,
  'その他': <HelpCircle size={16} />,
};

// ============================================
// メインコンポーネント
// ============================================
export default function ExcludedPage() {
  const { currentWorkflow } = useWorkflow();

  const [excludedDocs, setExcludedDocs] = useState<ExcludedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ExcludedCategory>('全て');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ============================================
  // データ読み込み
  // ============================================
  useEffect(() => {
    if (!currentWorkflow) return;
    loadExcludedDocs();
  }, [currentWorkflow]);

  const loadExcludedDocs = async () => {
    if (!currentWorkflow) return;
    setLoading(true);

    const clientId = currentWorkflow.clientId;

    // is_excluded=true の journal_entries を取得
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select(`
        id, document_id, is_excluded, excluded_reason, excluded_at,
        description,
        documents!journal_entries_document_id_fkey(
          id, file_name, original_file_name, amount, supplier_name
        )
      `)
      .eq('client_id', clientId)
      .eq('is_excluded', true)
      .order('excluded_at', { ascending: false });

    if (error) {
      console.error('対象外証憑取得エラー:', error);
    }

    // documents テーブルから直接 excluded ステータスのものも取得
    const { data: excludedDocsDirect } = await supabase
      .from('documents')
      .select('id, file_name, original_file_name, amount, supplier_name, status')
      .eq('client_id', clientId)
      .eq('workflow_id', currentWorkflow.id)
      .eq('status', 'excluded');

    const docs: ExcludedDoc[] = [];
    const seenDocIds = new Set<string>();

    // journal_entries 経由
    if (entries) {
      entries.forEach((entry: any) => {
        const doc = entry.documents;
        const docId = entry.document_id || '';
        if (docId) seenDocIds.add(docId);
        const fileName = doc?.original_file_name || doc?.file_name || '不明';
        docs.push({
          id: entry.id,
          docId,
          fileName,
          excludedReason: entry.excluded_reason || entry.description || null,
          excludedAt: entry.excluded_at || null,
          amount: doc?.amount || null,
          supplierName: doc?.supplier_name || null,
          category: guessCategory(entry.excluded_reason, fileName),
          entryId: entry.id,
        });
      });
    }

    // documents テーブルから直接（journal_entries に紐づいていないもの）
    if (excludedDocsDirect) {
      excludedDocsDirect.forEach((doc: any) => {
        if (seenDocIds.has(doc.id)) return;
        const fileName = doc.original_file_name || doc.file_name || '不明';
        docs.push({
          id: `doc-${doc.id}`,
          docId: doc.id,
          fileName,
          excludedReason: null,
          excludedAt: null,
          amount: doc.amount || null,
          supplierName: doc.supplier_name || null,
          category: guessCategory(null, fileName),
          entryId: null,
        });
      });
    }

    setExcludedDocs(docs);
    setLoading(false);
  };

  // ============================================
  // 対象内に戻す
  // ============================================
  const handleRestore = async (doc: ExcludedDoc) => {
    setRestoringId(doc.id);

    try {
      // journal_entries の is_excluded を false に戻し、status を draft に
      if (doc.entryId) {
        await supabase
          .from('journal_entries')
          .update({
            is_excluded: false,
            excluded_reason: null,
            excluded_at: null,
            excluded_by: null,
            status: 'draft',
          })
          .eq('id', doc.entryId);
      }

      // documents のステータスも戻す
      if (doc.docId) {
        await supabase
          .from('documents')
          .update({ status: 'reviewed' })
          .eq('id', doc.docId)
          .eq('status', 'excluded');
      }

      // リストから除去
      setExcludedDocs(prev => prev.filter(d => d.id !== doc.id));

      // トースト表示
      setToastMessage(`「${doc.fileName}」を対象内に戻しました。仕訳確認ページで確認してください。`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('対象内復帰エラー:', err);
      alert('復帰に失敗しました');
    } finally {
      setRestoringId(null);
    }
  };

  // ============================================
  // フィルタリング
  // ============================================
  const filteredDocs = activeCategory === '全て'
    ? excludedDocs
    : excludedDocs.filter(d => d.category === activeCategory);

  const categoryCounts = {
    '全て': excludedDocs.length,
    '契約書': excludedDocs.filter(d => d.category === '契約書').length,
    '見積書': excludedDocs.filter(d => d.category === '見積書').length,
    '発注書': excludedDocs.filter(d => d.category === '発注書').length,
    '納品書': excludedDocs.filter(d => d.category === '納品書').length,
    'その他': excludedDocs.filter(d => d.category === 'その他').length,
  };

  // ============================================
  // ガード
  // ============================================
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">顧客一覧からワークフローを開始してください。</p>
          <a href="/clients" className="btn-primary">顧客一覧へ戻る</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* ワークフローヘッダー（最終ステップ：完了ボタン付き） */}
      <WorkflowHeader showComplete={true} />

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">対象外証憑</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow.clientName} — 仕訳対象外の証憑を確認・管理します
            </p>
          </div>

          {/* カテゴリフィルター */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(categoryCounts) as ExcludedCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {CATEGORY_ICONS[cat]}
                {cat}
                <span className={`ml-1 text-xs ${activeCategory === cat ? 'text-blue-200' : 'text-gray-400'}`}>
                  ({categoryCounts[cat]})
                </span>
              </button>
            ))}
          </div>

          {/* 対象外リスト */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              対象外証憑一覧
              <span className="text-sm font-normal text-gray-500 ml-2">{filteredDocs.length} 件</span>
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader size={32} className="animate-spin text-blue-500" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileX size={64} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">
                  {activeCategory === '全て' ? '対象外証憑はありません' : `「${activeCategory}」に該当する対象外証憑はありません`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-gray-400">
                        {CATEGORY_ICONS[doc.category]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {doc.supplierName && (
                            <span className="text-xs text-gray-500">{doc.supplierName}</span>
                          )}
                          {doc.amount != null && (
                            <span className="text-xs text-gray-500">¥{doc.amount.toLocaleString()}</span>
                          )}
                          {doc.excludedReason && (
                            <span className="text-xs text-gray-400">理由: {doc.excludedReason}</span>
                          )}
                          {doc.excludedAt && (
                            <span className="text-xs text-gray-400">
                              {new Date(doc.excludedAt).toLocaleDateString('ja-JP')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        doc.category === '契約書' ? 'bg-purple-100 text-purple-700' :
                        doc.category === '見積書' ? 'bg-blue-100 text-blue-700' :
                        doc.category === '発注書' ? 'bg-orange-100 text-orange-700' :
                        doc.category === '納品書' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {doc.category}
                      </span>

                      <button
                        onClick={() => handleRestore(doc)}
                        disabled={restoringId === doc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        {restoringId === doc.id ? (
                          <Loader size={14} className="animate-spin" />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        対象内に戻す
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 完了メッセージ */}
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <FileX size={32} className="text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">ワークフロー完了準備完了</h3>
                <p className="text-sm text-blue-700">
                  すべてのステップが完了しました。上部の「完了」ボタンでワークフローを終了してください。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <RotateCcw size={16} />
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}