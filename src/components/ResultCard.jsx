import React, { forwardRef } from 'react';
import { Trophy, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ★★★ 請將您的 Logo 轉成 Base64 後貼在這裡 ★★★
// 為了避免黑屏，我們使用 Base64，這樣就完全不會有跨域 (CORS) 問題
const LOGO_BASE64 = "**data:image/jpeg;base64,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"; // <--- 請替換成您真正的 Logo Base64

const ResultCard = forwardRef(({ data }, ref) => {
  if (!data) return null;
  
  const { 
    fundName, 
    roi, 
    assets, 
    nickname, 
    gameType, 
    dateRange 
  } = data;

  const isWin = roi >= 0;
  
  let startDate = "---";
  let endDate = "---";
  if (dateRange && dateRange.includes('~')) {
      const parts = dateRange.split('~');
      startDate = parts[0].trim();
      endDate = parts[1].trim();
  } else {
      startDate = dateRange;
  }

  return (
    <div 
      ref={ref} 
      className="fixed left-[-9999px] top-0 w-[420px] font-sans overflow-hidden text-white"
      style={{ 
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
          borderRadius: '24px' 
      }}
    >
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 flex justify-between items-start p-6 border-b border-white/10">
            <div>
                <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs tracking-wider mb-2 uppercase">
                    <Trophy size={14} /> FUND 手遊戰報
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-md max-w-[240px]">
                    {fundName}
                </h2>
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-white/10 text-[10px] text-blue-200 border border-white/10">
                    {gameType === 'Multiplayer' || gameType === '多人對戰' ? '現場競技' : gameType}
                </span>
            </div>
            
            <div className="bg-white p-2 rounded-lg shadow-lg flex items-center justify-center w-24 h-12">
                {/* ★★★ 修改重點：直接使用 Base64，不讀取外部檔案 ★★★ */}
                <img 
                    src={LOGO_BASE64} 
                    alt="Logo" 
                    className="w-full h-full object-contain" 
                    // crossOrigin 屬性在 Base64 模式下不需要，移除它
                />
            </div>
        </div>

        <div className="relative z-10 p-6 text-center pb-2">
            <div className="text-sm text-blue-200 uppercase tracking-widest mb-1 font-bold">總報酬率 (ROI)</div>
            <div className={`text-7xl font-black font-mono flex items-center justify-center gap-1 drop-shadow-xl ${isWin ? 'text-red-400' : 'text-emerald-400'}`}>
                {isWin ? <ArrowUpRight size={56} strokeWidth={3} /> : <ArrowDownRight size={56} strokeWidth={3} />}
                {isWin ? '+' : ''}{roi.toFixed(2)}<span className="text-3xl mt-6">%</span>
            </div>
        </div>

        <div className="relative z-10 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">最終資產</div>
                    <div className="text-3xl font-mono font-bold text-white tracking-tight">
                        ${assets.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                        <Calendar size={12}/> 真實歷史區間
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 scale-90 origin-left">起始</span>
                            <span className="font-mono font-bold text-white">{startDate}</span>
                        </div>
                        <div className="w-full h-px bg-white/10"></div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 scale-90 origin-left">結束</span>
                            <span className="font-mono font-bold text-white">{endDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="relative z-10 bg-white text-slate-900 mx-6 mb-8 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
            <div className="flex flex-col border-l-4 border-blue-600 pl-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Player</span>
                <span className="text-xl font-black text-slate-800 truncate max-w-[150px]">{nickname || '匿名玩家'}</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">FUND GAME V32</span>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                    <span className="text-[8px] font-bold text-slate-400 uppercase text-right leading-tight">Scan to<br/>Challenge</span>
                </div>
                <div className="bg-white p-1 rounded">
                    {/* 這裡保留 SVG，因為它是在客戶端生成的，不會有跨域問題 */}
                     <QRCodeSVG value="https://fund-game-url.com" size={56} />
                </div>
            </div>
        </div>
    </div>
  );
});

export default ResultCard;