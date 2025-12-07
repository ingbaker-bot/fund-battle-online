// ==========================================
// AI 投資分析核心模組 (純邏輯層)
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

// ★★★ 核心導出函數：生成 AI 分析報告 ★★★
// 這就是 AppBattle.jsx 正在尋找的函數
export const generateAIAnalysis = (transactions, historyData, initialCapital, finalAssets) => {
    
    // 1. 基礎績效計算
    const playerRoi = ((finalAssets - initialCapital) / initialCapital * 100).toFixed(2);
    
    const startNav = historyData[0].nav;
    const endNav = historyData[historyData.length - 1].nav;
    const marketRoi = ((endNav - startNav) / startNav * 100).toFixed(2);

    // 2. 詳細交易統計
    let winCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let lossCount = 0;

    // 簡單過濾出已實現損益 (根據 AppBattle 的 transactions 結構)
    // 注意：AppBattle 的 transaction 結構中 SELL 才有 pnl
    const sellOrders = transactions.filter(t => t.type === 'SELL');
    
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
    const maxDrawdown = calculateMaxDrawdown(historyData); // 這裡是算大盤回撤，若要算個人資產回撤需更多數據

    // 3. 市場趨勢判斷 (Market Context)
    // 比較季線斜率與位置
    const lastIdx = historyData.length - 1;
    const ma60_end = calculateMA(historyData, 60, lastIdx) || endNav;
    const ma60_start = calculateMA(historyData, 60, Math.min(60, lastIdx)) || startNav;
    
    let marketType = "盤整震盪";
    if (endNav > ma60_end && ma60_end > ma60_start * 1.02) marketType = "多頭趨勢";
    else if (endNav < ma60_end && ma60_end < ma60_start * 0.98) marketType = "空頭修正";

    // 4. AI 評分邏輯 (0-100分)
    let score = 60; // 基礎分
    
    // 績效加分
    if (parseFloat(playerRoi) > parseFloat(marketRoi)) score += 20; // 贏大盤
    if (parseFloat(playerRoi) > 0) score += 10; // 正報酬
    
    // 風險扣分
    if (parseFloat(playerRoi) < -10) score -= 10;
    if (parseFloat(playerRoi) < -20) score -= 20;

    // 交易加分 (鼓勵有策略的交易)
    if (totalTrades > 0 && parseFloat(winRate) > 50) score += 10;

    // 分數邊界
    if (score > 99) score = 99;
    if (score < 10) score = 10;

    // 5. 生成評語與稱號
    let title = "股市見習生";
    let summary = "";

    if (score >= 90) {
        title = "傳奇操盤手";
        summary = `太驚人了！在${marketType}中，您不僅擊敗了大盤，還展現了極高的勝率 (${winRate}%)。您的進出場點位精準，充分利用了複利效應。建議您可以嘗試加大部位，挑戰更高的獲利目標。`;
    } else if (score >= 80) {
        title = "華爾街菁英";
        summary = `表現優異！您的報酬率 (${playerRoi}%) 相當亮眼。您在趨勢判斷上已有相當火侯，只需注意在${marketType}時的風險控管，避免單筆較大的虧損，就能更上一層樓。`;
    } else if (score >= 60) {
        title = "穩健投資者";
        summary = `表現中規中矩。在${marketType}的環境下，您守住了本金並獲得了合理的報酬。數據顯示您的平均獲利為 ${avgProfit}%，建議可以透過「移動停利」的方式讓獲利奔跑，提高賺賠比。`;
    } else {
        title = "韭菜練習生";
        summary = `這是一次寶貴的經驗。在${marketType}中受傷是成長的必經之路。您的勝率為 ${winRate}%，顯示進場策略可能需要調整。建議多觀察「季線」方向，盡量避免在空頭排列時逆勢做多。`;
    }

    // 6. 回傳標準化格式
    return {
        score,
        title,
        marketRoi,
        playerRoi,
        summary,
        details: {
            winRate,
            maxDrawdown, // 這裡暫時回傳大盤回撤，若有個人資產曲線可改為個人
            avgProfit: `+${avgProfit}`,
            avgLoss: `-${avgLoss}`
        }
    };
};