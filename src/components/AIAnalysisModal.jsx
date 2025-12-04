// src/components/AIAnalysisModal.jsx
import React from 'react';
import { X, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';

export default function AIAnalysisModal({ isOpen, onClose, isLoading, analysisResult, error }) {
  if (!isOpen) return null;

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
              
              <div className="text-center">
                <p className="text-[10px] text-slate-400">Powered by Google Gemini 2.5 Flash</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}