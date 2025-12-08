// src/components/AIAnalysisModal.jsx
import React from 'react';
import { X, Sparkles, BrainCircuit, Loader2, Share2, Copy, Check } from 'lucide-react';

export default function AIAnalysisModal({ isOpen, onClose, isLoading, analysisResult, error }) {
  if (!isOpen) return null;

// ★★★ 請從這裡開始複製 (邏輯區塊) ★★★
  const [isCopied, setIsCopied] = React.useState(false);

  // 1. 產生分享文字
  const generateShareText = () => {
      if (!analysisResult) return '';
      // 如果 analysisResult 是物件(新版)或字串(舊版)，這裡做相容處理
      const textContent = typeof analysisResult === 'string' 
          ? analysisResult 
          : (analysisResult.summary || '詳細分析請見遊戲畫面');

      const score = (typeof analysisResult === 'object' && analysisResult.score) 
          ? `💯 操作智商：${analysisResult.score} 分\n` : '';

      return `📊 Fund 手遊 - AI 投資診斷書
━━━━━━━━━━━━
${score}━━━━━━━━━━━━
${textContent}

#Fund手遊 #AI投資分析`;
  };

  // 2. LINE 分享功能
  const handleShareToLine = () => {
      const text = generateShareText();
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
      window.open(lineUrl, '_blank');
  };

  // 3. 複製功能
  const handleCopy = async () => {
      const text = generateShareText();
      try {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
          console.error('複製失敗', err);
      }
  };
  // ★★★ 邏輯區塊結束 ★★★

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* 標題列 */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center shrink-0">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Sparkles size={20} className="text-yellow-300" /> 
            AI 戰績分析師
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 內容區 */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
          
          {/* 狀態 1: 載入中 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                <BrainCircuit size={64} className="text-violet-600 animate-pulse relative z-10" />
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                   <Loader2 size={20} className="text-indigo-600 animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <h4 className="font-bold text-slate-800 text-lg">AI 正在讀取您的交易紀錄...</h4>
                <p className="text-slate-500 text-sm">正在分析買賣點位與風險偏好</p>
              </div>
            </div>
          )}

          {/* 狀態 2: 發生錯誤 */}
          {!isLoading && error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-600 font-bold mb-1">分析失敗</p>
              <p className="text-red-400 text-xs">{error}</p>
              <button onClick={onClose} className="mt-3 px-4 py-2 bg-white border border-red-200 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50">關閉</button>
            </div>
          )}

          {/* 狀態 3: 顯示結果 */}
          {!isLoading && !error && analysisResult && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-5 rounded-xl border border-violet-100 shadow-sm">
                 {/* 這裡是 AI 回傳的純文字，我們用 CSS 處理換行 */}
                 <div className="prose prose-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                    {analysisResult}
                 </div>
              </div>
              
{/* ★★★ 替換成這段按鈕區塊 ★★★ */}
              <div className="flex gap-2 pt-2">
                {/* 左邊：複製按鈕 */}
                <button 
                  onClick={handleCopy} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 text-sm"
                >
                  {isCopied ? <Check size={16} className="text-emerald-500"/> : <Copy size={16}/>}
                  {isCopied ? '已複製' : '複製'}
                </button>

                {/* 右邊：LINE 分享按鈕 */}
                <button 
                  onClick={handleShareToLine} 
                  className="flex-[2] py-3 bg-[#06C755] hover:bg-[#05b54d] text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Share2 size={18} />
                  LINE 收藏建議
                </button>
              </div>

              <div className="text-center mt-2">
                <p className="text-[10px] text-slate-400">Powered by Google Gemini 2.5 Flash</p>
              </div>            </div>
          )}
        </div>

      </div>
    </div>
  );
}