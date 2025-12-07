// ==========================================
// 檔案路徑：src/hooks/useAIAnalyst.js
// ==========================================

// 輔助：計算移動平均線 (MA)
const calculateMA = (data, days, idx) => {
    if (idx < days - 1) return null;
    let sum = 0;
    for (let i = 0; i < days; i++) {
        sum += data[idx - i].nav;
    }
    return sum / days;
};

// 輔助：計算最大回撤 (Max Drawdown)
const calculateMaxDrawdown = (data) => {
    let peak = -Infinity;
    let maxDrawdown = 0;
    
    for (const point of data) {
        if (point.nav > peak) peak = point.nav;
        const drawdown = (peak - point.nav) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    return (maxDrawdown * 100).toFixed(2);
};

// ★★★ 關鍵：這裡使用的是 export const generateAIAnalysis ★★★
export const generateAIAnalysis = (transactions, historyData, initialCapital, finalAssets) => {
    
    // 1. 基礎績效計算
    const playerRoi = ((finalAssets - initialCapital) / initialCapital * 100).toFixed(2);
    
    // 防呆：確保 historyData 有資料
    if (!historyData || historyData.length === 0) {
        return { score: 0, title: "數據不足", marketRoi: 0, playerRoi: 0, summary: "數據不足", details: {} };
    }

    const startNav = historyData[0].nav;
    const endNav = historyData[historyData.length - 1].nav;
    const marketRoi = ((endNav - startNav) / startNav * 100).toFixed(2);

    // 2. 詳細交易統計
    let winCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let lossCount = 0;

    // 確保 transactions 是陣列
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const sellOrders = safeTransactions.filter(t => t.type === 'SELL');
    
    sellOrders.forEach(t => {
        if (t.pnl > 0) {
            winCount++;
            totalProfit += t.pnl;
        } else {
            lossCount++;
            totalLoss += Math.abs(t.pnl);
        }
    });

    const totalTrades = sellOrders.length;
    const winRate = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(0) : 0;
    const avgProfit = winCount > 0 ? (totalProfit / winCount / initialCapital * 100).toFixed(1) : 0;
    const avgLoss = lossCount > 0 ? (totalLoss / lossCount / initialCapital * 100).toFixed(1) : 0;
    const maxDrawdown = calculateMaxDrawdown(historyData); 

    // 3. 市場趨勢判斷
    const lastIdx = historyData.length - 1;
    const ma60_end = calculateMA(historyData, 60, lastIdx) || endNav;
    const ma60_start = calculateMA(historyData, 60, Math.min(60, lastIdx)) || startNav;
    
    let marketType = "盤整震盪";
    if (endNav > ma60_end && ma60_end > ma60_start * 1.02) marketType = "多頭趨勢";
    else if (endNav < ma60_end && ma60_end < ma60_start * 0.98) marketType = "空頭修正";

    // 4. AI 評分邏輯
    let score = 60; 
    if (parseFloat(playerRoi) > parseFloat(marketRoi)) score += 20; 
    if (parseFloat(playerRoi) > 0) score += 10; 
    if (parseFloat(playerRoi) < -10) score -= 10;
    if (parseFloat(playerRoi) < -20) score -= 20;
    if (totalTrades > 0 && parseFloat(winRate) > 50) score += 10;
    if (score > 99) score = 99;
    if (score < 10) score = 10;

    // 5. 生成評語
    let title = "股市見習生";
    let summary = "";

    if (score >= 90) {
        title = "傳奇操盤手";
        summary = `太驚人了！在${marketType}中，您不僅擊敗了大盤，還展現了極高的勝率 (${winRate}%)。您的進出場點位精準，充分利用了複利效應。`;
    } else if (score >= 80) {
        title = "華爾街菁英";
        summary = `表現優異！您的報酬率 (${playerRoi}%) 相當亮眼。您在趨勢判斷上已有相當火侯，只需注意在${marketType}時的風險控管。`;
    } else if (score >= 60) {
        title = "穩健投資者";
        summary = `表現中規中矩。在${marketType}的環境下，您守住了本金並獲得了合理的報酬。建議可以透過「移動停利」提高賺賠比。`;
    } else {
        title = "韭菜練習生";
        summary = `這是一次寶貴的經驗。在${marketType}中受傷是成長的必經之路。建議多觀察「季線」方向，盡量避免逆勢操作。`;
    }

    return {
        score,
        title,
        marketRoi,
        playerRoi,
        summary,
        details: {
            winRate,
            maxDrawdown,
            avgProfit: `+${avgProfit}`,
            avgLoss: `-${avgLoss}`
        }
    };
};