import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. CORS 設定 (維持不變)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { fundName, roi, transactions, nickname } = req.body;
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) throw new Error("API Key 環境變數未設定");

    // 2. 初始化 SDK
    // 注意：這裡直接使用 trim() 去除可能存在的空白
    const genAI = new GoogleGenerativeAI(apiKey.trim());

    // ★★★ 關鍵修改：定義模型候補清單 (根據您的 check-models.js 結果) ★★★
    // 系統會依序嘗試，直到有一個成功為止
    const CANDIDATE_MODELS = [
        "gemini-2.5-flash",      // 首選：最新、最快
        "gemini-2.0-flash",      // 備選 1
        "gemini-pro",            // 備選 2：最舊但最穩
        "gemini-1.5-flash-latest" // 最後防線
    ];

    const prompt = `
      你是一位說話犀利、幽默且專業的華爾街基金經理人導師。
      玩家暱稱：${nickname || '匿名玩家'}
      挑戰基金：${fundName}
      最終報酬率 (ROI)：${roi}%
      
      以下是玩家的交易紀錄 (JSON格式)：
      ${JSON.stringify(transactions)}

      請根據以上數據，完成以下任務：
      1. 用一句話毒舌點評他的操作風格。
      2. 分析他最關鍵的一次成功操作或失敗操作。
      3. 給他一個未來的投資建議。
      4. 最後給出一個 0-100 的「操作智商評分」。

      請用繁體中文回答，語氣生動有趣，200字內。
    `;

    // 3. 自動輪詢機制 (Auto-Retry Logic)
    let responseText = null;
    let lastError = null;

    for (const modelName of CANDIDATE_MODELS) {
        try {
            console.log(`🔄 正在嘗試模型: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
            
            console.log(`✅ 模型 ${modelName} 調用成功！`);
            break; // 成功就跳出迴圈
        } catch (err) {
            console.warn(`⚠️ 模型 ${modelName} 失敗: ${err.message}`);
            lastError = err;
            // 繼續嘗試下一個...
        }
    }

    if (!responseText) {
        // 如果全部都失敗，才拋出最後一個錯誤
        console.error("❌ 所有模型皆嘗試失敗");
        throw lastError;
    }

    // 4. 回傳成功結果
    return res.status(200).json({ 
      success: true, 
      analysis: responseText 
    });

  } catch (error) {
    console.error("🔥 API 最終崩潰:", error);
    return res.status(500).json({ 
      success: false, 
      error: `AI 服務暫時無法使用 (${error.message})` 
    });
  }
}