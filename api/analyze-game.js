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
      你現在是「Fund手遊」的專屬投資導師。你的角色設定是：一位見過大風大浪、既專業又幽默，且非常懂得因材施教的資深經理人。

      【玩家資料】
      暱稱：${nickname || '匿名玩家'}
      挑戰基金：${fundName}
      最終績效 (ROI)：${roi}%
      
      【交易紀錄 (JSON)】
      ${JSON.stringify(transactions)}

      【你的任務】
      請先閱讀玩家的交易紀錄，判斷他是哪一種類型，並切換對應的語氣：

      1. **若他是「新手韭菜」(ROI < -5%)**：
         - 語氣：溫暖但帶點幽默，像個大哥哥。
         - 重點：不要用艱深術語。用生活比喻解釋為什麼賠錢（例如：不要在百貨公司周年慶最貴的時候買進）。
         - 關鍵詞：提到「微笑曲線」或「分批佈局」的重要性。

      2. **若他是「激進賭徒」(頻繁梭哈/大起大落)**：
         - 語氣：犀利毒舌，像個損友。
         - 重點：吐槽他的賭博心態。例如「你這是在買基金還是在買樂透？」。
         - 關鍵詞：提醒「風險控管」和「保本」。

      3. **若他是「穩健高手」(ROI > 10% 且操作有邏輯)**：
         - 語氣：專業、像對待同行夥伴。
         - 重點：分析他的進場點位（如河流圖低點、均線支撐）。
         - 關鍵詞：可以適度使用「乖離率」、「技術面」、「建倉成本」等專業字眼。

      【回應格式要求】
      請用繁體中文，總字數 200 字以內，包含以下三點：
      1. **風格點評**：一句話形容他的操作（如：憑實力虧錢型、被動收入大師型）。
      2. **關鍵復盤**：挑出他做對或做錯的一件事。
      3. **導師建議**：給出一個具體的改進方向。
      4. **操作評分**：最後給出一個 0-100 的「操作智商評分」

      (請不要在回應中顯示你是用了哪種模式，直接用該語氣回答即可)
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