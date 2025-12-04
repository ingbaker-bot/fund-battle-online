// test-gemini-direct.js
// 這個腳本不透過 api/ 資料夾，直接從您的電腦連線去 Google 測試
import { GoogleGenerativeAI } from "@google/generative-ai";

async function testDirect() {
  console.log("🚀 開始測試 Google Gemini 連線...");

  // 1. 設定金鑰 (測試用，直接填入即可)
  const API_KEY = "AIzaSyAYVfmgMG3ExW0MwOWTis0ADdgj1irXCIM"; 

  if (!API_KEY || API_KEY.includes("請貼上")) {
    console.error("❌ 錯誤：請先將程式碼中的 API_KEY 換成真的金鑰！");
    return;
  }

  try {
    // 2. 初始化模型
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. 發送簡單測試
    const prompt = "你好，請用一句話形容『投資基金』這件事。";
    console.log("📨 正在發送問題給 AI...");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("\n✅ 測試成功！AI 回覆如下：");
    console.log("-----------------------------");
    console.log(text);
    console.log("-----------------------------");

  } catch (error) {
    console.error("\n❌ 測試失敗，原因如下：");
    console.error(error.message);
    
    if (error.message.includes("API key not valid")) {
      console.log("👉 提示：您的 API Key 可能複製錯了，請檢查。");
    }
  }
}

testDirect();