\// src/hooks/useAIAnalyst.js
import { useState } from 'react';

// 這是內建的 AI 評語庫，不需要後端也能運作
const generateLocalAnalysis = (gameData) => {
    const { roi, nickname, fundName, transactions } = gameData;
    const winRate = transactions && transactions.length > 0 
        ? Math.round((transactions.filter(t => t.pnl > 0).length / transactions.filter(t => t.type === 'SELL').length) * 100) || 0 
        : 0;
    
    // 根據 ROI 給出不同的評價風格
    let title, summary, score;
    const positiveComments = [
        "簡直是交易天才！", "這波操作行雲流水。", "大盤都被你甩在後頭了。", "請收下我的膝蓋。"
    ];
    const negativeComments = [
        "別灰心，市場是殘酷的。", "下次試著多看少做？", "這筆學費繳得有點貴啊。", "也許定期定額更適合你？"
    ];

    if (roi >= 20) {
        title = "👑 投資之神降臨";
        score = 95 + Math.floor(Math.random() * 5);
        summary = `嘿 ${nickname}！你在「${fundName}」的表現簡直不可思議！ROI 高達 ${roi.toFixed(2)}%，${positiveComments[Math.floor(Math.random()*positiveComments.length)]} 你的進出場點位抓得非常精準，這種盤感不是每個人都有的。建議你保持這種節奏，但也要小心市場過熱時的回調風險。`;
    } else if (roi > 0) {
        title = "🚀 穩健獲利的贏家";
        score = 80 + Math.floor(Math.random() * 15);
        summary = `不錯喔 ${nickname}，在「${fundName}」這場戰役中，你守住了獲利，最終成績 ${roi.toFixed(2)}%。雖然沒有一夜暴富，但穩健才是長久生存之道。你的勝率約為 ${winRate}%，這顯示你的決策是經過深思熟慮的。繼續保持，複利會是你最好的朋友！`;
    } else if (roi > -10) {
        title = "🛡️ 稍遇亂流的戰士";
        score = 60 + Math.floor(Math.random() * 20);
        summary = `辛苦了 ${nickname}。這次在「${fundName}」小虧 ${roi.toFixed(2)}%，算是輕傷。市場波動在所難免，重點是你沒有在恐慌中把子彈打光。我觀察到你的某些交易可能過於頻繁，下次試著拉長持有時間，或許會有意想不到的收穫。`;
    } else {
        title = "❤️ 需要秀秀的韭菜";
        score = 40 + Math.floor(Math.random() * 20);
        summary = `沒事的 ${nickname}，失敗為成功之母。這次在「${fundName}」雖然跌了 ${roi.toFixed(2)}%，但這也是寶貴的經驗。${negativeComments[Math.floor(Math.random()*negativeComments.length)]} 記得檢討一下是否在追高殺低？或者是沒有嚴格執行停損？休息一下，整理心情再出發！`;
    }

    return {
        success: true,
        analysis: {
            title: title,
            score: score,
            summary: summary,
            details: {
                winRate: winRate, // 勝率
                maxDrawdown: (Math.random() * 15 + 5).toFixed(1), // 模擬最大回撤
                avgProfit: (Math.random() * 5 + 2).toFixed(1),    // 模擬平均獲利
                avgLoss: (Math.random() * 5 + 2).toFixed(1)       // 模擬平均虧損
            }
        }
    };
};

export const useAIAnalyst = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  const analyzeGame = async (gameData) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setShowModal(true);

    console.log("正在啟動 AI 分析 (前端模擬模式)...", gameData);

    // 模擬 AI 思考時間 (1.5秒 ~ 2.5秒)，增加真實感
    setTimeout(() => {
        try {
            // 直接呼叫本地生成邏輯，不走 API，確保 100% 成功
            const result = generateLocalAnalysis(gameData);
            
            if (result.success) {
                setAnalysisResult(result.analysis);
            } else {
                setError("AI 暫時無法回應，請稍後再試。");
            }
        } catch (err) {
            console.error("AI Generation Error:", err);
            setError("生成分析報告時發生錯誤。");
        } finally {
            setIsAnalyzing(false);
        }
    }, 2000);
  };

  // 生成 AI 分析報告 (給 AppBattle 直接呼叫用)
  const generateAIAnalysis = (transactions, historyData, initialCapital, finalAssets) => {
      // 這裡可以放更複雜的邏輯，目前先簡單回傳結構
      // 為了配合 AppBattle 的 useEffect 邏輯
      const roi = ((finalAssets - initialCapital) / initialCapital) * 100;
      return generateLocalAnalysis({
          roi, 
          nickname: '玩家', 
          fundName: '本場基金', 
          transactions: transactions 
      }).analysis;
  };

  const closeModal = () => setShowModal(false);

  return {
    analyzeGame,
    generateAIAnalysis, // 匯出這個函數供 AppBattle 結算時自動調用
    isAnalyzing,
    showModal,
    closeModal,
    analysisResult,
    error
  };
};