// 檔案位置: src/components/AIAnalysisModal.jsx
import React from 'react';
import { 
  X, Sparkles, Trophy, TrendingUp, TrendingDown, 
  Activity, Target, Lightbulb, Loader2 
} from 'lucide-react';

const AIAnalysisModal = ({ isOpen, onClose, isLoading, analysisResult, error }) => {
  // 1. 如果沒開，不渲染
  if (!isOpen) return null;

  // 2. 安全檢查：防止 details 為空導致錯誤
  // 如果 analysisResult 是字串(舊版單機可能發生)，則轉為預設物件避免崩潰
  const isStringResult = typeof analysisResult === 'string';
  
  const safeDetails = (analysisResult && !isStringResult && analysisResult.details) ? analysisResult.details : {
      winRate: 0, maxDrawdown: 0, avgProfit: 0, avgLoss: 0
  };

  const displayScore = (analysisResult && !isStringResult) ? analysisResult.score : 0;
  const displayTitle = (analysisResult && !isStringResult) ? analysisResult.title : '分析完成';
  const displaySummary = isStringResult ? analysisResult : (analysisResult?.summary || '無分析資料');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 視窗本體 */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* 載入中 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
            <Loader2 size={48} className="text-violet-600 animate-spin" />
            <h3 className="text-xl font-bold text-slate-800">AI 導師正在分析...</h3>
          </div>
        )}

        {/* 錯誤 */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Activity size={32} className="text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">分析失敗</h3>
            <p className="text-sm text-slate-500 mb-6">{typeof error === 'object' ? '發生未知錯誤' : error}</p>
            <button onClick={onClose} className="px-6 py-2 bg-slate-100 rounded-lg font-bold">關閉</button>
          </div>
        )}

        {/* 結果顯示 */}
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
                
                {!isStringResult && (
                  <div className="flex items-baseline justify-center gap-1 mb-1">
                    <span className="text-6xl font-black tracking-tighter drop-shadow-xl">{displayScore}</span>
                    <span className="text-xl opacity-80 font-bold">分</span>
                  </div>
                )}
                
                <h2 className="text-lg font-bold text-white/90">{displayTitle}</h2>
              </div>
            </div>

            {/* 數據儀表板 (若是舊版字串格式則隱藏) */}
            {!isStringResult && (
              <>
                <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-white">
                  <div className="p-4 text-center">
                    <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex justify-center gap-1"><Target size={12}/> 勝率</div>
                    <div className="text-xl font-black text-slate-700">{safeDetails.winRate}%</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-xs text-slate-400 font-bold uppercase mb-1 flex justify-center gap-1"><TrendingDown size={12}/> 最大回撤</div>
                    <div className="text-xl font-black text-emerald-600">-{safeDetails.maxDrawdown}%</div>
                  </div>
                </div>
              </>
            )}

            {/* AI 評語區 */}
            <div className="p-6 bg-slate-50 flex-1">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Lightbulb size={18} className="text-amber-500 fill-current" />
                  策略建議
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed text-justify whitespace-pre-line">
                  {displaySummary}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0">
              <button onClick={onClose} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition-all">
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