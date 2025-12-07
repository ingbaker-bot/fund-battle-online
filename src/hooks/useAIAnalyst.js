// 檔案位置: src/hooks/useAIAnalyst.js
import { useState } from 'react';

// 本地模擬分析產生器
const generateLocalAnalysisData = (gameData) => {
    const { roi, nickname, fundName, transactions } = gameData;
    const winRate = transactions && transactions.length > 0 
        ? Math.round((transactions.filter(t => t.pnl > 0).length / transactions.filter(t => t.type === 'SELL').length) * 100) || 0 
        : 0;
    
    let title, summary, score;
    const positiveComments = ["簡直是交易天才！", "這波操作行雲流水。", "大盤都被你甩在後頭了。"];
    const negativeComments = ["別灰心，市場是殘酷的。", "這筆學費繳得有點貴啊。", "下次試著多看少做？"];

    if (roi >= 20) {
        title = "👑 投資之神降臨";
        score = 95 + Math.floor(Math.random() * 5);
        summary = `嘿 ${nickname}！你在「${fundName}」的表現簡直不可思議！ROI 高達 ${roi.toFixed(2)}%，${positiveComments[0]} 你的進出場點位抓得非常精準。`;
    } else if (roi > 0) {
        title = "🚀 穩健獲利的贏家";
        score = 80 + Math.floor(Math.random() * 15);
        summary = `不錯喔 ${nickname}，在「${fundName}」這場戰役中，你守住了獲利，最終成績 ${roi.toFixed(2)}%。穩健才是長久生存之道，勝率約為 ${winRate}%。`;
    } else {
        title = "❤️ 需要秀秀的韭菜";
        score = 40 + Math.floor(Math.random() * 20);
        summary = `沒事的 ${nickname}，失敗為成功之母。這次在「${fundName}」跌了 ${roi.toFixed(2)}%，${negativeComments[0]} 記得檢討是否追高殺低？`;
    }

    return {
        title, score, summary,
        details: {
            winRate,
            maxDrawdown: (Math.random() * 15 + 5).toFixed(1),
            avgProfit: (Math.random() * 5 + 2).toFixed(1),
            avgLoss: (Math.random() * 5 + 2).toFixed(1)
        }
    };
};

// 給 AppBattle 用的 helper
export const generateAIAnalysis = (transactions, historyData, initialCapital, finalAssets) => {
    const roi = initialCapital > 0 ? ((finalAssets - initialCapital) / initialCapital) * 100 : 0;
    return generateLocalAnalysisData({
        roi, nickname: '玩家', fundName: '本場基金', transactions: transactions 
    });
};

// 主要 Hook
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

    // 模擬延遲
    setTimeout(() => {
        try {
            const result = generateLocalAnalysisData(gameData);
            setAnalysisResult(result);
        } catch (err) {
            console.error(err);
            setError("生成分析報告時發生錯誤。");
        } finally {
            setIsAnalyzing(false);
        }
    }, 1500);
  };

  const closeModal = () => setShowModal(false);

  return { analyzeGame, isAnalyzing, showModal, closeModal, analysisResult, error };
};