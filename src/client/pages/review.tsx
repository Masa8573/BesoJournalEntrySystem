import { useState } from 'react';
import { 
  ZoomOut, ZoomIn, RotateCcw, 
  Calendar, ChevronDown, Ban, AlertCircle
} from 'lucide-react';
import { useWorkflow } from '@/client/context/WorkflowContext';
import ProgressBar from '@/client/components/workflow/ProgressBar';
import WorkflowNavigation from '@/client/components/workflow/WorkflowNavigation';

export default function ReviewPage() {
  const { currentWorkflow, updateWorkflowData } = useWorkflow();
  const [isBusiness, setIsBusiness] = useState(true);

  // 次へ進む前の検証
  const handleBeforeNext = async (): Promise<boolean> => {
    // 仕訳確認完了フラグを保存
    updateWorkflowData({ reviewCompleted: true });
    return true;
  };

  // ワークフロー外からのアクセスを防ぐ
  if (!currentWorkflow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ワークフローが開始されていません</h2>
          <p className="text-gray-600 mb-6">
            仕訳確認を行うには、顧客一覧からワークフローを開始してください。
          </p>
          <a href="/clients" className="btn-primary">
            顧客一覧へ戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* 進捗バー */}
      <ProgressBar />

      {/* メインコンテンツ（2カラム） */}
      <div className="flex-1 p-6 grid grid-cols-2 gap-6 max-w-7xl mx-auto w-full overflow-y-auto">
        
        {/* 左カラム：証憑画像 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-lg">証憑画像</h2>
            <div className="flex items-center gap-2 border border-gray-300 rounded-md p-1">
              <button className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={16} /></button>
              <span className="text-sm px-2">100%</span>
              <button className="p-1 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={16} /></button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button className="p-1 hover:bg-gray-100 rounded text-gray-600"><RotateCcw size={16} /></button>
            </div>
          </div>
          
          <div className="flex-1 p-6 bg-slate-50 overflow-auto flex flex-col gap-4">
            {/* モックレシート */}
            <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto w-full font-mono text-sm">
              <div className="text-center mb-6">
                <p className="font-bold text-lg">コスモ石油</p>
                <p className="text-xs text-gray-500">東京都渋谷区xxx-xxx</p>
                <p className="text-xs text-gray-500">TEL: 03-xxxx-xxxx</p>
              </div>
              
              <div className="flex justify-between border-b border-dashed border-gray-300 pb-2 mb-4 bg-blue-50/50">
                <span>日付:</span>
                <span>2026-02-10</span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between"><span>商品A</span><span>500</span></div>
                <div className="flex justify-between"><span>商品B</span><span>380</span></div>
                <div className="flex justify-between text-xs text-gray-500"><span>（内消費税 10%）</span><span>436</span></div>
              </div>
              
              <div className="flex justify-between font-bold text-base border-t border-b border-dashed border-gray-300 py-2 mb-2 bg-green-50/50">
                <span>合計</span>
                <span>4,800円</span>
              </div>
              
              <div className="flex justify-between bg-yellow-50/50 py-1 mb-8">
                <span>消費税率:</span>
                <span>10%</span>
              </div>
              
              <p className="text-center text-xs text-gray-500">お買い上げありがとうございました</p>
            </div>

            {/* ハイライト凡例 */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm max-w-md mx-auto w-full">
              <p className="text-sm font-bold mb-3">ハイライト凡例:</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-200"></span>日付</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-200"></span>金額</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-200"></span>税率</div>
                <div className="flex items-center gap-2 text-red-500"><span className="w-3 h-3 rounded-full bg-red-200"></span>AIチェック警告箇所</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右カラム：仕訳データ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-lg">仕訳データ</h2>
            <p className="text-sm text-gray-500 mt-1">{currentWorkflow.clientName}さん</p>
          </div>
          
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
            
            {/* 入力フォーム群 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              {/* 取引日 */}
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>取引日
                </label>
                <div className="relative">
                  <input type="text" defaultValue="2026/02/10" className="w-full border border-blue-200 bg-blue-50/30 rounded-md p-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <Calendar size={16} className="absolute right-3 top-2.5 text-gray-400" />
                </div>
              </div>

              {/* 金額 */}
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400"></span>金額（円）
                </label>
                <input type="text" defaultValue="4800" className="w-full border border-green-200 bg-green-50/30 rounded-md p-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* 勘定科目 */}
              <div className="space-y-1">
                <label className="text-sm font-medium">勘定科目</label>
                <div className="relative">
                  <select className="w-full border border-gray-300 rounded-md p-2 px-3 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option>車両費（SHARYOU）</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 税区分 */}
              <div className="space-y-1">
                <label className="text-sm font-medium">税区分</label>
                <div className="relative">
                  <select className="w-full border border-gray-300 rounded-md p-2 px-3 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option>課対仕入</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 税率 */}
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span>税率
                </label>
                <div className="relative">
                  <select className="w-full border border-yellow-200 bg-yellow-50/30 rounded-md p-2 px-3 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>10%</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 取引先タグ */}
              <div className="space-y-1">
                <label className="text-sm font-medium">取引先タグ</label>
                <input type="text" defaultValue="コスモ石油" className="w-full border border-gray-300 rounded-md p-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* 品目タグ */}
              <div className="space-y-1 col-span-2">
                <label className="text-sm font-medium">品目タグ</label>
                <input type="text" className="w-full border border-gray-300 rounded-md p-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* 摘要 */}
              <div className="space-y-1 col-span-2">
                <label className="text-sm font-medium">摘要</label>
                <input type="text" placeholder="摘要を入力" className="w-full border border-gray-300 rounded-md p-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* ルール・事業用設定エリア */}
            <div className="mt-auto border border-gray-200 rounded-lg p-4 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md p-1">
                <button 
                  onClick={() => setIsBusiness(true)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${isBusiness ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  事業用
                </button>
                <button 
                  onClick={() => setIsBusiness(false)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${!isBusiness ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  プライベート <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">P</span>
                </button>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                  ルール追加
                  <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">R</span>
                </label>
                <div className="relative">
                  <select className="border border-gray-300 rounded-md p-1.5 pl-3 pr-8 appearance-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option>ドライバー</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 対象外ボタン */}
            <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors">
              <Ban size={16} className="text-gray-400" /> 対象外にする
              <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-500 text-xs rounded">E</span>
            </button>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <WorkflowNavigation 
        onBeforeNext={handleBeforeNext}
        nextLabel="仕訳出力へ"
      />
    </div>
  );
}