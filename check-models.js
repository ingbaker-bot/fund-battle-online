// check-models.js
// 這個腳本會直接詢問 Google：我的 Key 可以用哪些模型？

async function listModels() {
  // 1. 請填入您的真實 API Key
  const API_KEY = "AIzaSyAYVfmgMG3ExW0MwOWTis0ADdgj1irXCIM"; 
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  console.log("🔍 正在查詢可用模型清單...");

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ 查詢失敗:", data.error.message);
      return;
    }

    if (!data.models) {
      console.log("⚠️ 沒有找到任何模型，請確認 API Key 是否開通 Google AI Studio 功能。");
      return;
    }

    console.log("\n✅ 您的 API Key 可以使用以下模型：");
    console.log("-----------------------------------");
    data.models.forEach(model => {
      // 只顯示我們會用到的生成文字模型 (generateContent)
      if (model.supportedGenerationMethods.includes("generateContent")) {
        // 去掉前面的 "models/" 字樣，只顯示名稱
        console.log(`👉 ${model.name.replace("models/", "")}`);
      }
    });
    console.log("-----------------------------------");
    console.log("請從上面選一個名字 (推薦含有 flash 或 pro 的)，填回 test-gemini-direct.js 再試一次！");

  } catch (error) {
    console.error("連線錯誤:", error);
  }
}

listModels();