// src/components/ResultCard.jsx
// 2025v9.9 - 視覺優化版 (天空藍/大字體/QR修正)
import React, { forwardRef } from 'react';
import { Trophy, Calendar, ArrowUpRight, ArrowDownRight, User, TrendingUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ★★★ 請在此填入您的 Logo Base64 字串 ★★★
// 如果沒有填入，系統會自動顯示文字標題，不會破圖
const LOGO_BASE64 = ""; 

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
  
  // 日期處理：拆分成兩行
  let startDate = "---";
  let endDate = "---";
  if (dateRange && dateRange.includes('~')) {
      const parts = dateRange.split('~');
      startDate = parts[0].trim();
      endDate = parts[1].trim();
  } else {
      startDate = dateRange;
  }

  // 翻譯對照
  const typeMap = {
      'Multiplayer': '多人對戰',
      'Live Battle': '現場競技',
      'Single': '個人挑戰',
      'Ranked': '排名挑戰'
  };
  const displayType = typeMap[gameType] || gameType || '個人挑戰';

  // QR Code 設定：指向您的正式網址
  const QR_URL = "https://fund-battle-online.vercel.app/";

  return (
    <div 
      ref={ref} 
      // 設定固定寬度與背景色
      className="fixed left-[-9999px] top-0 w-[420px] font-sans overflow-hidden text-slate-800"
      style={{ 
          // E. 底色改為天空藍漸層，表達快樂、正向的投資心情
          background: 'linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 100%)', // sky-100 to sky-300
          borderRadius: '0px' 
      }}
    >
        {/* 背景裝飾：白色的雲朵光暈感 */}
        <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-white/40 rounded-full blur-[60px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-white/30 rounded-full blur-[50px]"></div>
        
        {/* 頂部 Header */}
        <div className="relative z-10 flex justify-between items-start p-8 pb-2">
            <div>
                <div className="flex items-center gap-2 text-blue-600 font-black text-sm tracking-wider mb-2 uppercase">
                    <Trophy size={16} /> FUND 手遊戰報
                </div>
                {/* 基金名稱 */}
                <h2 className="text-3xl font-black text-slate-900 leading-tight drop-shadow-sm max-w-[240px]">
                    {fundName}
                </h2>
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-white/60 text-xs font-bold text-blue-800 border border-white/50 shadow-sm">
                    {displayType}
                </span>
            </div>
            
            {/* A. Logo 區域：如果沒圖，顯示 icon */}
            <div className="bg-white/80 p-2 rounded-xl shadow-sm flex items-center justify-center w-24 h-14 backdrop-blur-sm">
                {LOGO_BASE64 ? (
                    <img src={LOGO_BASE64} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                    <div className="flex flex-col items-center justify-center text-blue-600">
                        <TrendingUp size={24} />
                        <span className="text-[8px] font-bold">NBS FUND</span>
                    </div>
                )}
            </div>
        </div>

        <div className="w-[90%] h-px bg-slate-400/20 mx-auto my-2"></div>

        {/* 核心數據區 (ROI) */}
        <div className="relative z-10 p-4 text-center">
            <div className="text-sm text-slate-500 uppercase tracking-widest mb-1 font-bold">總報酬率 (ROI)</div>
            
            {/* b. 報酬率縮小 1/2 (改為 text-5xl) */}
            <div className={`text-5xl font-black font-mono flex items-center justify-center gap-2 drop-shadow-sm ${isWin ? 'text-red-600' : 'text-emerald-600'}`}>
                {isWin ? <ArrowUpRight size={48} strokeWidth={4} /> : <ArrowDownRight size={48} strokeWidth={4} />}
                <span>{roi > 0 ? '+' : ''}{roi.toFixed(2)}</span>
                <span className="text-2xl mt-4">%</span>
            </div>
        </div>

        {/* 詳細數據 Grid */}
        <div className="relative z-10 px-6 py-4">
            <div className="grid grid-cols-2 gap-4">
                {/* 左側：最終資產 */}
                <div className="bg-white/60 p-4 rounded-2xl border border-white/50 flex flex-col justify-center text-center shadow-sm backdrop-blur-md">
                    {/* c. 標題放大 1倍 (text-sm) */}
                    <div className="text-sm text-slate-500 font-bold mb-1">最終資產</div>
                    <div className="text-2xl font-mono font-black text-slate-800 tracking-tight">
                        ${assets.toLocaleString()}
                    </div>
                </div>

                {/* 右側：真實歷史區間 */}
                <div className="bg-white/60 p-4 rounded-2xl border border-white/50 shadow-sm backdrop-blur-md">
                    {/* c. 標題放大 1倍 (text-sm) */}
                    <div className="text-sm text-slate-500 font-bold mb-2 flex items-center justify-center gap-1">
                        <Calendar size={14}/> 真實歷史區間
                    </div>
                    {/* 日期分兩行顯示 */}
                    <div className="flex flex-col gap-1 items-center">
                        <span className="font-mono font-bold text-sm text-slate-700">{startDate}</span>
                        <div className="w-8 h-px bg-slate-300 my-0.5"></div>
                        <span className="font-mono font-bold text-sm text-slate-700">{endDate}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 底部 Footer & QRCode */}
        {/* 增加底部空間，確保不被手機 UI 遮擋 */}
        <div className="relative z-10 mt-4 bg-white text-slate-900 px-6 py-5 pb-8 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col gap-1 flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1">
                    <div className="bg-blue-100 p-1.5 rounded-full text-blue-600">
                        <User size={16} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Player</span>
                </div>
                {/* 玩家名稱：加大字體並允許換行，解決遮擋問題 */}
                <span className="text-2xl font-black text-slate-800 break-words leading-tight">
                    {nickname || '匿名玩家'}
                </span>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase text-right leading-tight">SCAN TO<br/>PLAY</span>
                </div>
                {/* d. QR Code 修正連結 */}
                <div className="bg-white border-2 border-slate-100 p-1 rounded-lg">
                     <QRCodeSVG value={QR_URL} size={64} fgColor="#0f172a"/>
                </div>
            </div>
        </div>
        
        {/* 底部裝飾條 */}
        <div className="h-2 w-full bg-gradient-to-r from-blue-400 to-sky-300"></div>
    </div>
  );
});

export default ResultCard;