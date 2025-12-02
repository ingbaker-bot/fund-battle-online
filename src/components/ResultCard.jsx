import React, { forwardRef } from 'react';
import { Trophy, Calendar, ArrowUpRight, ArrowDownRight, User } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ★★★ 請在此填入您的 Logo Base64 字串 (data:image/png;base64.....) ★★★
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
  
  // E. 日期處理：拆分成兩行
  let startDate = "---";
  let endDate = "---";
  if (dateRange && dateRange.includes('~')) {
      const parts = dateRange.split('~');
      startDate = parts[0].trim();
      endDate = parts[1].trim();
  } else {
      startDate = dateRange;
  }

  // D. 翻譯對照
  const typeMap = {
      'Multiplayer': '多人對戰',
      'Live Battle': '現場競技',
      'Single': '個人挑戰',
      'Ranked': '排名挑戰'
  };
  const displayType = typeMap[gameType] || gameType || '個人挑戰';

  return (
    <div 
      ref={ref} 
      className="fixed left-[-9999px] top-0 w-[420px] font-sans overflow-hidden text-white"
      style={{ 
          // A. 視覺升級：深邃科技藍漸層，象徵專業與穩重
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '0px' 
      }}
    >
        {/* 背景裝飾：象徵獲利的綠光 */}
        <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[80px]"></div>
        
        {/* 頂部 Header */}
        <div className="relative z-10 flex justify-between items-start p-8 pb-4">
            <div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm tracking-wider mb-2 uppercase">
                    <Trophy size={16} /> FUND 手遊戰報
                </div>
                {/* 基金名稱 */}
                <h2 className="text-3xl font-black text-white leading-tight drop-shadow-md max-w-[220px]">
                    {fundName}
                </h2>
                <span className="inline-block mt-3 px-3 py-1 rounded-full bg-slate-700/50 text-xs text-slate-300 border border-slate-600">
                    {displayType}
                </span>
            </div>
            
            {/* B. Logo 修正：長方形容器，完整顯示 */}
            <div className="bg-white/95 p-2 rounded-lg shadow-lg flex items-center justify-center w-28 h-14">
                {LOGO_BASE64 ? (
                    <img src={LOGO_BASE64} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                    <span className="text-slate-900 text-xs font-bold">LOGO</span>
                )}
            </div>
        </div>

        <div className="w-full h-px bg-slate-700/50 mx-auto w-[90%]"></div>

        {/* 核心數據區 (ROI) */}
        <div className="relative z-10 p-6 text-center">
            <div className="text-sm text-slate-400 uppercase tracking-widest mb-2 font-bold">總報酬率 (ROI)</div>
            {/* C. 字體放大：超大字體顯示戰績 */}
            <div className={`text-7xl font-black font-mono flex items-center justify-center gap-2 drop-shadow-2xl ${isWin ? 'text-red-500' : 'text-emerald-500'}`}>
                {isWin ? <ArrowUpRight size={64} strokeWidth={4} /> : <ArrowDownRight size={64} strokeWidth={4} />}
                <span>{roi > 0 ? '+' : ''}{roi.toFixed(2)}</span>
                <span className="text-3xl mt-8">%</span>
            </div>
        </div>

        {/* 詳細數據 Grid */}
        <div className="relative z-10 px-8 py-2">
            <div className="grid grid-cols-2 gap-4">
                {/* 左側：最終資產 */}
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col justify-center text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">最終資產</div>
                    {/* C. 字體放大 */}
                    <div className="text-2xl font-mono font-bold text-white tracking-tight">
                        ${assets.toLocaleString()}
                    </div>
                </div>

                {/* 右側：真實歷史區間 */}
                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-2 flex items-center justify-center gap-1">
                        <Calendar size={12}/> 真實歷史區間
                    </div>
                    {/* E. 日期分兩行顯示 */}
                    <div className="flex flex-col gap-1 items-center">
                        <span className="font-mono font-bold text-sm text-white">{startDate}</span>
                        <div className="w-12 h-px bg-slate-600 my-0.5"></div>
                        <span className="font-mono font-bold text-sm text-white">{endDate}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 底部 Footer & QRCode */}
        {/* F. 增加底部 Padding (pb-10) */}
        <div className="relative z-10 mt-6 bg-white text-slate-900 p-6 pb-10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex items-center justify-between">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                    <div className="bg-slate-900 p-1.5 rounded-full text-white">
                        <User size={16} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Player</span>
                </div>
                <span className="text-2xl font-black text-slate-900 truncate max-w-[180px]">{nickname || '匿名玩家'}</span>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-800 uppercase text-right leading-tight">SCAN TO<br/>PLAY</span>
                </div>
                <div className="border-2 border-slate-900 p-1 rounded-lg">
                     <QRCodeSVG value="https://fund-game-url.com" size={60} />
                </div>
            </div>
        </div>
    </div>
  );
});

export default ResultCard;