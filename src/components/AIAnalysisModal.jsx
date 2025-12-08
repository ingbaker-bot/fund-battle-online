import React, { useState } from 'react';
import { 
  X, Sparkles, Trophy, TrendingUp, TrendingDown, 
  Activity, Target, Lightbulb, Loader2, 
  Share2, Copy, Check // 新增這三個圖示
} from 'lucide-react';

const AIAnalysisModal = ({ isOpen, onClose, isLoading, analysisResult, error }) => {
  const [isCopied, setIsCopied] = useState(false);

  // 1. 如果沒開，不渲染
  if (!isOpen) return null;

  // 2. 安全檢查：防止 details 為空導致錯誤
  const isStringResult = typeof analysisResult === 'string';
  
  const safeDetails = (analysisResult && !isStringResult && analysisResult.details) ? analysisResult.details : {
      winRate: 0, maxDrawdown: 0, avgProfit: 0, avgLoss: 0
  };

  const displayScore = (analysisResult && !isStringResult) ? analysisResult.score : 0;
  const displayTitle = (analysisResult && !isStringResult) ? analysisResult.title : '分析完成';
  const displaySummary = isStringResult ? analysisResult : (analysisResult?.summary || '無分析資料');

  // --- 新增功能 A: 產生漂亮的分享文字 ---
  const generateShareText = () => {
      if (!analysisResult) return '';
      // 如果是舊版純文字，直接回傳
      if (isStringResult) return analysisResult;

      // 新版結構化文字
      return `📊 Fund 手遊 - AI 投資診斷書
━━━━━━━━━━━━
👑 評價：${displayTitle}
💯 操作智商：${displayScore} 分
━━━━━━━━━━━━
${displaySummary}

📈 勝率：${safeDetails.winRate}%
📉 最大回撤：-${safeDetails.maxDrawdown}%
💰 平均獲利：+${safeDetails.avgProfit}%

#Fund手遊 #AI投資分析`;
  };

  // --- 新增功能 B: LINE 分享 ---
  const handleShareToLine = () => {
      const text = generateShareText();
      // 使用 LINE URL Scheme 進行分享
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
      window.open(lineUrl, '_blank');
  };

  // --- 新增功能 C: 複製文字 ---
  const handleCopy = async () => {
      const text = generateShareText();
      try {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
          // 2秒後切換回原本圖示
          setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
          console.error('複製失敗', err);
      }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* 視窗本體 */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* 關閉按鈕 */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* 狀態 1: 載入中 */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
            <Loader2 size={48} className="text-violet-600 animate-spin" />
            <h3 className="text-xl font-bold text-slate-800">AI 導師正在分析...</h3>
          </div>
        )}

        {/* 狀態 2: 發生錯誤 */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Activity size={32} className="text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-800">分析失敗</h3>
            <p className="text-sm text-slate-500 mb-6">{typeof error === 'object' ? '發生未知錯誤' : error}</p>
            <button onClick={onClose} className="px-6 py-2 bg-slate-100 rounded-lg font-bold">關閉</button>
          </div>
        )}

        {/* 狀態 3: 結果顯示 (主要修改區) */}
        {!isLoading && !error && analysisResult && (
          <>
            {/* 中間滾動區域 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              
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

              {/* 數據儀表板 */}
              {!isStringResult && (
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
              )}

              {/* AI 評語區 */}
              <div className="p-6 bg-slate-50">
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
            </div>

            {/* ★★★ 底部按鈕區 (修改重點) ★★★ */}
            {/* 改為 Sticky sticky bottom-0，確保按鈕永遠看得到 */}
            <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex gap-2">
                {/* 左邊：複製按鈕 (灰色) */}
                <button 
                  onClick={handleCopy} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {isCopied ? <Check size={18} className="text-emerald-500"/> : <Copy size={18}/>}
                  {isCopied ? '已複製' : '複製'}
                </button>

                {/* 右邊：LINE 分享按鈕 (LINE 綠色) */}
                <button 
                  onClick={handleShareToLine} 
                  className="flex-[2] py-3 bg-[#06C755] hover:bg-[#05b54d] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Share2 size={18} />
                  LINE 收藏建議
                </button>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisModal;