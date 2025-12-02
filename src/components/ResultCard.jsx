import React, { forwardRef } from 'react';
// 先移除可能導致崩潰的外部套件引用，改用基本 HTML 測試
// import { QRCodeSVG } from 'qrcode.react'; 

const ResultCard = forwardRef(({ data }, ref) => {
  // 防呆：如果資料還沒進來，回傳 null 避免崩潰
  if (!data) return <div className="text-white">載入中...</div>;
  
  const { fundName, roi, assets } = data;

  return (
    <div 
      ref={ref} 
      className="fixed left-[-9999px] top-0 w-[400px] bg-slate-800 text-white p-6"
    >
        {/* 簡易版測試介面 */}
        <h1 className="text-2xl font-bold text-sky-400">{fundName}</h1>
        <div className="text-4xl font-bold my-4">
            {roi >= 0 ? '+' : ''}{roi}%
        </div>
        <div>資產: ${assets}</div>
        <div className="mt-4 text-xs text-gray-400">
            (這是安全測試版卡片，如果看到此畫面代表 App 核心沒壞)
        </div>
    </div>
  );
});

export default ResultCard;