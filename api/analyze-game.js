import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. CORS 設定
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
    
    // --- 診斷：檢查金鑰 ---
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ [嚴重錯誤] 環境變數 GOOGLE_GEMINI_API_KEY 未設定");
        throw new Error("API Key 環境變數未設定");
    }
    
    // 去除可能的多餘空白
    const cleanKey = apiKey.trim();
    const genAI = new GoogleGenerativeAI(cleanKey);

    // ★★★ 模型清單 ★★★
    const CANDIDATE_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-pro"
    ];

    // ★★★ 優化後的 Prompt (分級回應策略) ★★★
    // 注意：這裡使用反引號 (`) 包裹，請勿刪除頭尾的引號
    const prompt = `
      你現在是「Fund手遊」的專屬投資導師。你的角色設定是：一位見過大風大浪、既專業又幽默，且非常懂得因材施教的資深經理人。

      【玩家資料】
      暱稱：${nickname || '匿名玩家'}
      挑戰基金：${fundName}
      最終績效 (ROI)：${roi}%
      
      【交易紀錄 (JSON)】
      ${JSON.stringify(transactions)}

      【你的任務】
      請閱讀交易紀錄，根據玩家表現切換三種不同的人格面具：

      👉 情況一：當 ROI < -5% (新手/虧損)
      - 語氣：溫暖鼓勵，但帶一點點無奈的幽默（像看著跌倒的弟弟）。
      - 分析重點：是否追高殺低？是否太晚停損？
      - 關鍵詞：請提到「分批佈局」或「微笑曲線」來安慰他。

      👉 情況二：當 ROI 在 -5% ~ 10% 之間 (普通/震盪)
      - 語氣：平淡中帶點犀利，像個嚴格的教練。
      - 分析重點：是否交易太頻繁導致手續費過高？還是太早賣出錯過行情？
      - 關鍵詞：請提到「長期持有」或「減少過度操作」。

      👉 情況三：當 ROI > 10% (高手/獲利)
      - 語氣：專業、充滿敬意，把他當成同行夥伴。
      - 分析重點：稱讚他買在「相對低點」或「河流圖下緣」的勇氣。
      - 關鍵詞：可以使用「乖離率」、「建倉成本」、「漂亮的停利」等專業術語。

      【回應格式要求】
      請用繁體中文，總字數控制在 200 字以內，必須包含：
      1. **風格點評**：用一句話給他貼標籤。
      2. **關鍵復盤**：指出他這局最關鍵的一個決策。
      3. **導師建議**：給他下一局的具體建議。
    `;

    // 3. 自動輪詢機制
    let responseText = null;
    let lastError = null;

    for (const modelName of CANDIDATE_MODELS) {
        try {
            console.log(`🔄 嘗試模型: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            responseText = result.response.text();
            
            console.log(`✅ 模型 ${modelName} 成功回應！`);
            break; 
        } catch (err) {
            console.warn(`⚠️ 模型 ${modelName} 失敗: ${err.message}`);
            lastError = err;
        }
    }

    if (!responseText) {
        console.error("❌ 所有模型皆失敗");
        throw lastError;
    }

    return res.status(200).json({ 
      success: true, 
      analysis: responseText 
    });

  } catch (error) {
    console.error("🔥 API 最終崩潰:", error);
    // 這裡回傳 500 JSON，讓前端可以優雅地顯示錯誤，而不是崩潰
    return res.status(500).json({ 
      success: false, 
      error: `AI 服務暫時無法使用 (${error.message})` 
    });
  }
}