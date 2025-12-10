import { useState } from 'react';

// --- 內部小工具：計算均線 (防呆版) ---
const calcMA = (data, day, period) => {
    // 安全檢查：如果沒有資料，或天數不足，直接回傳 null
    if (!data || !Array.isArray(data) || day < period || !data[day]) return null;
    
    let sum = 0;
    for (let i = 0; i < period; i++) {
        const val = data[day - i]?.nav;
        if (val === undefined || isNaN(val)) return null;
        sum += val;
    }
    return sum / period;
};

// --- AI 核心邏輯：結合技術指標、河流斜率與交易紀錄 ---
const generateLocalAnalysisData = (gameData) => {
    const { roi, nickname, fundName, transactions, historyData = [] } = gameData;
    
    // 1. 基礎數據
    const totalTrades = transactions ? transactions.length : 0;
    const sellTrades = transactions ? transactions.filter(t => t.type === 'SELL').length : 0;
    const winTrades = transactions ? transactions.filter(t => t.pnl > 0).length : 0;
    const winRate = sellTrades > 0 ? Math.round((winTrades / sellTrades) * 100) : 0;

    // 2. ★★★ 深度技術分析 (Technical Analysis Engine) ★★★
    let techAnalysis = {
        trendFollow: 0,   // 順勢操作
        contrarian: 0,    // 逆勢操作
        goldenCross: 0,   // 抓到黃金交叉
        chasingHigh: 0,   // 追高
        perfectExit: 0,   // 漂亮出場
        riverTrend: "不明" // 河流趨勢狀態
    };

    let riverAdvice = ""; // 針對河流趨勢的建議

    try {
        if (historyData && historyData.length > 0) {
            // --- A. 判斷目前的河流斜率 (River Slope) ---
            const lastDayIdx = transactions.length > 0 ? transactions[transactions.length-1].day : historyData.length - 1;
            const ma60_now = calcMA(historyData, lastDayIdx, 60);
            const ma60_prev10 = calcMA(historyData, lastDayIdx - 10, 60);

            if (ma60_now && ma60_prev10) {
                const slope = (ma60_now - ma60_prev10) / ma60_prev10;

                if (slope > 0.005) {
                    techAnalysis.riverTrend = "強勢多頭 🌊";
                    riverAdvice = "目前的河流正強勢向上沖！這時候的策略是「拉回找買點」，股價碰到下緣是天上掉下來的禮物，千萬別輕易做空。";
                } else if (slope > 0) {
                    techAnalysis.riverTrend = "緩步墊高 ↗️";
                    riverAdvice = "河流溫和向上，這是最適合「定期定額」或「波段持有」的時期。不用頻繁進出，抱著就能贏。";
                } else if (slope > -0.005) {
                    techAnalysis.riverTrend = "盤整觀望 ⚖️";
                    riverAdvice = "河流現在是平的，市場失去了方向。這時候適合「區間操作」，碰到上緣賣、碰到下緣買，賺取中間的價差。";
                } else {
                    techAnalysis.riverTrend = "空頭修正 📉";
                    riverAdvice = "警告！河流正在向下俯衝。這時候碰到下緣絕對不是買點，而是「接刀子」。操作上應以「反彈找賣點」或空手觀望為主。";
                }
            }

            // --- B. 分析玩家的操作買點 ---
            if (transactions && transactions.length > 0) {
                transactions.forEach(tx => {
                    const day = tx.day;
                    if (day > 60) {
                        const price = tx.price;
                        const ma20 = calcMA(historyData, day, 20);
                        const ma60 = calcMA(historyData, day, 60);
                        
                        if (ma20 && ma60) {
                            const isBullish = ma20 > ma60;
                            const bias = (price - ma60) / ma60;

                            if (tx.type === 'BUY') {
                                if (isBullish) {
                                    techAnalysis.trendFollow++;
                                    if (bias > 0.1) techAnalysis.chasingHigh++;
                                } else {
                                    techAnalysis.contrarian++;
                                }

                                // 檢查黃金交叉 (前後 7 天)
                                for(let i = 0; i < 7; i++) {
                                    const pMa20 = calcMA(historyData, day - i, 20);
                                    const pMa60 = calcMA(historyData, day - i, 60);
                                    const ppMa20 = calcMA(historyData, day - i - 1, 20);
                                    const ppMa60 = calcMA(historyData, day - i - 1, 60);
                                    if (pMa20 && pMa60 && ppMa20 && ppMa60) {
                                        if (ppMa20 <= ppMa60 && pMa20 > pMa60) {
                                            techAnalysis.goldenCross++;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (tx.type === 'SELL') {
                                if (bias > 0.15 || (tx.pnl / tx.amount) > 0.2) {
                                    techAnalysis.perfectExit++;
                                }
                            }
                        }
                    }
                });
            }
        }
    } catch (err) {
        console.warn("AI 技術分析運算略過:", err);
    }

    // 3. 生成「技術分析」評語
    let keyMoveComment = "";
    
    if (techAnalysis.goldenCross > 0) {
        keyMoveComment = `你的眼光很準！有 ${techAnalysis.goldenCross} 次買進精準抓到了「黃金交叉」的起漲點，這絕對是高手的盤感！`;
    } else if (techAnalysis.chasingHigh > techAnalysis.trendFollow / 2) {
        keyMoveComment = "注意風險！數據顯示你傾向在「乖離過大」時追高，雖然這次可能賺錢，但這像是撿火車前的零錢。";
    } else if (techAnalysis.trendFollow > techAnalysis.contrarian) {
        keyMoveComment = `你是標準的「順勢交易者」，${techAnalysis.trendFollow} 次操作都順著均線趨勢，這是最穩健的獲利方程式。`;
    } else if (techAnalysis.contrarian > 0) {
        keyMoveComment = `你偏愛「左側交易」！在空頭排列時 ${techAnalysis.contrarian} 次逆勢抄底，這種心臟很大顆，但要嚴設停損。`;
    } else {
        keyMoveComment = "你的進出點位比較隨性，似乎沒有固定的技術指標依據，建議可以多參考季線(60MA)的方向。";
    }

    // 4. 計算「操作智商」 (加入技術面加權)
    let iqScore = 80 + Math.floor(roi * 1.2) + Math.floor((winRate - 50) * 0.4);
    if (techAnalysis.goldenCross > 0) iqScore += 10;
    if (techAnalysis.perfectExit > 0) iqScore += 5;
    if (techAnalysis.chasingHigh > 0) iqScore -= 5;
    if (iqScore > 150) iqScore = 150;
    if (iqScore < 50) iqScore = 50;

    // 5. 定義整體評語
    let styleComment;
    if (roi >= 20) styleComment = "你簡直是「多頭市場的幸運兒」，敢在低點佈局並抱得住，這心臟不是普通的大啊！";
    else if (roi > 0) styleComment = "你的風格屬於「穩健防守型」。雖然沒有暴利，但在這波動盪的市場中能全身而退，已經贏過 80% 的人了。";
    else if (roi > -10) styleComment = "運氣稍微差了一點，或者是在盤整區間被磨掉了耐心。你的操作邏輯沒大問題，只是進場點位稍嫌急躁。";
    else styleComment = "這波市場對你太殘酷了...你看起來像是「逆勢攤平」的信徒，但在空頭趨勢中接刀子是很危險的。";

    // 6. 組合最終文案 (加入市場環境與河流建議)
    const summary = `嘿！${nickname || '操盤手'}，我看了一下你在「${fundName}」的操作：

1. **市場環境**：本局處於「${techAnalysis.riverTrend}」。
2. **AI 觀點**：${riverAdvice}
3. **技術分析**：${keyMoveComment}
4. **風格點評**：${styleComment}
5. **操作智商**：${iqScore} 分

(此為 AI 導師模擬覆盤分析)`;

    return {
        title: roi >= 0 ? "🚀 穩健獲利的贏家" : "🛡️ 稍遇亂流的戰士",
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

    setTimeout(() => {
        try {
            const result = generateLocalAnalysisData(gameData);
            setAnalysisResult(result);
        } catch (err) {
            console.error("AI Error:", err);
            setError("生成分析報告時發生錯誤");
        } finally {
            setIsAnalyzing(false);
        }
    }, 2000);
  };

  const closeModal = () => setShowModal(false);

  return { analyzeGame, isAnalyzing, showModal, closeModal, analysisResult, error };
};