import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  FileText,
  AlertCircle,
  History,
  Calendar,
  ChevronDown,
  Key,
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';
import type { JournalEntryWithRelations, JournalEntryLine } from '@/types';

// ============================================
// 型定義
// ============================================

type PeriodFilter = '全期間' | '本日' | '今週' | '今月' | '先月' | 'カスタム';
type ExcludedFilter = '全て' | '事業用のみ' | '対象外除く';
type ActiveTab = '出力' | '出力履歴';

interface ExportRecord {
  id: string;
  created_at: string;
  export_type: string;
  export_format: string | null;
  entry_count: number | null;
  file_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

// ============================================
// ユーティリティ
// ============================================

function getDateRange(filter: PeriodFilter, customStart?: string, customEnd?: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case '本日':
      return { start: today, end: new Date(today.getTime() + 86400000 - 1) };
    case '今週': {
      const day = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: mon, end: sun };
    }
    case '今月':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    case '先月':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    case 'カスタム':
      return {
        start: customStart ? new Date(customStart) : null,
        end: customEnd ? new Date(customEnd) : null,
      };
    default:
      return { start: null, end: null };
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/** 明細行の借方合計を返す（ヘッダー単位の金額として使用） */
function getEntryAmount(entry: JournalEntryWithRelations): number {
  if (!entry.lines || entry.lines.length === 0) return 0;
  return entry.lines
    .filter((l: JournalEntryLine) => l.debit_credit === 'debit')
    .reduce((sum: number, l: JournalEntryLine) => sum + (l.amount ?? 0), 0);
}

/** 先頭の借方明細行を返す（科目・税区分の代表値として使用） */
function getFirstDebitLine(entry: JournalEntryWithRelations): JournalEntryLine | undefined {
  return entry.lines?.find((l: JournalEntryLine) => l.debit_credit === 'debit');
}

// ============================================
// CSV生成（freee取込フォーマット準拠、UTF-8 BOM付き）
// ============================================

// NOTE: account_item / tax_category の名前解決には
//       SELECT時にJOINしたデータが必要。現状はIDのみのためプレースホルダー。
//       実装フェーズでSupabaseのSELECTクエリにJOINを追加すること。
function buildCsvContent(entries: JournalEntryWithRelations[]): string {
  const headers = ['取引日', '借方科目', '借方税区分', '借方金額', '貸方科目', '貸方税区分', '貸方金額', '摘要'];
  const rows = entries.map((e) => {
    const firstLine = getFirstDebitLine(e);
    return [
      e.entry_date ?? '',
      firstLine?.account_item_id ?? '',   // TODO: JOIN後は account_item?.name に変更
      firstLine?.tax_category_id ?? '',   // TODO: JOIN後は tax_category?.name に変更
      firstLine?.amount?.toString() ?? '0',
      '',
      '',
      '',
      e.description ?? '',
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  return '\uFEFF' + csv;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// ステータスバッジ
// ============================================

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed:  { label: '完了',       cls: 'bg-green-100 text-green-800' },
    pending:    { label: '処理中',     cls: 'bg-yellow-100 text-yellow-800' },
    processing: { label: '処理中',     cls: 'bg-blue-100 text-blue-800' },
    error:      { label: 'エラー',     cls: 'bg-red-100 text-red-800' },
    cancelled:  { label: 'キャンセル', cls: 'bg-gray-100 text-gray-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ============================================
// メインコンポーネント
// ============================================

export default function ExportPage() {
  const { currentWorkflow } = useWorkflow();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') ?? currentWorkflow?.clientId ?? '';

  const [activeTab, setActiveTab] = useState<ActiveTab>('出力');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('今月');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [excludedFilter, setExcludedFilter] = useState<ExcludedFilter>('全て');

  const [entries, setEntries] = useState<JournalEntryWithRelations[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ============================================
  // 仕訳データ取得（lines を JOIN）
  // ============================================

  useEffect(() => {
    if (!clientId) return;
    loadEntries();
  }, [clientId]);

  const loadEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*, lines:journal_entry_lines(*)')
      .eq('client_id', clientId)
      .in('status', ['approved', 'posted'])
      .order('entry_date', { ascending: false });

    if (!error && data) {
      setEntries(data as JournalEntryWithRelations[]);
    }
    setLoading(false);
  };

  // ============================================
  // 出力履歴取得
  // ============================================

  useEffect(() => {
    if (activeTab === '出力履歴' && clientId) loadHistory();
  }, [activeTab, clientId]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('exports')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!error && data) setExportHistory(data as ExportRecord[]);
    setHistoryLoading(false);
  };

  // ============================================
  // フィルタリング
  // ============================================

  const filteredByPeriod = useMemo(() => {
    const { start, end } = getDateRange(periodFilter, customStart, customEnd);
    return entries.filter((e) => {
      if (!start && !end) return true;
      const d = new Date(e.entry_date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [entries, periodFilter, customStart, customEnd]);

  const filteredEntries = useMemo(() => {
    switch (excludedFilter) {
      case '対象外除く': return filteredByPeriod.filter((e) => !e.is_excluded);
      case '事業用のみ': return filteredByPeriod.filter((e) => !e.is_excluded);
      default: return filteredByPeriod;
    }
  }, [filteredByPeriod, excludedFilter]);

  // ============================================
  // サマリー集計（新型: is_excluded で区別、金額は lines の借方合計）
  // ============================================

  const summary = useMemo(() => {
    const active   = filteredByPeriod.filter((e) => !e.is_excluded);
    const excluded = filteredByPeriod.filter((e) => e.is_excluded);
    const total    = filteredByPeriod.reduce((sum, e) => sum + getEntryAmount(e), 0);
    return {
      total: filteredByPeriod.length,
      active: active.length,
      excluded: excluded.length,
      totalAmount: total,
    };
  }, [filteredByPeriod]);

  // ============================================
  // CSV ダウンロード
  // ============================================

  const handleCsvDownload = () => {
    const csv = buildCsvContent(filteredEntries);
    const clientName = currentWorkflow?.clientName ?? clientId;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadCsv(csv, `仕訳_${clientName}_${dateStr}.csv`);
  };

  // ============================================
  // ワークフロー外アクセス制御
  // ============================================

  if (!currentWorkflow && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">
            仕訳出力を行うには、顧客一覧からワークフローを開始してください。
          </p>
          <a href="/clients" className="btn-primary">顧客一覧へ戻る</a>
        </div>
      </div>
    );
  }

  // ============================================
  // レンダリング
  // ============================================

  return (
    <div className="flex flex-col h-screen">
      {currentWorkflow && <ProgressBar />}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ページヘッダー */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">仕訳出力</h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentWorkflow?.clientName ?? clientId} — 仕訳データをエクスポートします
            </p>
          </div>

          {/* タブ */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-4">
              {(['出力', '出力履歴'] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === '出力履歴' && <History size={14} className="inline mr-1 -mt-0.5" />}
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          {/* ====== 出力タブ ====== */}
          {activeTab === '出力' && (
            <>
              {/* 期間フィルター */}
              <div className="card">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar size={16} />
                  対象期間
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(['全期間', '本日', '今週', '今月', '先月', 'カスタム'] as PeriodFilter[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriodFilter(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        periodFilter === p
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {periodFilter === 'カスタム' && (
                  <div className="flex items-center gap-3 mt-4">
                    <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input w-auto text-sm" />
                    <ChevronDown size={14} className="text-gray-400 rotate-[-90deg]" />
                    <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input w-auto text-sm" />
                  </div>
                )}
              </div>

              {/* サマリーカード（4枚） */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: '総仕訳数',     value: `${summary.total} 件`,          filter: '全て'      as ExcludedFilter },
                  { label: '出力対象',     value: `${summary.active} 件`,         filter: '対象外除く' as ExcludedFilter },
                  { label: '対象外',       value: `${summary.excluded} 件`,       filter: null },
                  { label: '合計金額',     value: formatCurrency(summary.totalAmount), filter: null },
                ].map((card) => (
                  <button
                    key={card.label}
                    onClick={() => card.filter && setExcludedFilter(card.filter)}
                    className={`card text-left transition-all hover:shadow-md ${
                      card.filter && excludedFilter === card.filter ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                    } ${!card.filter ? 'cursor-default' : ''}`}
                  >
                    <h3 className="text-xs font-medium text-gray-500 mb-2">{card.label}</h3>
                    <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                  </button>
                ))}
              </div>

              {/* 仕訳一覧 */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">仕訳一覧</h2>
                    <span className="text-sm text-gray-500">{filteredEntries.length} 件</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* フィルター切り替え */}
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      {(['全て', '対象外除く'] as ExcludedFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setExcludedFilter(f)}
                          className={`px-3 py-1.5 text-sm transition-colors ${
                            excludedFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    {/* CSV ダウンロード */}
                    <button
                      onClick={handleCsvDownload}
                      disabled={filteredEntries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium
                                 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Download size={16} />
                      CSV ダウンロード
                    </button>

                    {/* freee 連携（未実装プレースホルダー）*/}
                    <button
                      disabled
                      title="freee APIキーが設定されていません"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm
                                 font-medium cursor-not-allowed border border-dashed border-gray-300"
                    >
                      <Key size={16} />
                      freee 連携
                      <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">APIキー未設定</span>
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">対象期間に仕訳データがありません</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['取引日', '勘定科目（借方）', '税区分', '金額', '取引先', '摘要', '対象外'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEntries.map((entry) => {
                          const firstLine = getFirstDebitLine(entry);
                          const amount    = getEntryAmount(entry);
                          return (
                            <tr key={entry.id} className={`hover:bg-gray-50 transition-colors ${entry.is_excluded ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                                {formatDate(entry.entry_date)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                                {/* TODO: account_items JOIN後は name を表示 */}
                                {firstLine?.account_item_id ?? '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                {/* TODO: tax_categories JOIN後は name を表示 */}
                                {firstLine?.tax_category_id ?? '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-900">
                                {formatCurrency(amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600 max-w-[120px] truncate">
                                {entry.supplier?.name ?? '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                                {entry.description ?? '-'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {entry.is_excluded && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    対象外
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ====== 出力履歴タブ ====== */}
          {activeTab === '出力履歴' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">出力履歴</h2>
              {historyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : exportHistory.length === 0 ? (
                <div className="text-center py-16">
                  <History size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">出力履歴がありません</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['出力日時', '種別', '件数', 'ファイル名', '対象期間', 'ステータス'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {exportHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDateTime(rec.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              rec.export_format === 'freee' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {rec.export_format === 'freee' ? 'freee' : 'CSV'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                            {rec.entry_count != null ? `${rec.entry_count} 件` : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={rec.file_name ?? ''}>
                            {rec.file_name ?? '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {rec.start_date && rec.end_date
                              ? `${formatDate(rec.start_date)} 〜 ${formatDate(rec.end_date)}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={rec.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {currentWorkflow && <WorkflowNavigation nextLabel="集計・チェックへ" />}
    </div>
  );
}