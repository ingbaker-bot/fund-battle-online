// api/analyze-game.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 1. 處理跨域問題 (CORS) - 確保您的 React 前端可以呼叫這個 API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // 正式上線建議改成您的網域
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 處理 OPTIONS 請求 (預檢請求)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只允許 POST 方法
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. 從前端接收資料
    const { fundName, roi, transactions, nickname } = req.body;

    // 3. 初始化 Google Gemini
    // 注意：這裡使用環境變數，絕對不要把 Key 寫死在這裡！
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. 設定 AI 的人設與提示詞 (Prompt)
    const prompt = `
      你是一位說話犀利、幽默且專業的華爾街基金經理人導師。
      玩家暱稱：${nickname || '匿名玩家'}
      挑戰基金：${fundName}
      最終報酬率 (ROI)：${roi}%
      
      以下是玩家的交易紀錄 (JSON格式)：
      ${JSON.stringify(transactions)}

      請根據以上數據，完成以下任務：
      1. 用一句話毒舌點評他的操作風格（例如：追高殺低型、運氣爆棚型、佛系躺平型）。
      2. 分析他最關鍵的一次成功操作或失敗操作。
      3. 給他一個未來的投資建議。
      4. 最後給出一個 0-100 的「操作智商評分」。

      請用繁體中文回答，語氣要生動有趣，字數控制在 200 字以內。
    `;

    // 5. 發送給 AI 並等待結果
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 6. 回傳結果給前端
    return res.status(200).json({ 
      success: true, 
      analysis: responseText 
    });

  } catch (error) {
    console.error("AI Analysis Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "AI 思考過程中斷線了..." 
    });
  }
}