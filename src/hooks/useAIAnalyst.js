// src/hooks/useAIAnalyst.js
import { useState } from 'react';

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

    // ★★★ 關鍵修正：模擬 AI 回覆 (僅在本地端生效) ★★★
    // 這樣您用 npm run dev 也能看到漂亮的結果，不用擔心後端沒啟動
    if (window.location.hostname === 'localhost') {
        console.log("偵測到本地開發環境，啟動模擬 AI...");
        setTimeout(() => {
            setAnalysisResult(`(這是本地模擬的 AI 分析結果)
            
            嘿！${gameData.nickname || '操盤手'}，我看了一下你的操作：
            
            1. **風格點評**：你簡直是「多頭市場的幸運兒」，敢在河流圖下緣梭哈，這心臟不是普通的大啊！
            2. **關鍵操作**：最精彩的是你在 D+120 那波大跌沒有被洗出場，反而加碼攤平，這操作給你 80 分。
            3. **建議**：下次別這麼衝動 All In，留點現金在手上，不然遇到黑天鵝你就畢業了。
            4. **操作智商**：85 分。
            
            (若要測試真實 AI，請將專案部署到 Vercel)`);
            setIsAnalyzing(false);
        }, 2000); // 假裝思考 2 秒
        return;
    }

    // --- 以下是真實環境 (Vercel) 會執行的程式碼 ---
    try {
      const apiUrl = '/api/analyze-game'; 

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundName: gameData.fundName,
          roi: gameData.roi,
          transactions: gameData.transactions,
          nickname: gameData.nickname || '玩家'
        }),
      });

      // 處理非 200 的狀態 (例如 API 壞掉或找不到)
      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 50)}...`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'AI 無法回應');
      }

      setAnalysisResult(data.analysis);

    } catch (err) {
      console.error("AI Analysis Failed:", err);
      // 顯示較為友善的錯誤訊息
      setError("連線發生問題，請確認網路或稍後再試。\n(若在本地測試，請依賴上方的模擬模式)");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const closeModal = () => setShowModal(false);

  return {
    analyzeGame,
    isAnalyzing,
    showModal,
    closeModal,
    analysisResult,
    error
  };
};