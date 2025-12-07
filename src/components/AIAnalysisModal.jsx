import React from 'react';
import { 
  X, Sparkles, Trophy, TrendingUp, TrendingDown, 
  Activity, Target, Lightbulb, Loader2 
} from 'lucide-react';

const AIAnalysisModal = ({ isOpen, onClose, isLoading, analysisResult, error }) => {
  // 1. 如果沒開，不渲染
  if (!isOpen) return null;

  // 2. 安全檢查：確保 analysisResult 裡面的 details 存在，避免讀取錯誤
  const safeDetails = analysisResult?.details || {
      winRate: 0,
      maxDrawdown: 0,
      avgProfit: 0,
      avgLoss: 0
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 視窗本體 */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* 關閉按鈕 */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* ---------------- 狀態 1: 載入中 ---------------- */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 animate-pulse"></div>
              <Loader2 size={48} className="text-violet-600 animate-spin relative z-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">AI 導師正在分析...</h3>
              <p className="text-sm text-slate-500 mt-2">正在回放您的每一筆交易與決策</p>
            </div>
          </div>
        )}

        {/* ---------------- 狀態 2: 發生錯誤 ---------------- */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Activity size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">分析失敗</h3>
            <p className="text-sm text-slate-500 mb-6">{typeof error === 'object' ? '發生未預期的錯誤' : error}</p>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
            >
              關閉
            </button>
          </div>
        )}

        {/* ---------------- 狀態 3: 顯示結果 ---------------- */}
        {/* 關鍵修正：這裡絕對不能寫 {analysisResult}，必須取用屬性 */}
        {!isLoading && !error && analysisResult && (
          <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto">
            
            {/* 頂部總評區塊 */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white text-center relative overflow-hidden shrink-0">
              <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <Sparkles size={120} className="absolute -top-4 -left-4 animate-pulse" />
                <Trophy size={100} className="absolute bottom-0 right-0 rotate-12" />
              </div>
              
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/30 mb-3">
                  <Sparkles size={12} className="text-yellow-300" />
                  AI 投資診斷書
                </div>
                
                <div className="flex items-baseline justify-center gap-1 mb-1">
                  {/* 只顯示數字 */}
                  <span className="text-6xl font-black tracking-tighter drop-shadow-xl">
                    {analysisResult.score || 0}
                  </span>
                  <span className="text-xl opacity-80 font-bold">分</span>
                </div>
                
                {/* 只顯示標題文字 */}
                <h2 className="text-lg font-bold text-white/90">
                  {analysisResult.title || '分析完成'}
                </h2>
              </div>
            </div>

            {/* 數據儀表板 */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-white">
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                  <Target size={12} /> 勝率
                </div>
                <div className="text-xl font-black text-slate-700">
                  {safeDetails.winRate}%
                </div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                  <TrendingDown size={12} /> 最大回撤
                </div>
                <div className="text-xl font-black text-emerald-600">
                  -{safeDetails.maxDrawdown}%
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-white">
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                  <TrendingUp size={12} /> 平均獲利
                </div>
                <div className="text-xl font-black text-rose-500">
                  +{safeDetails.avgProfit}%
                </div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center justify-center gap-1">
                  <Activity size={12} /> 平均虧損
                </div>
                <div className="text-xl font-black text-emerald-600">
                  -{safeDetails.avgLoss}%
                </div>
              </div>
            </div>

            {/* AI 評語區 */}
            <div className="p-6 bg-slate-50 flex-1">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Lightbulb size={18} className="text-amber-500 fill-current" />
                  策略建議
                </h4>
                {/* 確保這裡是字串，不是物件 */}
                <p className="text-sm text-slate-600 leading-relaxed text-justify">
                  {typeof analysisResult.summary === 'string' ? analysisResult.summary : '分析資料格式有誤'}
                </p>
              </div>
            </div>

            {/* 底部按鈕 */}
            <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0">
              <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all"
              >
                收下建議
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisModal;