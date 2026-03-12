import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, AlertCircle, History, Calendar } from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import { supabase } from '@/client/lib/supabase';
import WorkflowHeader from '@/client/components/workflow/WorkflowHeader';

// ============================================
// 型定義
// ============================================
type PeriodFilter = '全期間' | '本日' | '今週' | '今月' | '先月' | 'カスタム';
type ExcludedFilter = '全て' | '対象外除く';
type ActiveTab = '出力' | '出力履歴';

interface ExportLine {
  id: string;
  line_number: number;
  debit_credit: string;
  account_item_id: string | null;
  tax_category_id: string | null;
  amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  description: string | null;
  account_item: { id: string; name: string } | { id: string; name: string }[] | null;
  tax_category: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface EntryWithJoin {
  id: string;
  entry_date: string;
  description: string | null;
  status: string;
  is_excluded: boolean;
  supplier_id: string | null;
  lines: ExportLine[];
}

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
function getDateRange(filter: PeriodFilter, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filter) {
    case '本日': return { start: today, end: new Date(today.getTime() + 86400000 - 1) };
    case '今週': {
      const day = today.getDay();
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon, end: sun };
    }
    case '今月': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    case '先月': return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0) };
    case 'カスタム': return { start: customStart ? new Date(customStart) : null, end: customEnd ? new Date(customEnd) : null };
    default: return { start: null, end: null };
  }
}

function formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'; }
function formatDateTime(d: string | null) { return d ? new Date(d).toLocaleString('ja-JP') : '-'; }
function formatCurrency(n: number) { return `¥${n.toLocaleString('ja-JP')}`; }

function getDebitLine(entry: EntryWithJoin) { return entry.lines?.find(l => l.debit_credit === 'debit'); }
function getCreditLine(entry: EntryWithJoin) { return entry.lines?.find(l => l.debit_credit === 'credit'); }
function getEntryAmount(entry: EntryWithJoin) { return entry.lines?.filter(l => l.debit_credit === 'debit').reduce((s, l) => s + (l.amount ?? 0), 0) ?? 0; }

/** Supabase JOIN は FK によって配列 or オブジェクトを返す。安全にname取得 */
function getRelName(rel: { id: string; name: string } | { id: string; name: string }[] | null | undefined): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name || '';
  return rel.name || '';
}

// ============================================
// freee CSV生成（サンプルCSV準拠 UTF-8 BOM付き）
// ============================================
function buildFreeeCsv(entries: EntryWithJoin[]): string {
  const headers = [
    '収支区分', '管理番号', '発生日', '決済期日', '取引先コード', '取引先',
    '勘定科目', '税区分', '金額', '税計算区分', '税額', '備考', '品目', '部門',
    'メモタグ（複数指定可、カンマ区切り）', 'セグメント1', 'セグメント2', 'セグメント3',
    '決済日', '決済口座', '決済金額'
  ];

  const rows: string[][] = [];
  entries.forEach(entry => {
    const debit = getDebitLine(entry);
    const credit = getCreditLine(entry);
    if (!debit) return;

    const accountName = getRelName(debit.account_item);
    const taxCatName = getRelName(debit.tax_category);
    const amount = debit.amount?.toString() || '0';
    const taxAmount = debit.tax_amount?.toString() || '';
    const isIncome = accountName.includes('売上') || accountName.includes('収入');

    rows.push([
      isIncome ? '収入' : '支出',   // 収支区分
      '',                             // 管理番号
      entry.entry_date?.replace(/-/g, '/') || '', // 発生日
      '',                             // 決済期日
      '',                             // 取引先コード
      '',                             // 取引先（TODO: supplier JOIN）
      accountName,                    // 勘定科目
      taxCatName,                     // 税区分
      amount,                         // 金額
      '内税',                         // 税計算区分（デフォルト内税）
      taxAmount,                      // 税額
      entry.description || '',        // 備考
      '',                             // 品目
      '',                             // 部門
      '',                             // メモタグ
      '', '', '',                     // セグメント1-3
      credit ? entry.entry_date?.replace(/-/g, '/') || '' : '', // 決済日
      credit ? getRelName(credit.account_item) : '',  // 決済口座
      credit ? (credit.amount?.toString() || '') : '', // 決済金額
    ]);
  });

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  return '\uFEFF' + csv;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: '完了', cls: 'bg-green-100 text-green-800' },
    pending: { label: '処理中', cls: 'bg-yellow-100 text-yellow-800' },
    error: { label: 'エラー', cls: 'bg-red-100 text-red-800' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ============================================
// メインコンポーネント
// ============================================
export default function ExportPage() {
  const { currentWorkflow } = useWorkflow();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('client_id') ?? currentWorkflow?.clientId ?? '';

  const [activeTab, setActiveTab] = useState<ActiveTab>('出力');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('本日');  // ← デフォルト「本日」に変更
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [excludedFilter, setExcludedFilter] = useState<ExcludedFilter>('対象外除く');

  const [entries, setEntries] = useState<EntryWithJoin[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ============================================
  // 仕訳データ取得（account_items, tax_categories を JOIN）
  // ============================================
  useEffect(() => { if (clientId) loadEntries(); }, [clientId]);

  const loadEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        id, entry_date, description, status, is_excluded, supplier_id,
        lines:journal_entry_lines(
          id, line_number, debit_credit, account_item_id, tax_category_id, amount, tax_rate, tax_amount, description,
          account_item:account_items!journal_entry_lines_account_item_id_fkey(id, name),
          tax_category:tax_categories!journal_entry_lines_tax_category_id_fkey(id, name)
        )
      `)
      .eq('client_id', clientId)
      .in('status', ['approved', 'posted'])
      .order('entry_date', { ascending: false });

    if (!error && data) setEntries(data as unknown as EntryWithJoin[]);
    setLoading(false);
  };

  // 出力履歴
  useEffect(() => { if (activeTab === '出力履歴' && clientId) loadHistory(); }, [activeTab, clientId]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase.from('exports').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    if (!error && data) setExportHistory(data as ExportRecord[]);
    setHistoryLoading(false);
  };

  // フィルタリング
  const filteredByPeriod = useMemo(() => {
    const { start, end } = getDateRange(periodFilter, customStart, customEnd);
    return entries.filter(e => { if (!start && !end) return true; const d = new Date(e.entry_date); return (!start || d >= start) && (!end || d <= end); });
  }, [entries, periodFilter, customStart, customEnd]);

  const filteredEntries = useMemo(() => {
    return excludedFilter === '対象外除く' ? filteredByPeriod.filter(e => !e.is_excluded) : filteredByPeriod;
  }, [filteredByPeriod, excludedFilter]);

  const summary = useMemo(() => {
    const active = filteredByPeriod.filter(e => !e.is_excluded);
    const excluded = filteredByPeriod.filter(e => e.is_excluded);
    const total = filteredByPeriod.reduce((s, e) => s + getEntryAmount(e), 0);
    return { total: filteredByPeriod.length, active: active.length, excluded: excluded.length, totalAmount: total };
  }, [filteredByPeriod]);

  // CSV ダウンロード
  const handleCsvDownload = () => {
    const csv = buildFreeeCsv(filteredEntries);
    const name = currentWorkflow?.clientName ?? clientId;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadCsv(csv, `freee取込_${name}_${dateStr}.csv`);
  };

  if (!currentWorkflow && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <a href="/clients" className="btn-primary">顧客一覧へ戻る</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {currentWorkflow && <WorkflowHeader nextLabel="集計・チェックへ" />}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">仕訳出力</h1>
            <p className="text-sm text-gray-500 mt-1">{currentWorkflow?.clientName ?? clientId} — freee取込用CSVをダウンロードできます</p>
          </div>

          {/* タブ */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-4">
              {(['出力', '出力履歴'] as ActiveTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {tab === '出力履歴' && <History size={14} className="inline mr-1 -mt-0.5" />}{tab}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === '出力' && (
            <>
              {/* 期間フィルター */}
              <div className="card">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Calendar size={16} />対象期間</h2>
                <div className="flex flex-wrap gap-2">
                  {(['全期間', '本日', '今週', '今月', '先月', 'カスタム'] as PeriodFilter[]).map(p => (
                    <button key={p} onClick={() => setPeriodFilter(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${periodFilter === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                {periodFilter === 'カスタム' && (
                  <div className="flex items-center gap-3 mt-4">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input w-auto text-sm" />
                    <span className="text-gray-400">〜</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input w-auto text-sm" />
                  </div>
                )}
              </div>

              {/* サマリー */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: '総仕訳数', value: `${summary.total} 件` },
                  { label: '出力対象', value: `${summary.active} 件` },
                  { label: '対象外', value: `${summary.excluded} 件` },
                  { label: '合計金額', value: formatCurrency(summary.totalAmount) },
                ].map(card => (
                  <div key={card.label} className="card">
                    <h3 className="text-xs font-medium text-gray-500 mb-2">{card.label}</h3>
                    <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                  </div>
                ))}
              </div>

              {/* 仕訳一覧 + CSV */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">仕訳一覧</h2>
                    <span className="text-sm text-gray-500">{filteredEntries.length} 件</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      {(['全て', '対象外除く'] as ExcludedFilter[]).map(f => (
                        <button key={f} onClick={() => setExcludedFilter(f)}
                          className={`px-3 py-1.5 text-sm transition-colors ${excludedFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleCsvDownload} disabled={filteredEntries.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Download size={16} />freee CSV ダウンロード
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
                          {['取引日', '勘定科目', '税区分', '金額', '摘要', '対象外'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredEntries.map(entry => {
                          const debit = getDebitLine(entry);
                          const amount = getEntryAmount(entry);
                          return (
                            <tr key={entry.id} className={`hover:bg-gray-50 ${entry.is_excluded ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-3 text-gray-700">{formatDate(entry.entry_date)}</td>
                              <td className="px-4 py-3 text-gray-900 font-medium">{getRelName(debit?.account_item) || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{getRelName(debit?.tax_category) || '-'}</td>
                              <td className="px-4 py-3 text-right font-mono text-gray-900">{formatCurrency(amount)}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{entry.description || '-'}</td>
                              <td className="px-4 py-3">{entry.is_excluded && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">対象外</span>}</td>
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

          {activeTab === '出力履歴' && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">出力履歴</h2>
              {historyLoading ? (
                <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : exportHistory.length === 0 ? (
                <div className="text-center py-16"><History size={48} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">出力履歴がありません</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>{['出力日時', '種別', '件数', 'ファイル名', '対象期間', 'ステータス'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {exportHistory.map(rec => (
                        <tr key={rec.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{formatDateTime(rec.created_at)}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">CSV</span></td>
                          <td className="px-4 py-3 text-gray-900">{rec.entry_count ?? '-'} 件</td>
                          <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{rec.file_name ?? '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{rec.start_date && rec.end_date ? `${formatDate(rec.start_date)} 〜 ${formatDate(rec.end_date)}` : '-'}</td>
                          <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
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
    </div>
  );
}