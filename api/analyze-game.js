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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { fundName, roi, transactions, nickname } = req.body;

    // --- 🕵️ 診斷開始：檢查金鑰狀態 ---
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    console.log("🔍 [診斷日誌] 正在檢查 API Key...");
    
    if (!apiKey) {
      console.error("❌ [嚴重錯誤] API Key 是 undefined 或空值！");
      throw new Error("Server Error: API Key is missing in environment variables.");
    }

    // 印出前 5 碼確認是否正確 (不要印全部，會外洩)
    console.log(`✅ [診斷日誌] API Key 讀取成功，長度: ${apiKey.length}，前5碼: ${apiKey.substring(0, 5)}...`);
    
    // 檢查是否有隱藏的雙引號或空白
    if (apiKey.startsWith('"') || apiKey.endsWith('"')) {
       console.error("❌ [格式錯誤] API Key 被雙引號包住了！請去 Vercel 移除雙引號。");
    }
    if (apiKey.trim() !== apiKey) {
       console.error("❌ [格式錯誤] API Key 前後有多餘的空白鍵！");
    }
    // --- 🕵️ 診斷結束 ---

    // 2. 初始化 Google Gemini (使用穩定版 1.5-flash)
    const genAI = new GoogleGenerativeAI(apiKey.trim()); // 加 trim() 做最後防呆
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

      請用繁體中文回答，語氣要生動有趣，字數控制在 200 字以內。
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return res.status(200).json({ 
      success: true, 
      analysis: responseText 
    });

  } catch (error) {
    console.error("🔥 [API 崩潰日誌] 詳細錯誤:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "AI 分析服務暫時無法使用" 
    });
  }
}