import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Upload, FileOutput, FileX, ArrowLeft, Building2, Receipt, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/client/lib/supabase';
import type { Client, Industry } from '@/types';

interface WorkflowLog {
  id: string;
  client_id: string;
  status: string;
  current_step: number;
  data: {
    uploaded_document_ids?: string[];
    ocr_completed_ids?: string[];
    aicheck_status?: boolean;
    review_completed_at?: string;
  };
  created_at: string;
  updated_at: string;
}

interface ClientDetail extends Client {
  industry?: Industry;
}

function formatSales(amount: number | null): string {
  if (!amount) return '-';
  if (amount >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(1)}億円`;
  if (amount >= 1_0000) return `${(amount / 1_0000).toFixed(0)}万円`;
  return `¥${amount.toLocaleString()}`;
}

export default function SummaryPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) loadData(clientId);
  }, [clientId]);

  const loadData = async (cid: string) => {
    setLoading(true);
    const [clientRes, wfRes] = await Promise.all([
      supabase.from('clients').select('*, industry:industries(*)').eq('id', cid).single(),
      supabase.from('workflows').select('*').eq('client_id', cid).order('created_at', { ascending: false }),
    ]);

    if (clientRes.data) setClient(clientRes.data as ClientDetail);
    if (wfRes.data) setWorkflows(wfRes.data as WorkflowLog[]);
    setLoading(false);
  };

  const getStepName = (step: number) => {
    const names = ['顧客選択', 'アップロード', 'OCR処理', 'AIチェック', '仕訳確認', '出力', '集計', '対象外'];
    return names[step - 1] || `ステップ${step}`;
  };

  const getStatusBadge = (wf: WorkflowLog) => {
    if (wf.status === 'completed') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} />完了</span>;
    if (wf.status === 'in_progress') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Clock size={12} />進行中</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle size={12} />{wf.status}</span>;
  };

  const getDocumentCount = (wf: WorkflowLog) => wf.data?.uploaded_document_ids?.length ?? 0;

  const formatPeriod = (wf: WorkflowLog) => {
    const d = new Date(wf.created_at);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">顧客が見つかりません</h2>
        <button onClick={() => navigate('/clients')} className="btn-primary mt-4">顧客一覧へ戻る</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clients')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">顧客詳細・業務ログ</p>
        </div>
        <button
          onClick={() => navigate(`/upload?client_id=${clientId}`)}
          className="flex items-center gap-2 btn-primary"
        >
          <Plus size={18} />新規ワークフロー開始
        </button>
      </div>

      {/* 顧客基本情報 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-500">業種</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{client.industry?.name || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={16} className="text-gray-500" />
              <span className="text-xs font-medium text-gray-500">年商</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{formatSales(client.annual_sales)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500">課税方式</span>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              client.tax_category === '原則課税' ? 'bg-blue-100 text-blue-800' :
              client.tax_category === '簡易課税' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>{client.tax_category}</span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500">インボイス</span>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${client.invoice_registered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {client.invoice_registered ? '登録済み' : '未登録'}
            </span>
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <Upload size={20} />, label: 'アップロード', desc: '証憑をアップロード', href: `/upload?client_id=${clientId}`, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200' },
          { icon: <FileOutput size={20} />, label: 'エクスポート', desc: 'freeeに出力', href: `/export?client_id=${clientId}`, color: 'text-green-600 bg-green-50 hover:bg-green-100 border-green-200' },
          { icon: <FileX size={20} />, label: '対象外証憑', desc: '除外された証憑', href: `/excluded?client_id=${clientId}`, color: 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200' },
        ].map(item => (
          <Link
            key={item.label}
            to={item.href}
            className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${item.color}`}
          >
            {item.icon}
            <div>
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-xs opacity-75">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 業務ログ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">業務ログ</h2>
          <span className="text-sm text-gray-500">{workflows.length}件</span>
        </div>

        {workflows.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">まだ処理履歴がありません</p>
            <button
              onClick={() => navigate(`/upload?client_id=${clientId}`)}
              className="mt-4 btn-primary text-sm"
            >
              最初のワークフローを開始する
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">期間</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">開始日</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">完了日</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">証憑数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">現在ステップ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {workflows.map((wf, idx) => (
                  <tr key={wf.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatPeriod(wf)} 第{workflows.length - idx}回
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(wf.created_at).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {wf.status === 'completed' ? new Date(wf.updated_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {getDocumentCount(wf)}件
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getStepName(wf.current_step)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(wf)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}