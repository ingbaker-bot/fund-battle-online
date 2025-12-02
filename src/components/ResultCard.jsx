import React, { forwardRef } from 'react';
import { Trophy, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; // 記得確認有無安裝 qrcode.react，若無則 npm install qrcode.react

const ResultCard = forwardRef(({ data }, ref) => {
  if (!data) return null;
  
  const { 
    fundName, 
    roi, 
    assets, 
    duration, 
    nickname, 
    gameType = '個人挑戰賽', // 或 '賽季爭霸戰'
    dateRange 
  } = data;

  const isWin = roi >= 0;

  return (
    <div 
      ref={ref} 
      className="fixed left-[-9999px] top-0 w-[400px] bg-slate-900 text-white p-6 font-sans overflow-hidden"
      // style={{ transform: 'scale(2)' }} // 若圖片模糊可放大倍率
    >
        {/* 背景裝飾 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        {/* 頂部 Header */}
        <div className="relative z-10 flex justify-between items-start mb-6 border-b border-white/10 pb-4">
            <div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm tracking-wider mb-1">
                    <Trophy size={16} /> FUND 手遊戰報
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">{fundName}</h2>
                <span className="text-xs text-slate-400 mt-1 block">{gameType}</span>
            </div>
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full opacity-90"/>
            </div>
        </div>

        {/* 核心數據區 */}
        <div className="relative z-10 mb-6 text-center">
            <div className="text-sm text-slate-400 uppercase tracking-widest mb-2 font-bold">總報酬率 (ROI)</div>
            <div className={`text-6xl font-black font-mono flex items-center justify-center gap-2 ${isWin ? 'text-red-400' : 'text-green-400'}`}>
                {isWin ? <ArrowUpRight size={48} /> : <ArrowDownRight size={48} />}
                {isWin ? '+' : ''}{roi.toFixed(2)}%
            </div>
        </div>

        {/* 詳細數據 Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">最終資產</div>
                <div className="text-xl font-mono font-bold text-white">${assets.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">交易時長</div>
                <div className="text-xl font-bold text-white flex items-center gap-1">
                    <Calendar size={16} className="text-slate-400"/> {duration}
                </div>
            </div>
        </div>

        {/* 底部 Footer & QRCode */}
        <div className="relative z-10 bg-white text-slate-900 rounded-xl p-3 flex items-center justify-between shadow-lg">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Player</span>
                <span className="text-lg font-bold text-slate-800">{nickname || '匿名玩家'}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">{dateRange}</span>
            </div>
            <div className="flex items-center gap-2 pr-1">
                <div className="flex flex-col items-end mr-2">
                    <span className="text-[8px] font-bold text-slate-400 uppercase text-right">Scan to<br/>Challenge</span>
                </div>
                <QRCodeSVG value="https://fund-game-url.com" size={48} />
            </div>
        </div>
    </div>
  );
});

export default ResultCard;