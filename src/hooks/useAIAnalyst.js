import { useState } from 'react';

// --- 內部小工具：計算均線 (與主程式邏輯一致) ---
const calcMA = (data, day, period) => {
    if (!data || day < period) return null;
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[day - i]?.nav || 0;
    }
    return sum / period;
};

// --- 本地模擬分析產生器 (技術分析增強版) ---
const generateLocalAnalysisData = (gameData) => {
    const { roi, nickname, fundName, transactions, historyData } = gameData;
    
    // 1. 基礎數據計算
    const totalTrades = transactions ? transactions.length : 0;
    const winTrades = transactions ? transactions.filter(t => t.pnl > 0).length : 0;
    const sellTrades = transactions ? transactions.filter(t => t.type === 'SELL').length : 0;
    const winRate = sellTrades > 0 ? Math.round((winTrades / sellTrades) * 100) : 0;

    // 2. ★★★ 技術面深度分析 (Technical Analysis) ★★★
    let technicalComment = "";
    let goodMoves = 0; // 計算好操作次數 (加分用)

    if (historyData && transactions && transactions.length > 0) {
        let trendFollowCount = 0;
        let counterTrendCount = 0;
        let goldenCrossBuy = 0;

        transactions.forEach(tx => {
            const day = tx.day;
            const ma20 = calcMA(historyData, day, 20);
            const ma60 = calcMA(historyData, day, 60);
            
            // 判斷買進時機
            if (tx.type === 'BUY' && ma20 && ma60) {
                // 順勢交易 (月線 > 季線)
                if (ma20 > ma60) {
                    trendFollowCount++;
                    // 檢查是否剛好在黃金交叉附近 (5天內)
                    const prev5_ma20 = calcMA(historyData, day - 5, 20);
                    const prev5_ma60 = calcMA(historyData, day - 5, 60);
                    if (prev5_ma20 <= prev5_ma60) {
                        goldenCrossBuy++; // 抓到起漲點
                        goodMoves++;
                    }
                } else {
                    counterTrendCount++; // 逆勢抄底
                }
            }
            // 判斷賣出時機
            if (tx.type === 'SELL' && ma20 && ma60) {
                // 聰明停利 (乖離過大或趨勢轉弱)
                if (tx.pnl > 0) goodMoves++;
            }
        });

        // 根據數據生成「技術評語」
        if (goldenCrossBuy > 0) {
            technicalComment = `最讓我驚豔的是，你有 ${goldenCrossBuy} 次買進剛好抓到「黃金交叉」的起漲點，這絕對是高手的盤感！`;
        } else if (trendFollowCount > counterTrendCount) {
            technicalComment = "你的操作風格偏向「順勢交易」，喜歡在多頭排列時進場，這是勝率最高的穩健打法。";
        } else if (counterTrendCount > 0) {
            technicalComment = "你似乎偏愛「左側交易」，喜歡在空頭排列時逆勢抄底。雖然風險高，但只要抓對一次就是暴利。";
        }
    }

    // 3. 計算「操作智商」 (加入技術面加權)
    let iqScore = 80 + Math.floor(roi * 1.5) + Math.floor((winRate - 50) * 0.5) + (goodMoves * 2);
    if (iqScore > 150) iqScore = 150;
    if (iqScore < 60) iqScore = 60;

    // 4. 定義評語模組
    let title, summary, styleComment, keyMove, advice;

    // --- 情境判斷 ---
    if (roi >= 20) {
        title = "👑 投資之神降臨";
        styleComment = "你簡直是「多頭市場的幸運兒」，敢在低點佈局並抱得住，這心臟不是普通的大啊！";
        keyMove = technicalComment || `最精彩的是你在交易中展現了絕佳的耐心，${winRate}% 的勝率證明了你不是靠運氣。`;
        advice = "下次遇到震盪時，記得適度獲利了結，別讓紙上富貴飛走了。保留現金等待下一次黑天鵝。";
    } else if (roi > 0) {
        title = "🚀 穩健獲利的贏家";
        styleComment = "你的風格屬於「穩健防守型」。雖然沒有暴利，但在這波動盪的市場中能全身而退，已經贏過 80% 的人了。";
        keyMove = technicalComment || `你的操作頻率${totalTrades > 10 ? '頗高，屬於積極換股的操作' : '偏低，展現了波段持有的定力'}，成功守住了正報酬。`;
        advice = "可以嘗試在趨勢明確時放大部位，別太早下車。複利是你最好的朋友，繼續保持這份紀律！";
    } else if (roi > -10) {
        title = "🛡️ 稍遇亂流的戰士";
        styleComment = "運氣稍微差了一點，或者是在盤整區間被磨掉了耐心。你的操作邏輯沒大問題，只是進場點位稍嫌急躁。";
        keyMove = technicalComment || `在市場下跌時你似乎${totalTrades > 5 ? '試圖頻繁抄底' : '沒有及時停損'}，導致了輕微的虧損。`;
        advice = "別灰心，這點學費很值得。下次試著多看少做，等待均線黃金交叉確認後再進場，勝率會大幅提升。";
    } else {
        title = "❤️ 需要秀秀的韭菜";
        styleComment = "這波市場對你太殘酷了...你看起來像是「逆勢攤平」的信徒，但在空頭趨勢中接刀子是很危險的。";
        keyMove = technicalComment || "關鍵敗筆可能在於沒有嚴格執行停損，或者是一次性 All In 了所有資金，導致沒有加碼的空間。";
        advice = "先休息一下吧！市場永遠都在。下次記得：本金第一，獲利第二。嚴格設定停損點，別讓情緒主導交易。";
    }

    summary = `嘿！${nickname || '操盤手'}，我看了一下你在「${fundName}」的操作：

1. **風格點評**：${styleComment}
2. **關鍵操作**：${keyMove}
3. **暖心建議**：${advice}
4. **操作智商**：${iqScore} 分

(此為 AI 導師模擬覆盤分析)`;

    return {
        title, 
        score: iqScore, 
        summary,
        details: {
            winRate,
            maxDrawdown: (Math.random() * 15 + 5).toFixed(1),
            avgProfit: (Math.random() * 5 + 2).toFixed(1),
            avgLoss: (Math.random() * 5 + 2).toFixed(1)
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

    // 模擬 AI 思考時間
    setTimeout(() => {
        try {
            const result = generateLocalAnalysisData(gameData);
            setAnalysisResult(result);
        } catch (err) {
            console.error("AI Generation Error:", err);
            setError("生成分析報告時發生錯誤。");
        } finally {
            setIsAnalyzing(false);
        }
    }, 2000);
  };

  const closeModal = () => setShowModal(false);

  return { analyzeGame, isAnalyzing, showModal, closeModal, analysisResult, error };
};