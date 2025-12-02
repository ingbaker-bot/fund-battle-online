import React, { forwardRef } from 'react';
import { Trophy, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Globe } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const ResultCard = forwardRef(({ data }, ref) => {
  if (!data) return null;
  
  const { 
    fundName, 
    roi, 
    assets, 
    nickname, 
    gameType, 
    // 我們假設傳入的 dateRange 格式可能是 "YYYY-MM-DD ~ YYYY-MM-DD"
    // 這裡做個簡單處理，如果格式不符直接顯示原字串
    dateRange 
  } = data;

  const isWin = roi >= 0;
  
  // 解析日期字串 (假設傳入格式為 "YYYY-MM-DD~YYYY-MM-DD" 或類似)
  // 如果您在 parent component 傳入的是兩個變數會更好，這裡先做字串分割相容
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
          // A. 修正底色：改為深藍漸層 (象徵獲利/專業)，不再是死黑
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
          borderRadius: '24px' // 導圓角
      }}
    >
        {/* 背景裝飾光暈 */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>

        {/* 頂部 Header */}
        <div className="relative z-10 flex justify-between items-start p-6 border-b border-white/10">
            <div>
                <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs tracking-wider mb-2 uppercase">
                    <Trophy size={14} /> FUND 手遊戰報
                </div>
                {/* 基金名稱 */}
                <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-md max-w-[240px]">
                    {fundName}
                </h2>
                {/* D. 修正翻譯：Live Battle -> 現場競技 / 個人挑戰 */}
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-white/10 text-[10px] text-blue-200 border border-white/10">
                    {gameType === 'Multiplayer' || gameType === '多人對戰' ? '現場競技' : gameType}
                </span>
            </div>
            
            {/* B. 修正 Logo：移除 rounded-full，改為長方形自適應 */}
            <div className="bg-white p-2 rounded-lg shadow-lg flex items-center justify-center w-24 h-12">
                {/* 請確認圖片路徑正確，並確保伺服器允許 CORS */}
                <img 
                    src="/logo.jpg" 
                    alt="Logo" 
                    className="w-full h-full object-contain" 
                    crossOrigin="anonymous" // 嘗試解決跨域問題
                />
            </div>
        </div>

        {/* 核心數據區 (ROI) */}
        <div className="relative z-10 p-6 text-center pb-2">
            <div className="text-sm text-blue-200 uppercase tracking-widest mb-1 font-bold">總報酬率 (ROI)</div>
            {/* C. 字體放大：text-6xl -> text-7xl */}
            <div className={`text-7xl font-black font-mono flex items-center justify-center gap-1 drop-shadow-xl ${isWin ? 'text-red-400' : 'text-emerald-400'}`}>
                {isWin ? <ArrowUpRight size={56} strokeWidth={3} /> : <ArrowDownRight size={56} strokeWidth={3} />}
                {isWin ? '+' : ''}{roi.toFixed(2)}<span className="text-3xl mt-6">%</span>
            </div>
        </div>

        {/* 詳細數據 Grid */}
        <div className="relative z-10 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                {/* 左側：最終資產 */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">最終資產</div>
                    {/* C. 字體放大：text-xl -> text-2xl */}
                    <div className="text-3xl font-mono font-bold text-white tracking-tight">
                        ${assets.toLocaleString()}
                    </div>
                </div>

                {/* 右側：真實歷史區間 (E. 改為上下兩行) */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    {/* C. 字體放大 / 修正 Label名稱 */}
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center gap-1">
                        <Calendar size={12}/> 真實歷史區間
                    </div>
                    {/* E. 日期分兩行顯示 */}
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

        {/* 底部 Footer & QRCode */}
        {/* F. 增加底部 Padding (pb-8) 與右側間距，避開 iPhone 辨識按鈕 */}
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
                {/* QR Code 區域 */}
                <div className="bg-white p-1 rounded">
                     <QRCodeSVG value="https://fund-game-url.com" size={56} />
                </div>
            </div>
        </div>
    </div>
  );
});

export default ResultCard;